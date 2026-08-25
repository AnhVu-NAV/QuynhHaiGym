CREATE TABLE IF NOT EXISTS "failed_check_ins" (
  "id" serial PRIMARY KEY,
  "member_id" integer REFERENCES "members"("id") ON DELETE CASCADE,
  "device_id" integer REFERENCES "devices"("id") ON DELETE SET NULL,
  "enroll_id" integer,
  "attempted_at" timestamp DEFAULT now() NOT NULL,
  "source" varchar(30) DEFAULT 'ai26' NOT NULL,
  "reason" varchar(50) NOT NULL,
  "message" text,
  "device_event_key" varchar(255)
);

CREATE UNIQUE INDEX IF NOT EXISTS "failed_check_ins_device_event_key_unique"
  ON "failed_check_ins" ("device_event_key");

CREATE INDEX IF NOT EXISTS "failed_check_ins_member_time_idx"
  ON "failed_check_ins" ("member_id", "attempted_at");

CREATE INDEX IF NOT EXISTS "failed_check_ins_reason_time_idx"
  ON "failed_check_ins" ("reason", "attempted_at");

-- Backfill AI26 recognition records which never produced a successful
-- check-in. Device time is local Vietnam time, while application timestamps
-- are persisted as UTC in timestamp columns.
WITH ai26_logs AS (
  SELECT
    event.id,
    event.device_id,
    substring(event.event_key FROM 5) AS device_event_key,
    CASE
      WHEN event.payload->>'enrollid' ~ '^[0-9]+$'
        THEN (event.payload->>'enrollid')::integer
      ELSE NULL
    END AS enroll_id,
    CASE
      WHEN event.payload->>'time' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
        THEN (event.payload->>'time')::timestamp - interval '7 hours'
      ELSE event.created_at
    END AS attempted_at
  FROM "device_events" event
  WHERE event.event_type = 'log'
    AND event.event_key LIKE 'log:%'
)
INSERT INTO "failed_check_ins" (
  "member_id",
  "device_id",
  "enroll_id",
  "attempted_at",
  "source",
  "reason",
  "message",
  "device_event_key"
)
SELECT
  mapping.member_id,
  log.device_id,
  log.enroll_id,
  log.attempted_at,
  'ai26',
  CASE
    WHEN mapping.id IS NULL THEN 'unmapped_face'
    WHEN member.status <> 'active' THEN 'member_inactive'
    ELSE 'subscription_expired'
  END,
  CASE
    WHEN mapping.id IS NULL THEN 'Khuôn mặt chưa liên kết với hội viên'
    WHEN member.status <> 'active' THEN 'Hội viên đang bị khóa'
    ELSE 'Gói tập đã hết hạn hoặc chưa có hiệu lực'
  END,
  log.device_event_key
FROM ai26_logs log
LEFT JOIN "device_member_mappings" mapping
  ON mapping.device_id = log.device_id
  AND mapping.enroll_id = log.enroll_id
LEFT JOIN "members" member ON member.id = mapping.member_id
LEFT JOIN "check_ins" successful
  ON successful.device_event_key = log.device_event_key
WHERE successful.id IS NULL
ON CONFLICT ("device_event_key") DO NOTHING;
