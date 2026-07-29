-- Milestones 11-19: customer accounts, anti-spam, admin operations tooling.
-- Purely additive: no existing column, table, enum, or trigger is modified,
-- renamed, or dropped. Existing anonymous requests remain valid as-is.

-- Customer ownership. Nullable — existing and future anonymous requests are
-- unaffected. Set server-side only from the authenticated session; never
-- trust a user id supplied by the browser (see src/app/(site)/quote/actions.ts).
-- on delete set null: if a Supabase Auth user is ever deleted, their past
-- requests survive as anonymous rather than being destroyed.
alter table manufacturing_requests
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null;

create index if not exists manufacturing_requests_customer_user_id_idx
  on manufacturing_requests (customer_user_id);

-- Case-insensitive lookup, used to (a) claim anonymous requests on
-- login/register and (b) group guest requests for operational display in
-- /admin/customers. Grouping by email is NOT treated as proof of identity.
create index if not exists manufacturing_requests_customer_email_lower_idx
  on manufacturing_requests (lower(customer_email));

-- Anti-spam. submission_ip_hash stores a hash, never a raw IP (see
-- src/lib/rate-limit.ts). is_suspicious/spam_reason support manual admin
-- review; suspicious requests are flagged, never auto-deleted.
alter table manufacturing_requests
  add column if not exists submission_ip_hash text,
  add column if not exists is_suspicious boolean not null default false,
  add column if not exists spam_reason text;

create index if not exists manufacturing_requests_submission_ip_hash_idx
  on manufacturing_requests (submission_ip_hash);
create index if not exists manufacturing_requests_is_suspicious_idx
  on manufacturing_requests (is_suspicious) where is_suspicious;

-- Internal admin operations. Never selected by any customer-facing query.
alter table manufacturing_requests
  add column if not exists internal_notes text,
  add column if not exists tags text[] not null default '{}';

-- Lightweight admin audit log (pricing changed, quote prepared/resent,
-- status changed, note updated, flagged suspicious, expiry extended, ...).
-- Same posture as every other table: RLS enabled, no policies, reached
-- only through the server-side service-role client.
create table if not exists admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null,
  request_id uuid references manufacturing_requests(id) on delete set null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_log_created_at_idx
  on admin_activity_log (created_at desc);
create index if not exists admin_activity_log_request_id_idx
  on admin_activity_log (request_id);

alter table admin_activity_log enable row level security;

-- Runtime business configuration (quote validity days, margin warning
-- threshold, support email, ...). Never secrets — integration keys stay in
-- environment variables, never this table. Key/value so new settings don't
-- need a schema migration each time.
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;
