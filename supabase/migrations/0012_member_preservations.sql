CREATE TABLE IF NOT EXISTS "member_preservations" (
  "id" serial PRIMARY KEY,
  "member_id" integer NOT NULL REFERENCES "members"("id"),
  "subscription_id" integer NOT NULL REFERENCES "subscriptions"("id"),
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "credited_days" integer NOT NULL,
  "reason" text NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'active',
  "created_by" varchar(255) REFERENCES "users"("id") ON DELETE SET NULL,
  "idempotency_key" varchar(100) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "member_preservations_date_order_check" CHECK ("end_date" >= "start_date"),
  CONSTRAINT "member_preservations_days_check" CHECK ("credited_days" > 0),
  CONSTRAINT "member_preservations_status_check" CHECK ("status" IN ('active', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_preservations_idempotency_unique"
  ON "member_preservations" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "member_preservations_member_dates_idx"
  ON "member_preservations" ("member_id", "status", "start_date", "end_date");
CREATE INDEX IF NOT EXISTS "member_preservations_subscription_idx"
  ON "member_preservations" ("subscription_id");
