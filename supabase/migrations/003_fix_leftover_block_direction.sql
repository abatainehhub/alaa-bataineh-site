-- ============================================================
-- One-off fix: one row (content_items.title, id below) still carries
-- the old block-level `dir="ltr"` from testing the pre-rebuild
-- direction toggle (now replaced by an inline mark — see
-- src/lib/directionMark.js). A full-table scan confirmed this is the
-- ONLY row/field left in this state; description and main_content
-- across all rows are clean.
--
-- The stored value is:
--   <p dir="ltr" style="text-align: center;">الاقتصاد السلوكي : ...</p>
--   <p dir="ltr" style="text-align: right;"></p>   <- stray empty trailing paragraph
--
-- This is almost certainly test residue (an entire Arabic title
-- forced LTR, plus a leftover empty paragraph) rather than
-- intentional formatting, so this drops the block-level dir and the
-- empty trailing paragraph, keeping the center alignment. If the LTR
-- effect on this title was actually intentional, don't run this —
-- re-select the title text in the editor and apply the new inline
-- LTR mark instead, which is now the supported way to do it.
-- ============================================================

UPDATE content_items
SET title = '<p style="text-align: center;">الاقتصاد السلوكي : دراسة تحليلة للشراء القهري والتقليد الاستهلاكي ومحدداتها النفسية</p>'
WHERE id = 'd30271cb-3e8d-44b7-8fc2-0bb87060aeaa'
  AND title = '<p dir="ltr" style="text-align: center;">الاقتصاد السلوكي : دراسة تحليلة للشراء القهري والتقليد الاستهلاكي ومحدداتها النفسية</p><p dir="ltr" style="text-align: right;"></p>';
