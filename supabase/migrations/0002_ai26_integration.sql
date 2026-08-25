CREATE TABLE IF NOT EXISTS "devices" (
  "id" serial PRIMARY KEY,
  "serial_number" varchar(100) NOT NULL,
  "name" varchar(255) NOT NULL,
  "model_name" varchar(100),
  "firmware" varchar(255),
  "status" varchar(30) DEFAULT 'offline' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_seen_at" timestamp,
  "last_ip" varchar(100),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "devices_serial_number_unique"
  ON "devices" ("serial_number");
CREATE INDEX IF NOT EXISTS "devices_status_idx"
  ON "devices" ("status");

CREATE TABLE IF NOT EXISTS "device_member_mappings" (
  "id" serial PRIMARY KEY,
  "device_id" integer NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
  "member_id" integer NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "enroll_id" integer NOT NULL,
  "face_status" varchar(30) DEFAULT 'not_registered' NOT NULL,
  "face_enrolled_at" timestamp,
  "last_synced_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_member_unique"
  ON "device_member_mappings" ("device_id", "member_id");
CREATE UNIQUE INDEX IF NOT EXISTS "device_enroll_id_unique"
  ON "device_member_mappings" ("device_id", "enroll_id");
CREATE INDEX IF NOT EXISTS "device_member_face_status_idx"
  ON "device_member_mappings" ("face_status");

CREATE TABLE IF NOT EXISTS "device_commands" (
  "id" serial PRIMARY KEY,
  "device_id" integer NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
  "member_id" integer REFERENCES "members"("id") ON DELETE SET NULL,
  "command" varchar(50) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" varchar(30) DEFAULT 'pending' NOT NULL,
  "error" text,
  "sent_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "device_commands_device_status_idx"
  ON "device_commands" ("device_id", "status");
CREATE INDEX IF NOT EXISTS "device_commands_created_at_idx"
  ON "device_commands" ("created_at");

CREATE TABLE IF NOT EXISTS "device_events" (
  "id" serial PRIMARY KEY,
  "device_id" integer NOT NULL REFERENCES "devices"("id") ON DELETE CASCADE,
  "event_type" varchar(50) NOT NULL,
  "event_key" varchar(255),
  "payload" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "device_events_event_key_unique"
  ON "device_events" ("event_key");
CREATE INDEX IF NOT EXISTS "device_events_device_created_idx"
  ON "device_events" ("device_id", "created_at");

ALTER TABLE "check_ins"
  ADD COLUMN IF NOT EXISTS "source" varchar(30) DEFAULT 'web' NOT NULL,
  ADD COLUMN IF NOT EXISTS "device_id" integer REFERENCES "devices"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "device_event_key" varchar(255),
  ADD COLUMN IF NOT EXISTS "verification_mode" integer,
  ADD COLUMN IF NOT EXISTS "temperature" double precision;

CREATE UNIQUE INDEX IF NOT EXISTS "check_ins_device_event_key_unique"
  ON "check_ins" ("device_event_key");
CREATE INDEX IF NOT EXISTS "check_ins_device_time_idx"
  ON "check_ins" ("device_id", "check_in_time");
