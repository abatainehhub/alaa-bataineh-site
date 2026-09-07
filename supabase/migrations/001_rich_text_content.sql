-- ============================================================
-- Rich-text editor migration — step 1: wrap existing plain-text
-- content in HTML so it renders correctly under the new TipTap
-- editor (which expects HTML paragraphs, not bare text).
--
-- Preserves each row's current `text_align` as inline styling on
-- main_content (title/description never had per-item alignment,
-- so they're just wrapped plain). Line breaks become <br>.
--
-- Safe to re-run: only touches rows that don't already look like
-- HTML (i.e. haven't been migrated yet).
--
-- Run this in the Supabase SQL editor BEFORE deploying the new
-- app code. Do NOT run 002_drop_text_align.sql until you've
-- verified migrated content renders correctly in the new editor.
-- ============================================================

UPDATE content_items
SET title = '<p>' || replace(replace(replace(replace(replace(
      title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\r\n', E'\n'), E'\n', '<br>')
    || '</p>'
WHERE title NOT LIKE '<%';

UPDATE content_items
SET description = '<p>' || replace(replace(replace(replace(replace(
      description, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\r\n', E'\n'), E'\n', '<br>')
    || '</p>'
WHERE description NOT LIKE '<%' AND description <> '';

UPDATE content_items
SET main_content = '<p style="text-align: ' || text_align || '">' || replace(replace(replace(replace(replace(
      main_content, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\r\n', E'\n'), E'\n', '<br>')
    || '</p>'
WHERE main_content NOT LIKE '<%';
