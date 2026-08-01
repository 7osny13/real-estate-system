-- ============================================================
-- Migration: Flexible Payment System
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================

-- 1) New table: free-form payments ledger.
--    This is ADDITIVE — it does not touch the existing JSONB
--    installment schedule stored in sales.payments, which keeps
--    working exactly as before.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references sales(id) on delete cascade,
  amount numeric not null,
  date date not null,
  due_date date,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_payments_sale_id on payments(sale_id);

-- 2) sales table additions
-- down_payment already exists in this app (used by the current installment
-- flow) — this is a no-op if so, and a safety net if it's somehow missing.
alter table sales add column if not exists down_payment numeric default 0;

-- NEW column, intentionally NOT named "payment_type": that column already
-- exists on sales with values 'cash' / 'installment' and drives the current
-- fixed-installment-schedule UI. Reusing it with a different value domain
-- ('free' / 'installments' / 'both') would break that existing logic.
-- payment_mode is a separate, independent flag just for the new flexible
-- payment page: it only labels the badge and controls whether the
-- "تاريخ الاستحقاق" field appears on the "إضافة دفعة" form.
alter table sales add column if not exists payment_mode text default 'free';
-- allowed values: 'free' | 'installments' | 'both'

-- 3) Row Level Security
-- This app calls Supabase directly from the browser with the anon key, so
-- whatever RLS setup your other tables (projects/sales/expenses) currently
-- use, mirror it here. If those tables have RLS disabled, do nothing further.
-- If they have RLS enabled with a permissive policy, uncomment and run:
--
-- alter table payments enable row level security;
-- create policy "allow all on payments" on payments
--   for all using (true) with check (true);
