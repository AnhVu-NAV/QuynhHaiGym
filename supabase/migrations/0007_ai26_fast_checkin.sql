CREATE INDEX IF NOT EXISTS "subscriptions_member_validity_idx"
  ON "subscriptions" ("member_id", "status", "start_date", "end_date");
