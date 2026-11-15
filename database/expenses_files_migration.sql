-- ============================================================
-- Migration: فواتير المصاريف
-- يضيف عمود files على جدول expenses لحفظ صور/ملفات الفواتير.
-- آمن لإعادة التشغيل، ولا يغيّر أي بيانات موجودة.
-- ============================================================
alter table expenses add column if not exists files jsonb default '[]'::jsonb;

-- للرجوع (يحذف العمود وروابط الفواتير المحفوظة فيه):
-- alter table expenses drop column if exists files;
