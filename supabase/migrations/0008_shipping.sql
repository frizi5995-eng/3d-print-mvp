-- M34: shipping/tracking. Purely additive. No carrier API integration —
-- admin enters these manually.

alter table manufacturing_requests
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists shipped_at timestamptz,
  add column if not exists estimated_delivery_at timestamptz,
  add column if not exists delivered_at timestamptz;
