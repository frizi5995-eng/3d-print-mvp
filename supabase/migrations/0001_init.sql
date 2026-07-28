-- MVP schema: manufacturing request pipeline.
-- All access goes through the server using the service role key, which
-- bypasses RLS by design. RLS is enabled with no policies on every table
-- so the anon key (used only in the browser) cannot read or write anything
-- directly, even if it leaks.

create extension if not exists pgcrypto;

create type request_status as enum (
  'new',
  'checking',
  'waiting_for_partner',
  'quote_ready',
  'quote_sent',
  'accepted',
  'declined',
  'manufacturing',
  'shipped',
  'completed'
);

create table models (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  storage_path text not null,
  file_type text not null check (file_type in ('stl', 'obj', '3mf')),
  file_size bigint not null check (file_size > 0),
  width numeric check (width > 0),
  height numeric check (height > 0),
  depth numeric check (depth > 0),
  created_at timestamptz not null default now()
);

create table manufacturing_requests (
  id uuid primary key default gen_random_uuid(),
  reference_number bigint generated always as identity (start with 1001) unique,

  status request_status not null default 'new',

  customer_name text not null,
  customer_email text not null,
  customer_phone text,

  country text not null,
  postal_code text not null,

  quantity int not null default 1 check (quantity > 0),
  material text not null default 'PLA',
  color text not null,
  desired_size text,
  notes text,

  model_id uuid not null references models(id),

  manufacturer_name text,
  production_cost numeric(12, 2) check (production_cost >= 0),
  production_shipping_cost numeric(12, 2) check (production_shipping_cost >= 0),
  other_cost numeric(12, 2) check (other_cost >= 0),

  customer_manufacturing_price numeric(12, 2) check (customer_manufacturing_price >= 0),
  customer_shipping_price numeric(12, 2) check (customer_shipping_price >= 0),

  decline_reason text,
  decline_reason_other text,

  quote_token text unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index manufacturing_requests_status_idx on manufacturing_requests (status);
create index manufacturing_requests_created_at_idx on manufacturing_requests (created_at desc);

create table status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references manufacturing_requests(id) on delete cascade,
  status request_status not null,
  created_at timestamptz not null default now()
);

create index status_history_request_id_idx on status_history (request_id);

-- Keep updated_at current on every row change.
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger manufacturing_requests_set_updated_at
  before update on manufacturing_requests
  for each row execute function set_updated_at();

-- Record every status a request passes through, including its initial one.
create function record_status_history() returns trigger as $$
begin
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into status_history (request_id, status) values (new.id, new.status);
  end if;
  return new;
end;
$$ language plpgsql;

create trigger manufacturing_requests_record_status_history
  after insert or update on manufacturing_requests
  for each row execute function record_status_history();

alter table models enable row level security;
alter table manufacturing_requests enable row level security;
alter table status_history enable row level security;

-- Private bucket for uploaded models. Never made public; served only via
-- short-lived signed URLs generated server-side.
insert into storage.buckets (id, name, public)
values ('models', 'models', false)
on conflict (id) do nothing;
