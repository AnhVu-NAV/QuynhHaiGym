import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

dotenv.config({ path: ".env" })

type Row = Record<string, unknown>

function vietnamTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || ""

  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is missing")

  const sql = neon(databaseUrl)
  const devices = await sql`
    SELECT
      id,
      serial_number,
      status,
      is_active,
      last_seen_at,
      last_seen_at >= (now() AT TIME ZONE 'UTC') - interval '2 minutes' AS recent
    FROM devices
    WHERE is_active = true
    ORDER BY last_seen_at DESC NULLS LAST
    LIMIT 1
  ` as Row[]
  const device = devices[0]
  if (!device) throw new Error("Không tìm thấy AI26 đang hoạt động")

  const recent = device.recent === true
  if (!recent) throw new Error("AI26 không gửi heartbeat trong 2 phút gần đây")

  const existing = await sql`
    SELECT count(*)::int AS count
    FROM device_commands
    WHERE device_id = ${Number(device.id)}
      AND status IN ('pending', 'sent')
  ` as Row[]
  if (Number(existing[0]?.count) > 0) {
    throw new Error("Máy còn lệnh đang chờ; không chèn thêm để tránh đảo thứ tự")
  }

  const expiredMappings = await sql`
    SELECT mapping.member_id, mapping.enroll_id
    FROM device_member_mappings mapping
    JOIN members member ON member.id = mapping.member_id
    WHERE mapping.device_id = ${Number(device.id)}
      AND mapping.face_status = 'registered'
      AND NOT (
        member.status = 'active'
        AND EXISTS (
          SELECT 1
          FROM subscriptions subscription
          WHERE subscription.member_id = member.id
            AND subscription.status = 'active'
            AND subscription.start_date <= now()
            AND subscription.end_date >= now()
        )
      )
    ORDER BY mapping.id
    LIMIT 1
  ` as Row[]

  const commands: Array<{ command: string; payload: Record<string, unknown>; memberId?: number }> = [
    { command: "getdevinfo", payload: { cmd: "getdevinfo" } },
    { command: "getuserlist", payload: { cmd: "getuserlist", stn: true } },
    { command: "settime", payload: { cmd: "settime", cloudtime: vietnamTime() } },
  ]

  const expired = expiredMappings[0]
  if (expired) {
    commands.push({
      command: "enableuser",
      memberId: Number(expired.member_id),
      payload: {
        cmd: "enableuser",
        enrollid: Number(expired.enroll_id),
        enflag: 1,
      },
    })
  }

  const commandIds: number[] = []
  for (const command of commands) {
    const inserted = await sql`
      INSERT INTO device_commands (device_id, member_id, command, payload, status)
      VALUES (
        ${Number(device.id)},
        ${command.memberId ?? null},
        ${command.command},
        ${JSON.stringify(command.payload)}::jsonb,
        'pending'
      )
      RETURNING id
    ` as Row[]
    commandIds.push(Number(inserted[0].id))
  }

  const deadline = Date.now() + 120_000
  let statuses: Row[] = []
  while (Date.now() < deadline) {
    statuses = await sql`
      SELECT id, command, status, error
      FROM device_commands
      WHERE id = ANY(${commandIds}::int[])
      ORDER BY id
    ` as Row[]
    if (statuses.length === commandIds.length
      && statuses.every((row) => ["completed", "failed", "cancelled"].includes(String(row.status)))) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 4_000))
  }

  const incomplete = statuses.filter((row) => row.status !== "completed")
  if (incomplete.length > 0) {
    throw new Error(`Lệnh chưa hoàn tất: ${incomplete.map((row) => `${row.command}:${row.status}`).join(", ")}`)
  }

  const sensitive = await sql`
    SELECT count(*)::int AS count
    FROM device_events
    WHERE payload ?| ARRAY[
      'wlan_pwd',
      'webserver_pwd',
      'qrcode_pwd',
      'excel_password',
      'commpassword',
      'cpucard_key'
    ]::text[]
  ` as Row[]

  const access = expired
    ? await sql`
        SELECT access_enabled, last_access_synced_at
        FROM device_member_mappings
        WHERE device_id = ${Number(device.id)}
          AND member_id = ${Number(expired.member_id)}
      ` as Row[]
    : []

  console.log(JSON.stringify({
    device: {
      serialNumber: device.serial_number,
      status: device.status,
      recentHeartbeat: recent,
    },
    commands: statuses.map((row) => ({ command: row.command, status: row.status })),
    expiredRecognition: access[0] || "no-expired-enrolled-member",
    sensitiveEventRows: Number(sensitive[0]?.count || 0),
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
