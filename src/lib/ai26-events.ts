import "server-only"

import { and, asc, eq, gte, inArray, lte } from "drizzle-orm"
import { db } from "@/db"
import {
  checkIns,
  deviceCommands,
  deviceEvents,
  deviceMemberMappings,
  devices,
  failedCheckIns,
  members,
  subscriptions,
} from "@/db/schema"
import {
  sanitizeAi26Payload,
  type Ai26Json,
  type GatewayEvent,
} from "@/lib/ai26-protocol"
import { queueMemberDeviceAccess } from "@/lib/member-device-access"
import { buildAi26FastLogQuery, type FastLogRow } from "@/lib/ai26-fast-log-query"

type DeferTask = (task: () => Promise<void>) => void

function asRecord(value: unknown): Ai26Json {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Ai26Json
    : {}
}

function asInteger(value: unknown) {
  const number = Number(value)
  return Number.isInteger(number) ? number : null
}

function asNonNegativeInteger(value: unknown) {
  const number = asInteger(value)
  return number !== null && number >= 0 ? number : null
}

function parseDeviceDate(value: unknown) {
  if (typeof value !== "string") return new Date()
  // AI26 sends local time without a timezone. The gym operates in UTC+7.
  const parsed = new Date(`${value.trim().replace(" ", "T")}+07:00`)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

async function upsertDevice(event: GatewayEvent) {
  const devinfo = asRecord(event.payload.devinfo)
  const logCapacity = asNonNegativeInteger(devinfo.logsize)
  const usedLogCount = asNonNegativeInteger(devinfo.usedlog)
  const unsyncedLogCount = asNonNegativeInteger(devinfo.usednewlog)
  const hasLogStats = event.type === "register"
    && logCapacity !== null
    && usedLogCount !== null
    && unsyncedLogCount !== null
  const now = new Date()
  const [device] = await db.insert(devices).values({
    serialNumber: event.serialNumber,
    name: `AI26 ${event.serialNumber}`,
    modelName: typeof devinfo.modelname === "string" ? devinfo.modelname : null,
    firmware: typeof devinfo.firmware === "string" ? devinfo.firmware : null,
    status: event.type === "disconnect" ? "offline" : "online",
    lastSeenAt: now,
    lastIp: event.remoteAddress || null,
    logCapacity: hasLogStats ? logCapacity : null,
    usedLogCount: hasLogStats ? usedLogCount : null,
    unsyncedLogCount: hasLogStats ? unsyncedLogCount : null,
    logStatsAt: hasLogStats ? now : null,
  }).onConflictDoUpdate({
    target: devices.serialNumber,
    set: {
      modelName: typeof devinfo.modelname === "string" ? devinfo.modelname : undefined,
      firmware: typeof devinfo.firmware === "string" ? devinfo.firmware : undefined,
      status: event.type === "disconnect" ? "offline" : "online",
      lastSeenAt: now,
      lastIp: event.remoteAddress || undefined,
      logCapacity: hasLogStats ? logCapacity : undefined,
      usedLogCount: hasLogStats ? usedLogCount : undefined,
      unsyncedLogCount: hasLogStats ? unsyncedLogCount : undefined,
      logStatsAt: hasLogStats ? now : undefined,
      updatedAt: now,
    },
  }).returning()

  return device
}

async function queueAutomaticLogCleanup(device: typeof devices.$inferSelect) {
  const capacity = device.logCapacity
  const used = device.usedLogCount
  if (!capacity || capacity <= 0 || !used || used <= 0) return
  if (!device.lastLogSyncedAt) return
  if (device.unsyncedLogCount !== 0 || used / capacity < 0.8) return

  // Avoid re-queuing after a reconnect while the previous cleanup is still
  // pending, or immediately after a successful cleanup response.
  if (device.lastLogCleanupAt
    && Date.now() - device.lastLogCleanupAt.getTime() < 6 * 60 * 60 * 1000) return

  const existing = await db.query.deviceCommands.findFirst({
    where: and(
      eq(deviceCommands.deviceId, device.id),
      eq(deviceCommands.command, "cleanlog"),
      inArray(deviceCommands.status, ["pending", "sent"])
    ),
  })
  if (existing) return

  await db.insert(deviceCommands).values({
    deviceId: device.id,
    command: "cleanlog",
    payload: { cmd: "cleanlog" },
    status: "pending",
  })
  await addAuditEvent(device.id, "auto_cleanlog_queued", {
    usedlog: used,
    logsize: capacity,
    usednewlog: 0,
    threshold: 0.8,
  })
}

async function addAuditEvent(
  deviceId: number,
  eventType: string,
  payload: Ai26Json,
  eventKey?: string
) {
  await db.insert(deviceEvents).values({
    deviceId,
    eventType,
    eventKey,
    payload: sanitizeAi26Payload(payload),
  }).onConflictDoNothing()
}

async function addFailedCheckIn(options: {
  deviceId: number
  memberId?: number
  enrollId?: number
  attemptedAt: Date
  eventKey: string
  reason: string
  message: string
}) {
  await db.insert(failedCheckIns).values({
    deviceId: options.deviceId,
    memberId: options.memberId,
    enrollId: options.enrollId,
    attemptedAt: options.attemptedAt,
    source: "ai26",
    reason: options.reason,
    message: options.message,
    deviceEventKey: options.eventKey,
  }).onConflictDoNothing()
}

async function finishFastLogProcessing(deviceId: number, memberId: number | null) {
  if (memberId !== null) await queueMemberDeviceAccess(memberId, true)

  const device = await db.query.devices.findFirst({
    where: eq(devices.id, deviceId),
  })
  if (device) await queueAutomaticLogCleanup(device)
}

async function handleFastLogEvent(
  event: GatewayEvent,
  record: Ai26Json,
  enrollId: number,
  deferTask?: DeferTask
) {
  const checkInAt = parseDeviceDate(record.time)
  const packetIndex = event.payload.logindex ?? "no-index"
  const eventKey = [
    event.serialNumber,
    packetIndex,
    0,
    enrollId,
    typeof record.time === "string" ? record.time : "unknown-time",
  ].join(":")
  const now = new Date()
  const sanitizedRecord = JSON.stringify(sanitizeAi26Payload(record))
  const verificationMode = asInteger(record.verifymode)
  const temperature = typeof record.temp === "number" ? record.temp : null

  // One round trip performs the complete authorization decision and persists
  // either the successful check-in or the rejected attempt before AI26 is
  // allowed to actuate the door.
  const result = await db.execute<FastLogRow>(buildAi26FastLogQuery({
    serialNumber: event.serialNumber,
    remoteAddress: event.remoteAddress || null,
    now,
    checkInAt,
    enrollId,
    eventKey,
    sanitizedRecord,
    verificationMode,
    temperature,
  }))

  const row = result.rows[0]
  if (!row) throw new Error("Không xác định được thiết bị AI26")

  const allowed = row.member_id !== null
    && row.member_status === "active"
    && row.has_active_subscription === true
  const recent = Math.abs(Date.now() - checkInAt.getTime()) <= 120_000
  const message = row.member_id === null
    ? "Khuôn mặt chưa liên kết với hội viên"
    : row.member_status !== "active"
      ? "Hội viên đang bị khóa"
      : row.has_active_subscription
        ? "Check-in thành công"
        : "Gói tập đã hết hạn hoặc chưa có hiệu lực"

  const backgroundTask = async () => {
    try {
      await finishFastLogProcessing(Number(row.device_id), row.member_id === null ? null : Number(row.member_id))
    } catch (error) {
      console.error("AI26 post-response synchronization failed", error)
    }
  }
  if (deferTask) deferTask(backgroundTask)
  else await backgroundTask()

  return { access: allowed && recent ? 1 : 0, message }
}

async function handleLogEvent(device: typeof devices.$inferSelect, payload: Ai26Json) {
  const records = Array.isArray(payload.record) ? payload.record : []
  const packetIndex = payload.logindex ?? "no-index"
  const decisions: Array<{ allowed: boolean; recent: boolean; message: string }> = []

  for (let index = 0; index < records.length; index += 1) {
    const record = asRecord(records[index])
    const enrollId = asInteger(record.enrollid)
    const checkInAt = parseDeviceDate(record.time)
    const eventKey = [
      device.serialNumber,
      packetIndex,
      index,
      enrollId ?? "unknown",
      typeof record.time === "string" ? record.time : "unknown-time",
    ].join(":")

    await addAuditEvent(device.id, "log", record, `log:${eventKey}`)

    if (enrollId === null) {
      const message = "Thiếu mã hội viên"
      await addFailedCheckIn({
        deviceId: device.id,
        attemptedAt: checkInAt,
        eventKey,
        reason: "missing_enroll_id",
        message,
      })
      decisions.push({ allowed: false, recent: false, message })
      continue
    }

    const mapping = await db.query.deviceMemberMappings.findFirst({
      where: and(
        eq(deviceMemberMappings.deviceId, device.id),
        eq(deviceMemberMappings.enrollId, enrollId)
      ),
      with: { member: true },
    })

    if (!mapping) {
      const message = "Khuôn mặt chưa liên kết với hội viên"
      await addFailedCheckIn({
        deviceId: device.id,
        enrollId,
        attemptedAt: checkInAt,
        eventKey,
        reason: "unmapped_face",
        message,
      })
      decisions.push({ allowed: false, recent: false, message })
      continue
    }

    const activeSubscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.memberId, mapping.memberId),
        eq(subscriptions.status, "active"),
        lte(subscriptions.startDate, checkInAt),
        gte(subscriptions.endDate, checkInAt)
      ),
    })

    const memberActive = mapping.member.status === "active"
    const allowed = memberActive && Boolean(activeSubscription)
    const recent = Math.abs(Date.now() - checkInAt.getTime()) <= 120_000
    const message = !memberActive
      ? "Hội viên đang bị khóa"
      : activeSubscription
        ? "Check-in thành công"
        : "Gói tập đã hết hạn hoặc chưa có hiệu lực"

    if (allowed) {
      await db.insert(checkIns).values({
        memberId: mapping.memberId,
        checkInTime: checkInAt,
        source: "ai26",
        deviceId: device.id,
        deviceEventKey: eventKey,
        verificationMode: asInteger(record.verifymode),
        temperature: typeof record.temp === "number" ? record.temp : null,
      }).onConflictDoNothing()
    } else {
      await addFailedCheckIn({
        deviceId: device.id,
        memberId: mapping.memberId,
        enrollId,
        attemptedAt: checkInAt,
        eventKey,
        reason: memberActive ? "subscription_expired" : "member_inactive",
        message,
      })
    }

    // Recognition stays enabled so every attempt reaches the server and can be
    // audited. `server_verify=1` plus offline waiver disabled means the terminal
    // still opens only when this request returns access=1.
    await queueMemberDeviceAccess(mapping.memberId, true)

    decisions.push({ allowed, recent, message })
  }

  // Only a fresh, single recognition event may actuate the door. Replayed
  // historical batches are recorded but can never open it.
  const liveDecision = records.length === 1 ? decisions[0] : undefined
  const syncedAt = new Date()
  await db.update(devices).set({
    lastLogSyncedAt: syncedAt,
    updatedAt: syncedAt,
  }).where(eq(devices.id, device.id))
  // If this is the first successful upload after enabling log management,
  // re-evaluate the 80% rule without forcing another device restart.
  await queueAutomaticLogCleanup({ ...device, lastLogSyncedAt: syncedAt })
  return {
    access: liveDecision?.allowed && liveDecision.recent ? 1 : 0,
    message: liveDecision?.message || "Đã nhận dữ liệu chấm công",
  }
}

