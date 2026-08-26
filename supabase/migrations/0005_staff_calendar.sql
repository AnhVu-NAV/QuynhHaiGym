ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "phone_number" varchar(20),
  ADD COLUMN IF NOT EXISTS "job_title" varchar(100);

ALTER TABLE "trainers"
  ADD COLUMN IF NOT EXISTS "email" varchar(255),
  ADD COLUMN IF NOT EXISTS "employment_type" varchar(30) DEFAULT 'full_time' NOT NULL,
  ADD COLUMN IF NOT EXISTS "max_concurrent_clients" integer DEFAULT 1 NOT NULL;

ALTER TABLE "pt_sessions"
  ADD COLUMN IF NOT EXISTS "series_id" varchar(100);

CREATE INDEX IF NOT EXISTS "pt_sessions_trainer_time_idx"
  ON "pt_sessions" ("trainer_id", "start_time", "end_time");

CREATE INDEX IF NOT EXISTS "pt_sessions_series_idx"
  ON "pt_sessions" ("series_id");
