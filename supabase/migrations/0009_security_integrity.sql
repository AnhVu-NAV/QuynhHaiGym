alter table members
  add column if not exists public_token uuid;

update members
set public_token = gen_random_uuid()
where public_token is null;

alter table members
  alter column public_token set default gen_random_uuid(),
  alter column public_token set not null;

create unique index if not exists members_public_token_unique
  on members (public_token);

alter table users
  add column if not exists session_version integer not null default 0;

alter table transactions
  add column if not exists idempotency_key varchar(100);

create unique index if not exists transactions_idempotency_key_unique
  on transactions (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists class_bookings_session_member_unique
  on class_bookings (session_id, member_id);

create table if not exists rate_limits (
  key varchar(64) primary key,
  count integer not null default 1,
  window_started_at timestamp not null default now(),
  expires_at timestamp not null
);

create index if not exists rate_limits_expires_at_idx
  on rate_limits (expires_at);
