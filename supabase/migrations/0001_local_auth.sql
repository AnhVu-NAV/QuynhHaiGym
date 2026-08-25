ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_hash" text,
  ADD COLUMN IF NOT EXISTS "is_locked" boolean DEFAULT false NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique_lower"
  ON "users" (lower("email"))
  WHERE "email" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique_lower"
  ON "users" (lower("username"))
  WHERE "username" IS NOT NULL;
