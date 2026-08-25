import { sql } from "drizzle-orm"

export type FastLogRow = {
  device_id: number
  member_id: number | null
  member_status: string | null
  has_active_subscription: boolean
}

export type FastLogQueryInput = {
  serialNumber: string
  remoteAddress: string | null
  now: Date
  checkInAt: Date
  enrollId: number
  eventKey: string
  sanitizedRecord: string
  verificationMode: number | null
  temperature: number | null
}

export function buildAi26FastLogQuery(input: FastLogQueryInput) {
  return sql`
    WITH device_row AS (
      INSERT INTO devices (
        serial_number, name, status, last_seen_at, last_ip,
        last_log_synced_at, created_at, updated_at
      ) VALUES (
        ${input.serialNumber}, ${`AI26 ${input.serialNumber}`}, 'online', ${input.now},
        ${input.remoteAddress}, ${input.now}, ${input.now}, ${input.now}
      )
      ON CONFLICT (serial_number) DO UPDATE SET
        status = 'online',
        last_seen_at = EXCLUDED.last_seen_at,
        last_ip = COALESCE(EXCLUDED.last_ip, devices.last_ip),
        last_log_synced_at = EXCLUDED.last_log_synced_at,
        updated_at = EXCLUDED.updated_at
      RETURNING id
    ), resolved AS (
      SELECT
        device_row.id AS device_id,
        mapped.member_id,
        member.status AS member_status,
        COALESCE(EXISTS (
          SELECT 1
          FROM subscriptions subscription
          WHERE subscription.member_id = mapped.member_id
            AND subscription.status = 'active'
            AND subscription.start_date <= ${input.checkInAt}
            AND subscription.end_date >= ${input.checkInAt}
        ), false) AS has_active_subscription
      FROM device_row
      LEFT JOIN LATERAL (
        SELECT mapping.member_id
        FROM device_member_mappings mapping
        WHERE mapping.device_id = device_row.id
          AND mapping.enroll_id = ${input.enrollId}
        LIMIT 1
      ) mapped ON true
      LEFT JOIN members member ON member.id = mapped.member_id
    ), checkin_write AS (
      INSERT INTO check_ins (
        member_id, check_in_time, source, device_id, device_event_key,
        verification_mode, temperature
      )
      SELECT
        member_id, ${input.checkInAt}, 'ai26', device_id, ${input.eventKey},
        ${input.verificationMode}, ${input.temperature}
      FROM resolved
      WHERE member_id IS NOT NULL
        AND member_status = 'active'
        AND has_active_subscription
      ON CONFLICT (device_event_key) DO NOTHING
      RETURNING id
    ), failed_write AS (
      INSERT INTO failed_check_ins (
        member_id, device_id, enroll_id, attempted_at, source,
        reason, message, device_event_key
      )
      SELECT
        member_id, device_id, ${input.enrollId}, ${input.checkInAt}, 'ai26',
        CASE
          WHEN member_id IS NULL THEN 'unmapped_face'
          WHEN member_status <> 'active' THEN 'member_inactive'
          ELSE 'subscription_expired'
        END,
        CASE
          WHEN member_id IS NULL THEN 'Khuôn mặt chưa liên kết với hội viên'
          WHEN member_status <> 'active' THEN 'Hội viên đang bị khóa'
          ELSE 'Gói tập đã hết hạn hoặc chưa có hiệu lực'
        END,
        ${input.eventKey}
      FROM resolved
      WHERE member_id IS NULL
        OR member_status <> 'active'
        OR NOT has_active_subscription
      ON CONFLICT (device_event_key) DO NOTHING
      RETURNING id
    ), audit_write AS (
      INSERT INTO device_events (device_id, event_type, event_key, payload, created_at)
      SELECT device_id, 'log', ${`log:${input.eventKey}`}, ${input.sanitizedRecord}::jsonb, ${input.now}
      FROM resolved
      ON CONFLICT (event_key) DO NOTHING
      RETURNING id
    )
    SELECT device_id, member_id, member_status, has_active_subscription
    FROM resolved
  `
}
