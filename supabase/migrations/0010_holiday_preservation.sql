ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "base_end_date" timestamp;

UPDATE "subscriptions"
SET "base_end_date" = "end_date"
WHERE "base_end_date" IS NULL;

ALTER TABLE "subscriptions"
  ALTER COLUMN "base_end_date" SET NOT NULL;

CREATE TABLE IF NOT EXISTS "gym_holidays" (
  "id" serial PRIMARY KEY,
  "name" varchar(255) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "gym_holidays_date_order_check" CHECK ("end_date" >= "start_date")
);

CREATE INDEX IF NOT EXISTS "gym_holidays_start_end_idx"
  ON "gym_holidays" ("start_date", "end_date");
