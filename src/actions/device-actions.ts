"use server"

import { and, desc, eq, gte, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import {
  deviceCommands,
  deviceEvents,
  deviceMemberMappings,
  devices,
  members,
} from "@/db/schema"
import { logAction } from "@/actions/audit-actions"
import { requireAdmin, requireUser } from "@/lib/auth"
import { formatAi26Date, type Ai26Command } from "@/lib/ai26-protocol"

async function sendTrackedCommand(options: {
  device: typeof devices.$inferSelect
  command: Ai26Command
  memberId?: number
}) {
  await db.insert(deviceCommands).values({
    deviceId: options.device.id,
    memberId: options.memberId,
    command: options.command.cmd,
    payload: options.command,
    status: "pending",
  })

  return {
    success: true,
    message: "Đã xếp lệnh. AI26 sẽ nhận ở lần đồng bộ tiếp theo.",
  }
}

export async function getDevices() {
  await requireUser()

  return db.query.devices.findMany({
    orderBy: [desc(devices.createdAt)],
    with: {
      memberMappings: true,
    },
  })
}

export async function getDeviceDashboard(options: {
  devicePage?: number
  deviceLimit?: number
  commandPage?: number
  commandLimit?: number
  eventPage?: number
  eventLimit?: number
} = {}) {
  await requireAdmin()

  const devicePage = Math.max(1, options.devicePage || 1)
  const deviceLimit = Math.min(100, Math.max(10, options.deviceLimit || 20))
  const commandPage = Math.max(1, options.commandPage || 1)
  const commandLimit = Math.min(100, Math.max(10, options.commandLimit || 10))
  const eventPage = Math.max(1, options.eventPage || 1)
  const eventLimit = Math.min(100, Math.max(10, options.eventLimit || 10))
  const retentionCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    deviceList,
    commands,
    events,
    [{ count: deviceCount }],
    [{ count: commandCount }],
    [{ count: eventCount }],
  ] = await Promise.all([
    db.query.devices.findMany({
      orderBy: [desc(devices.createdAt)],
      limit: deviceLimit,
      offset: (devicePage - 1) * deviceLimit,
      with: { memberMappings: true },
    }),
    db.query.deviceCommands.findMany({
      where: gte(deviceCommands.createdAt, retentionCutoff),
      orderBy: [desc(deviceCommands.createdAt)],
      limit: commandLimit,
      offset: (commandPage - 1) * commandLimit,
      with: { device: true, member: true },
    }),
    db.query.deviceEvents.findMany({
      where: gte(deviceEvents.createdAt, retentionCutoff),
      orderBy: [desc(deviceEvents.createdAt)],
      limit: eventLimit,
      offset: (eventPage - 1) * eventLimit,
      with: { device: true },
    }),
    db.select({ count: sql<number>`count(*)` }).from(devices),
    db.select({ count: sql<number>`count(*)` }).from(deviceCommands).where(gte(deviceCommands.createdAt, retentionCutoff)),
    db.select({ count: sql<number>`count(*)` }).from(deviceEvents).where(gte(deviceEvents.createdAt, retentionCutoff)),
  ])

  return {
    devices: deviceList,
    commands,
    events,
    checkedAt: Date.now(),
    pagination: {
      devices: { totalItems: Number(deviceCount), totalPages: Math.ceil(Number(deviceCount) / deviceLimit) },
      commands: { totalItems: Number(commandCount), totalPages: Math.ceil(Number(commandCount) / commandLimit) },
      events: { totalItems: Number(eventCount), totalPages: Math.ceil(Number(eventCount) / eventLimit) },
    },
  }
}

export async function saveDevice(data: { serialNumber: string; name: string }) {
  await requireAdmin()

  const serialNumber = data.serialNumber.trim().toUpperCase()
  const name = data.name.trim()
  if (!serialNumber || serialNumber.length > 100) {
    throw new Error("Số serial máy không hợp lệ")
  }
  if (!name || name.length > 255) {
    throw new Error("Tên máy không hợp lệ")
  }

  const [device] = await db.insert(devices).values({
    serialNumber,
    name,
  }).onConflictDoUpdate({
    target: devices.serialNumber,
    set: { name, isActive: true, updatedAt: new Date() },
  }).returning()

  await logAction("CREATE", "DEVICE", device.id, { serialNumber, name })
  revalidatePath("/devices")
  return { success: true, device }
}

