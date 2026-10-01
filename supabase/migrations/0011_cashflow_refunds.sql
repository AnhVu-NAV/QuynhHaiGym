ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp,
  ADD COLUMN IF NOT EXISTS "cancelled_by" varchar(255),
  ADD COLUMN IF NOT EXISTS "cancellation_reason" text;

ALTER TABLE "subscriptions"
  DROP CONSTRAINT IF EXISTS "subscriptions_cancelled_by_users_id_fk";
ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_cancelled_by_users_id_fk"
  FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "transactions"
  ALTER COLUMN "member_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "subscription_id" integer,
  ADD COLUMN IF NOT EXISTS "direction" varchar(20) NOT NULL DEFAULT 'income',
  ADD COLUMN IF NOT EXISTS "category" varchar(50) NOT NULL DEFAULT 'membership',
  ADD COLUMN IF NOT EXISTS "status" varchar(30) NOT NULL DEFAULT 'posted',
  ADD COLUMN IF NOT EXISTS "note" text,
  ADD COLUMN IF NOT EXISTS "refund_of_transaction_id" integer,
  ADD COLUMN IF NOT EXISTS "created_by" varchar(255);

ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_subscription_id_subscriptions_id_fk";
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_subscription_id_subscriptions_id_fk"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL;
ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_refund_of_transaction_id_transactions_id_fk";
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_refund_of_transaction_id_transactions_id_fk"
  FOREIGN KEY ("refund_of_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL;
ALTER TABLE "transactions"
  DROP CONSTRAINT IF EXISTS "transactions_created_by_users_id_fk";
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_positive_amount_check";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_positive_amount_check" CHECK ("amount" > 0);
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_direction_check";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_direction_check" CHECK ("direction" IN ('income', 'expense'));
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_status_check";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_status_check" CHECK ("status" IN ('posted', 'voided'));

UPDATE "transactions"
SET "direction" = 'income',
    "category" = 'membership',
    "status" = 'posted'
WHERE "type" IN ('registration', 'renewal');

WITH candidates AS (
  SELECT
    t.id AS transaction_id,
    s.id AS subscription_id,
    row_number() OVER (
      PARTITION BY t.id
      ORDER BY abs(extract(epoch FROM (s.created_at - t.transaction_date))), s.id DESC
    ) AS match_rank
  FROM transactions t
  JOIN subscriptions s ON s.member_id = t.member_id
  JOIN membership_packages p ON p.id = s.package_id AND p.price = t.amount
  WHERE t.subscription_id IS NULL
    AND t.type IN ('registration', 'renewal')
    AND abs(extract(epoch FROM (s.created_at - t.transaction_date))) <= 600
)
UPDATE transactions t
SET subscription_id = candidates.subscription_id
FROM candidates
WHERE t.id = candidates.transaction_id
  AND candidates.match_rank = 1
  AND t.subscription_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "transactions_refund_of_unique"
  ON "transactions" ("refund_of_transaction_id")
  WHERE "refund_of_transaction_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "transactions_direction_date_idx"
  ON "transactions" ("direction", "transaction_date");
CREATE INDEX IF NOT EXISTS "transactions_category_date_idx"
  ON "transactions" ("category", "transaction_date");
CREATE INDEX IF NOT EXISTS "transactions_subscription_idx"
  ON "transactions" ("subscription_id");
