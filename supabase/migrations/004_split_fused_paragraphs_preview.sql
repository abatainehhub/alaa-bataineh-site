-- ============================================================
-- Migration 004 — PREVIEW (read-only, safe to run any time)
--
-- Shows, for every row still in the single-fused-paragraph shape
-- (migration 001's output), exactly how 004 would split it: one
-- result row per resulting paragraph, with a stripped-tag preview
-- of its text so you can eyeball whether the split points land in
-- sensible places (section headers, individual references, etc.)
-- before the real UPDATE runs.
--
-- Run this FIRST. Nothing here writes to the database.
-- ============================================================

-- ── Summary: how many rows are affected, and how many paragraphs each yields ──
WITH candidates AS (
  SELECT
    id, section_id, title,
    substring(main_content from '<p([^>]*)>') AS p_attrs,
    regexp_replace(main_content, '^<p[^>]*>(.*)</p>$', '\1') AS inner_html
  FROM content_items
  WHERE main_content ~ '^<p[^>]*>.*</p>$'
    AND main_content !~ '</p>\s*<p'
),
fragments AS (
  SELECT id, section_id, title, p_attrs,
    regexp_split_to_array(inner_html, '(\s*<br>\s*){2,}') AS frags
  FROM candidates
)
SELECT
  id,
  section_id,
  left(regexp_replace(title, '<[^>]+>', '', 'g'), 60) AS title_preview,
  (SELECT count(*) FROM unnest(frags) f
     WHERE regexp_replace(regexp_replace(f, '^(\s*<br>\s*)+', ''), '(\s*<br>\s*)+$', '') <> '') AS resulting_paragraph_count
FROM fragments
ORDER BY id;

-- ── Detail: every resulting paragraph's preview text, for the rows above ─────
WITH candidates AS (
  SELECT
    id, section_id,
    substring(main_content from '<p([^>]*)>') AS p_attrs,
    regexp_replace(main_content, '^<p[^>]*>(.*)</p>$', '\1') AS inner_html
  FROM content_items
  WHERE main_content ~ '^<p[^>]*>.*</p>$'
    AND main_content !~ '</p>\s*<p'
),
fragments AS (
  SELECT id, section_id, p_attrs,
    regexp_split_to_array(inner_html, '(\s*<br>\s*){2,}') AS frags
  FROM candidates
),
cleaned AS (
  SELECT
    id, section_id, ord,
    regexp_replace(regexp_replace(frag, '^(\s*<br>\s*)+', ''), '(\s*<br>\s*)+$', '') AS text
  FROM fragments, unnest(frags) WITH ORDINALITY AS t(frag, ord)
)
SELECT
  id,
  section_id,
  ord AS paragraph_number,
  left(regexp_replace(text, '<[^>]+>', '', 'g'), 100) AS preview_text,
  length(text) AS html_length
FROM cleaned
WHERE text <> ''
ORDER BY id, ord;

-- ── Same checks for description and title (usually no-ops — included for
--    completeness; a row with resulting_paragraph_count = 1 means 004 will
--    skip it, since there's nothing to split) ──────────────────────────────
WITH candidates AS (
  SELECT id, section_id,
    regexp_replace(description, '^<p[^>]*>(.*)</p>$', '\1') AS inner_html
  FROM content_items
  WHERE description ~ '^<p[^>]*>.*</p>$' AND description !~ '</p>\s*<p'
)
SELECT id, section_id,
  (SELECT count(*) FROM unnest(regexp_split_to_array(inner_html, '(\s*<br>\s*){2,}')) f
     WHERE regexp_replace(regexp_replace(f, '^(\s*<br>\s*)+', ''), '(\s*<br>\s*)+$', '') <> '') AS resulting_paragraph_count
FROM candidates
ORDER BY id;