export async function startFaceEnrollment(memberId: number, deviceId?: number) {
  await requireUser()

  const member = await db.query.members.findFirst({
    where: and(eq(members.id, memberId), ne(members.status, "deleted")),
  })
  if (!member) return { success: false, message: "Không tìm thấy hội viên" }

  const device = deviceId
    ? await db.query.devices.findFirst({ where: eq(devices.id, deviceId) })
    : await db.query.devices.findFirst({
        where: eq(devices.isActive, true),
        orderBy: [desc(devices.lastSeenAt)],
      })

  if (!device) {
    return { success: false, message: "Chưa khai báo máy AI26 trong mục Máy nhận diện" }
  }

  // Member IDs are stable, unique integers and fit AI26's enrollid field.
  const enrollId = member.id
  const [mapping] = await db.insert(deviceMemberMappings).values({
    deviceId: device.id,
    memberId: member.id,
    enrollId,
    faceStatus: "pending",
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: [deviceMemberMappings.deviceId, deviceMemberMappings.memberId],
    set: {
      enrollId,
      faceStatus: "pending",
      updatedAt: new Date(),
    },
  }).returning()

  const result = await sendTrackedCommand({
    device,
    memberId: member.id,
    command: {
      cmd: "adduser",
      enrollid: mapping.enrollId,
      backupnum: 50,
      admin: 0,
      name: member.fullName,
    },
  })

  if (!result.success) {
    await db.update(deviceMemberMappings)
      .set({ faceStatus: "failed", updatedAt: new Date() })
      .where(eq(deviceMemberMappings.id, mapping.id))
  }

  await logAction("UPDATE", "DEVICE", device.id, {
    action: "START_FACE_ENROLLMENT",
    memberId,
    enrollId,
    success: result.success,
  })
  revalidatePath("/members")
  revalidatePath("/devices")

  return result.success
    ? { success: true, message: "Đã xếp lệnh quét mặt. Mời hội viên đứng trước AI26; máy sẽ nhận ở lần đồng bộ tiếp theo." }
    : result
}

export async function deleteFaceEnrollment(memberId: number, deviceId: number) {
  await requireUser()

  const mapping = await db.query.deviceMemberMappings.findFirst({
    where: and(
      eq(deviceMemberMappings.memberId, memberId),
      eq(deviceMemberMappings.deviceId, deviceId)
    ),
    with: { device: true },
  })
  if (!mapping) return { success: false, message: "Hội viên chưa liên kết với máy này" }

  await db.update(deviceMemberMappings)
    .set({ faceStatus: "pending_delete", updatedAt: new Date() })
    .where(eq(deviceMemberMappings.id, mapping.id))

  const result = await sendTrackedCommand({
    device: mapping.device,
    memberId,
    command: {
      cmd: "deleteuser",
      enrollid: mapping.enrollId,
      backupnum: 13,
    },
  })

  if (!result.success) {
    await db.update(deviceMemberMappings)
      .set({ faceStatus: "failed", updatedAt: new Date() })
      .where(eq(deviceMemberMappings.id, mapping.id))
  }

  revalidatePath("/members")
  revalidatePath("/devices")
  return result
}

export async function sendDeviceControl(
  deviceId: number,
  control: "sync_time" | "get_info" | "get_users"
) {
  await requireAdmin()

  const device = await db.query.devices.findFirst({
    where: eq(devices.id, deviceId),
  })
  if (!device) return { success: false, message: "Không tìm thấy thiết bị" }

  const commands: Record<typeof control, Ai26Command> = {
    sync_time: { cmd: "settime", cloudtime: formatAi26Date() },
    get_info: { cmd: "getdevinfo" },
    get_users: { cmd: "getuserlist", stn: true },
  }

  const result = await sendTrackedCommand({ device, command: commands[control] })
  await logAction("UPDATE", "DEVICE", device.id, { control, success: result.success })
  revalidatePath("/devices")
  return result
}

export async function requestDeviceLogCleanup(deviceId: number) {
  await requireAdmin()

  const device = await db.query.devices.findFirst({
    where: eq(devices.id, deviceId),
  })
  if (!device) return { success: false, message: "Không tìm thấy thiết bị" }

  const now = Date.now()
  const online = device.status === "online"
    && Boolean(device.lastSeenAt)
    && now - device.lastSeenAt!.getTime() < 90_000
  if (!online) {
    return { success: false, message: "Máy đang ngoại tuyến nên chưa thể dọn nhật ký" }
  }

  const statsFresh = Boolean(device.logStatsAt)
    && now - device.logStatsAt!.getTime() < 10 * 60 * 1000
  if (!statsFresh) {
    return {
      success: false,
      message: "Thông tin nhật ký chưa đủ mới. Hãy kết nối lại AI26 rồi thử lại.",
    }
  }
  if (!device.lastLogSyncedAt) {
    return {
      success: false,
      message: "Chưa có lần lưu nhật ký AI26 thành công vào web nên hệ thống chưa cho phép xóa.",
    }
  }
  if (device.unsyncedLogCount !== 0) {
    return {
      success: false,
      message: `Còn ${device.unsyncedLogCount ?? "không rõ"} bản ghi chưa đồng bộ; hệ thống không cho phép xóa.`,
    }
  }
  if (!device.usedLogCount || device.usedLogCount <= 0) {
    return { success: false, message: "Máy không có nhật ký cần dọn" }
  }

  const existing = await db.query.deviceCommands.findFirst({
    where: and(
      eq(deviceCommands.deviceId, device.id),
      eq(deviceCommands.command, "cleanlog"),
      sql`${deviceCommands.status} in ('pending', 'sent')`
    ),
  })
  if (existing) {
    return { success: false, message: "Đã có một lệnh dọn nhật ký đang chờ máy xử lý" }
  }

  const result = await sendTrackedCommand({
    device,
    command: { cmd: "cleanlog" },
  })
  await logAction("DELETE", "DEVICE", device.id, {
    action: "SAFE_CLEAN_LOG_REQUEST",
    usedLogCount: device.usedLogCount,
    unsyncedLogCount: device.unsyncedLogCount,
  })
  revalidatePath("/devices")
  return result
}
