-- M33: production operations tracking. Purely additive.

alter table manufacturing_requests
  add column if not exists production_started_at timestamptz,
  add column if not exists estimated_completion_at timestamptz,
  add column if not exists actual_completion_at timestamptz,
  add column if not exists production_notes text,
  add column if not exists external_supplier_reference text;
