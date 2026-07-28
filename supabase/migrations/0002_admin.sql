-- Milestone 4 (admin): the request pipeline, status enum, and quote_token
-- already existed from 0001_init.sql. The only gap for admin-prepared
-- quotes is an expiry column alongside the existing token.
alter table manufacturing_requests
  add column if not exists quote_expires_at timestamptz;