async function registerDeviceFace(
  device: typeof devices.$inferSelect,
  enrollId: number,
  resetAccess: boolean
) {
  const member = await db.query.members.findFirst({
    where: eq(members.id, enrollId),
  })

  if (member) {
    await db.insert(deviceMemberMappings).values({
      deviceId: device.id,
      memberId: member.id,
      enrollId,
      faceStatus: "registered",
      faceEnrolledAt: new Date(),
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [deviceMemberMappings.deviceId, deviceMemberMappings.memberId],
      set: {
        enrollId,
        faceStatus: "registered",
        ...(resetAccess ? { accessEnabled: null } : {}),
        faceEnrolledAt: new Date(),
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }

  await db.update(deviceMemberMappings).set({
    faceStatus: "registered",
    ...(resetAccess ? { accessEnabled: null } : {}),
    faceEnrolledAt: new Date(),
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(
    eq(deviceMemberMappings.deviceId, device.id),
    eq(deviceMemberMappings.enrollId, enrollId)
  ))

  const mapping = await db.query.deviceMemberMappings.findFirst({
    where: and(
      eq(deviceMemberMappings.deviceId, device.id),
      eq(deviceMemberMappings.enrollId, enrollId)
    ),
  })
  if (mapping) {
    await queueMemberDeviceAccess(mapping.memberId, true)
  }
}

async function handleSendUser(device: typeof devices.$inferSelect, payload: Ai26Json) {
  const enrollId = asInteger(payload.enrollid)
  const backupnum = asInteger(payload.backupnum)

  await addAuditEvent(
    device.id,
    "senduser",
    payload,
    enrollId === null || backupnum === null
      ? undefined
      : `senduser:${device.serialNumber}:${enrollId}:${backupnum}:${Date.now()}`
  )

  if (enrollId !== null && backupnum === 50) {
    // A face captured directly on the terminal is linked automatically when
    // its terminal ID matches the stable web member ID.
    await registerDeviceFace(device, enrollId, true)
  }

  return { access: 0, message: "Đã nhận dữ liệu người dùng" }
}

async function handleCommandResponse(device: typeof devices.$inferSelect, payload: Ai26Json) {
  const commandName = typeof payload.ret === "string" ? payload.ret.trim() : ""
  const result = payload.result !== false
  await addAuditEvent(device.id, "response", payload)

  if (!commandName) return { access: 0 }

  const command = await db.query.deviceCommands.findFirst({
    where: and(
      eq(deviceCommands.deviceId, device.id),
      eq(deviceCommands.command, commandName),
      inArray(deviceCommands.status, ["pending", "sent"])
    ),
    orderBy: [asc(deviceCommands.createdAt)],
  })

  if (!command) return { access: 0 }

  await db.update(deviceCommands).set({
    status: result ? "completed" : "failed",
    completedAt: new Date(),
    error: result ? null : String(payload.reason || "Thiết bị từ chối lệnh"),
  }).where(eq(deviceCommands.id, command.id))

  if (command.memberId && commandName === "adduser") {
    await db.update(deviceMemberMappings).set({
      faceStatus: result ? "scanning" : "failed",
      updatedAt: new Date(),
    }).where(and(
      eq(deviceMemberMappings.deviceId, device.id),
      eq(deviceMemberMappings.memberId, command.memberId)
    ))
  }

  if (command.memberId && commandName === "deleteuser" && result) {
    await db.update(deviceMemberMappings).set({
      faceStatus: "not_registered",
      accessEnabled: false,
      faceEnrolledAt: null,
      lastAccessSyncedAt: new Date(),
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(deviceMemberMappings.deviceId, device.id),
      eq(deviceMemberMappings.memberId, command.memberId)
    ))
  }

  if (command.memberId && commandName === "enableuser" && result) {
    const enabled = Number(command.payload.enflag) === 1
    await db.update(deviceMemberMappings).set({
      accessEnabled: enabled,
      lastAccessSyncedAt: new Date(),
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(deviceMemberMappings.deviceId, device.id),
      eq(deviceMemberMappings.memberId, command.memberId)
    ))
  }

  if (commandName === "cleanlog" && result) {
    await db.update(devices).set({
      usedLogCount: 0,
      unsyncedLogCount: 0,
      logStatsAt: new Date(),
      lastLogCleanupAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(devices.id, device.id))
  }

  if (commandName === "getuserlist" && result && Array.isArray(payload.record)) {
    const faceEnrollIds = new Set<number>()
    for (const item of payload.record) {
      const record = asRecord(item)
      const enrollId = asInteger(record.enrollid)
      const backupnum = asInteger(record.backupnum)
      if (enrollId === null || backupnum !== 50) continue
      faceEnrollIds.add(enrollId)
      await registerDeviceFace(device, enrollId, false)
    }

    // `getuserlist` is the inventory source of truth. If a face was deleted
    // directly on the AI26, reflect that deletion on the web without deleting
    // the member or their subscription.
    const mappings = await db.query.deviceMemberMappings.findMany({
      where: eq(deviceMemberMappings.deviceId, device.id),
    })
    for (const mapping of mappings) {
      if (faceEnrollIds.has(mapping.enrollId)) continue
      await db.update(deviceMemberMappings).set({
        faceStatus: "not_registered",
        accessEnabled: false,
        faceEnrolledAt: null,
        lastAccessSyncedAt: new Date(),
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(deviceMemberMappings.id, mapping.id))
    }
  }

  return { access: 0 }
}

export async function handleGatewayEvent(event: GatewayEvent, deferTask?: DeferTask) {
  if (event.type === "log") {
    const records = Array.isArray(event.payload.record) ? event.payload.record : []
    const record = records.length === 1 ? asRecord(records[0]) : null
    const enrollId = record ? asInteger(record.enrollid) : null
    if (record && enrollId !== null) {
      return handleFastLogEvent(event, record, enrollId, deferTask)
    }

    const device = await upsertDevice(event)
    return handleLogEvent(device, event.payload)
  }

  const device = await upsertDevice(event)

  if (event.type === "register") {
    await addAuditEvent(device.id, "register", event.payload)
    await queueAutomaticLogCleanup(device)
    return { access: 0, message: "Thiết bị đã đăng ký" }
  }
  if (event.type === "disconnect") {
    await addAuditEvent(device.id, "disconnect", event.payload)
    return { access: 0 }
  }
  if (event.type === "heartbeat") return { access: 0 }
  if (event.type === "senduser") return handleSendUser(device, event.payload)
  if (event.type === "response") return handleCommandResponse(device, event.payload)

  await addAuditEvent(device.id, event.type, event.payload)
  return { access: 0 }
}
