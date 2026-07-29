-- M27: multiple supplier offers per request. Purely additive.

create table if not exists supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references manufacturing_requests(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete restrict,

  manufacturing_cost numeric(12, 2) not null check (manufacturing_cost >= 0),
  supplier_shipping_cost numeric(12, 2) not null default 0 check (supplier_shipping_cost >= 0),
  other_cost numeric(12, 2) not null default 0 check (other_cost >= 0),
  currency text not null default 'EUR',

  lead_time_days_min int check (lead_time_days_min >= 0),
  lead_time_days_max int check (lead_time_days_max >= 0),
  valid_until timestamptz,

  -- manual: admin typed it in. api_estimate: an unconfirmed API quote
  -- (never presented to a customer as final). api_confirmed: a real,
  -- confirmed quote from a supplier API.
  source text not null check (source in ('manual', 'api_estimate', 'api_confirmed')),
  status text not null default 'active' check (status in ('active', 'rejected', 'expired')),
  external_quote_id text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_quotes_request_id_idx on supplier_quotes (request_id);
create index if not exists supplier_quotes_supplier_id_idx on supplier_quotes (supplier_id);

create trigger supplier_quotes_set_updated_at
  before update on supplier_quotes
  for each row execute function set_updated_at();

alter table supplier_quotes enable row level security;

-- Which supplier offer (if any) the admin has picked for this request.
-- Selecting a quote never triggers ordering/payment/anything external —
-- see src/app/admin/(protected)/requests/[id]/supplier-actions.ts.
alter table manufacturing_requests
  add column if not exists selected_supplier_quote_id uuid references supplier_quotes(id) on delete set null;

create index if not exists manufacturing_requests_selected_supplier_quote_id_idx
  on manufacturing_requests (selected_supplier_quote_id);
