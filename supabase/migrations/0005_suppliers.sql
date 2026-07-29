-- M26: supplier management. Purely additive.
-- technologies/materials are text[] (not normalized junction tables) —
-- small, admin-curated lists; over-normalizing them buys nothing at this
-- scale and just adds joins everywhere they're displayed.

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  website text,
  contact_email text,
  contact_phone text,
  active boolean not null default true,
  notes text,
  technologies text[] not null default '{}',
  materials text[] not null default '{}',
  -- null/'manual' = no API integration; otherwise a provider key like
  -- 'sculpteo' matched against src/lib/suppliers/providers/*.
  api_provider text,
  api_enabled boolean not null default false,
  preferred boolean not null default false,
  -- 0-10, admin-entered operational trust score. Nullable: no opinion yet.
  reliability_score numeric(3, 1) check (reliability_score >= 0 and reliability_score <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_active_idx on suppliers (active);
create index if not exists suppliers_country_idx on suppliers (country);

create trigger suppliers_set_updated_at
  before update on suppliers
  for each row execute function set_updated_at();

alter table suppliers enable row level security;
