-- ============================================================
-- Rich-text editor migration — step 2: drop the now-unused
-- text_align column.
--
-- Run ONLY after:
--   1. 001_rich_text_content.sql has been run and every row's
--      alignment was preserved as inline HTML styling.
--   2. The new app code (which never reads or writes text_align)
--      is deployed and verified in production.
-- ============================================================

ALTER TABLE content_items DROP COLUMN text_align;
