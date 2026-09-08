-- ============================================================
-- Migration 004 — split each migrated row's single fused paragraph
-- back into real, independent <p> elements at every point that was
-- originally a blank line (encoded by 001 as 2+ consecutive <br>).
--
-- Only run this AFTER reviewing 004_split_fused_paragraphs_preview.sql
-- and confirming the split points look right.
--
-- Scope: only rows still wrapped in exactly one <p>...</p> (skips
-- anything already multi-paragraph, so it's safe to run more than
-- once and safe against content already fixed by other means).
-- Rows where the split would only yield one paragraph are left
-- untouched (nothing to split — not a real fused-paragraph row).
--
-- Every resulting paragraph inherits the row's original alignment
-- (style attribute) — this is a structural fix only; per-section
-- alignment/direction (e.g. re-aligning a References block) is a
-- manual follow-up per article, same as any other rich-text edit.
--
-- Applies to title, description, and main_content uniformly (the
-- first two are essentially always no-ops in practice).
-- ============================================================

-- ── main_content ─────────────────────────────────────────────
WITH candidates AS (
  SELECT id,
    substring(main_content from '<p([^>]*)>') AS p_attrs,
    regexp_replace(main_content, '^<p[^>]*>(.*)</p>$', '\1') AS inner_html
  FROM content_items
  WHERE main_content ~ '^<p[^>]*>.*</p>$'
    AND main_content !~ '</p>\s*<p'
),
fragments AS (
  SELECT id, p_attrs,
    regexp_split_to_array(inner_html, '(\s*<br>\s*){2,}') AS frags
  FROM candidates
),
rebuilt AS (
  SELECT
    c.id,
    (SELECT string_agg('<p' || c.p_attrs || '>' || cleaned || '</p>', '')
       FROM (
         SELECT regexp_replace(regexp_replace(f, '^(\s*<br>\s*)+', ''), '(\s*<br>\s*)+$', '') AS cleaned
         FROM unnest(c.frags) AS f
       ) t
       WHERE cleaned <> '') AS new_content,
    (SELECT count(*)
       FROM (
         SELECT regexp_replace(regexp_replace(f, '^(\s*<br>\s*)+', ''), '(\s*<br>\s*)+$', '') AS cleaned
         FROM unnest(c.frags) AS f
       ) t
       WHERE cleaned <> '') AS paragraph_count
  FROM fragments c
)
UPDATE content_items ci
SET main_content = r.new_content
FROM rebuilt r
WHERE ci.id = r.id
  AND r.paragraph_count > 1
  AND r.new_content IS NOT NULL AND r.new_content <> '';

-- ── description ──────────────────────────────────────────────
WITH candidates AS (
  SELECT id,
    substring(description from '<p([^>]*)>') AS p_attrs,
    regexp_replace(description, '^<p[^>]*>(.*)</p>$', '\1') AS inner_html
  FROM content_items
  WHERE description ~ '^<p[^>]*>.*</p>$'
    AND description !~ '</p>\s*<p'
),
fragments AS (
  SELECT id, p_attrs,
    regexp_split_to_array(inner_html, '(\s*<br>\s*){2,}') AS frags
  FROM candidates
),
rebuilt AS (
  SELECT
    c.id,
    (SELECT string_agg('<p' || c.p_attrs || '>' || cleaned || '</p>', '')
       FROM (
         SELECT regexp_replace(regexp_replace(f, '^(\s*<br>\s*)+', ''), '(\s*<br>\s*)+$', '') AS cleaned
         FROM unnest(c.frags) AS f
       ) t
       WHERE cleaned <> '') AS new_content,
    (SELECT count(*)
       FROM (
         SELECT regexp_replace(regexp_replace(f, '^(\s*<br>\s*)+', ''), '(\s*<br>\s*)+$', '') AS cleaned
         FROM unnest(c.frags) AS f
       ) t
       WHERE cleaned <> '') AS paragraph_count
  FROM fragments c
)
UPDATE content_items ci
SET description = r.new_content
FROM rebuilt r
WHERE ci.id = r.id
  AND r.paragraph_count > 1
  AND r.new_content IS NOT NULL AND r.new_content <> '';

-- ── title ─────────────────────────────────────────────────────
WITH candidates AS (
  SELECT id,
    substring(title from '<p([^>]*)>') AS p_attrs,
    regexp_replace(title, '^<p[^>]*>(.*)</p>$', '\1') AS inner_html
  FROM content_items
  WHERE title ~ '^<p[^>]*>.*</p>$'
    AND title !~ '</p>\s*<p'
),
fragments AS (
  SELECT id, p_attrs,
    regexp_split_to_array(inner_html, '(\s*<br>\s*){2,}') AS frags
  FROM candidates
),
rebuilt AS (
  SELECT
    c.id,
    (SELECT string_agg('<p' || c.p_attrs || '>' || cleaned || '</p>', '')
       FROM (
         SELECT regexp_replace(regexp_replace(f, '^(\s*<br>\s*)+', ''), '(\s*<br>\s*)+$', '') AS cleaned
         FROM unnest(c.frags) AS f
       ) t
       WHERE cleaned <> '') AS new_content,
    (SELECT count(*)
       FROM (
         SELECT regexp_replace(regexp_replace(f, '^(\s*<br>\s*)+', ''), '(\s*<br>\s*)+$', '') AS cleaned
         FROM unnest(c.frags) AS f
       ) t
       WHERE cleaned <> '') AS paragraph_count
  FROM fragments c
)
UPDATE content_items ci
SET title = r.new_content
FROM rebuilt r
WHERE ci.id = r.id
  AND r.paragraph_count > 1
  AND r.new_content IS NOT NULL AND r.new_content <> '';
