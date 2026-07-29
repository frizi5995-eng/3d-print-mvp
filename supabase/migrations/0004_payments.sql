-- Stripe invoicing/payments. Purely additive: no existing column, table,
-- enum, or trigger is modified, renamed, or dropped.
--
-- Payment status is deliberately a SEPARATE column from the existing
-- `status` (request/operational status) — a request being "accepted" and a
-- payment being "paid" are different facts tracked independently. See
-- src/app/admin/(protected)/requests/[id]/actions.ts, which blocks the
-- accepted -> manufacturing transition unless payment_status = 'paid'.

create type payment_status as enum (
  'unpaid',
  'invoice_sent',
  'paid',
  'payment_failed',
  'refunded'
);

alter table manufacturing_requests
  add column if not exists payment_status payment_status not null default 'unpaid',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_invoice_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

-- Looked up by the webhook handler (Stripe sends the invoice id, we need to
-- find the request it belongs to) and by admin/create-invoice's idempotency
-- guard (is stripe_invoice_id already set?).
create unique index if not exists manufacturing_requests_stripe_invoice_id_idx
  on manufacturing_requests (stripe_invoice_id) where stripe_invoice_id is not null;
create index if not exists manufacturing_requests_payment_status_idx
  on manufacturing_requests (payment_status);

-- Webhook idempotency: Stripe may deliver the same event more than once
-- (retries, duplicate delivery). Every event id is inserted here before
-- being processed; a webhook handler that sees a conflict on insert knows
-- it has already handled this exact event and skips reprocessing.
create table if not exists stripe_webhook_events (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now()
);

alter table stripe_webhook_events enable row level security;
