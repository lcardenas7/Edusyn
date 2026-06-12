-- Classroom: add publishedAt to ClassroomActivity
-- Tracks the exact moment an activity was published (immediate or via scheduled cron).
-- 100% additive. Nullable column — no DEFAULT needed. Zero downtime.

ALTER TABLE "ClassroomActivity"
  ADD COLUMN "publishedAt" TIMESTAMP(3);
