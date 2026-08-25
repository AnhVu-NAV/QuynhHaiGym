ALTER TABLE "device_member_mappings"
  ADD COLUMN IF NOT EXISTS "access_enabled" boolean,
  ADD COLUMN IF NOT EXISTS "last_access_synced_at" timestamp;
