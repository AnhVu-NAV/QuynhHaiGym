ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "log_capacity" integer,
  ADD COLUMN IF NOT EXISTS "used_log_count" integer,
  ADD COLUMN IF NOT EXISTS "unsynced_log_count" integer,
  ADD COLUMN IF NOT EXISTS "log_stats_at" timestamp,
  ADD COLUMN IF NOT EXISTS "last_log_synced_at" timestamp,
  ADD COLUMN IF NOT EXISTS "last_log_cleanup_at" timestamp;
