create index if not exists members_status_created_idx
  on members (status, created_at);

create index if not exists subscriptions_status_end_date_idx
  on subscriptions (status, end_date);

create index if not exists check_ins_time_idx
  on check_ins (check_in_time);

create index if not exists check_ins_member_time_idx
  on check_ins (member_id, check_in_time);

create index if not exists transactions_date_idx
  on transactions (transaction_date);

create index if not exists transactions_member_date_idx
  on transactions (member_id, transaction_date);

create index if not exists trainers_active_created_idx
  on trainers (is_active, created_at);

create index if not exists classes_active_created_idx
  on classes (is_active, created_at);

create index if not exists class_sessions_start_time_idx
  on class_sessions (start_time);

create index if not exists class_bookings_session_status_idx
  on class_bookings (session_id, status);

create index if not exists audit_logs_created_at_idx
  on audit_logs (created_at);

create index if not exists device_events_created_at_idx
  on device_events (created_at);
