-- ============================================================
-- Migration: جدول الوحدات
-- يضيف أعمدة النموذج والحجز وربط البيعة على جدول units الموجود.
-- آمن لإعادة التشغيل، ولا يغيّر أي بيانات موجودة.
-- ============================================================
alter table units add column if not exists model           text    default '';
alter table units add column if not exists reserved_phone  text    default '';
alter table units add column if not exists reserved_amount numeric default 0;
alter table units add column if not exists reserved_date   date;
alter table units add column if not exists sale_id         text;

create index if not exists idx_units_project_id on units(project_id);

-- للرجوع:
-- drop index if exists idx_units_project_id;
-- alter table units drop column if exists model, drop column if exists reserved_phone,
--   drop column if exists reserved_amount, drop column if exists reserved_date, drop column if exists sale_id;
