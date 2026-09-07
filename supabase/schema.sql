-- ============================================================
-- Dr. Alaa Bataineh Site — Supabase Schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query)
-- ============================================================

-- ── Content items ────────────────────────────────────────────
-- title/description/main_content store sanitized rich-text HTML
-- (produced by the TipTap editor, allow-listed via DOMPurify) —
-- not plain text. See src/lib/sanitize.js.
CREATE TABLE IF NOT EXISTS content_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text        NOT NULL,
  description  text        NOT NULL DEFAULT '',
  main_content text        NOT NULL DEFAULT '',
  image_url    text,
  video_url    text,
  download_url text,
  section_id   text        NOT NULL,
  views        integer     NOT NULL DEFAULT 0,
  likes        integer     NOT NULL DEFAULT 0,
  hearts       integer     NOT NULL DEFAULT 0,
  sort_order   bigint      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_content"       ON content_items FOR SELECT USING (true);
CREATE POLICY "admin_insert_content"      ON content_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "admin_update_content"      ON content_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "admin_delete_content"      ON content_items FOR DELETE USING (auth.role() = 'authenticated');

-- ── Site settings (cover image, position, scale) ─────────────
CREATE TABLE IF NOT EXISTS site_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_settings"  ON site_settings FOR SELECT USING (true);
CREATE POLICY "admin_write_settings"  ON site_settings FOR ALL   USING (auth.role() = 'authenticated');

-- ── Stored functions for public reactions / view increments ──
-- These run with SECURITY DEFINER so anonymous visitors can call
-- them without needing direct UPDATE permission on the table.

CREATE OR REPLACE FUNCTION increment_views(item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE content_items SET views = views + 1 WHERE id = item_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_reaction(item_id uuid, reaction_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF reaction_type = 'like' THEN
    UPDATE content_items SET likes = likes + 1 WHERE id = item_id;
  ELSIF reaction_type = 'heart' THEN
    UPDATE content_items SET hearts = hearts + 1 WHERE id = item_id;
  END IF;
END;
$$;

-- ── Storage bucket ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-images', 'site-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public_read_site_images" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-images');

CREATE POLICY "admin_upload_site_images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'site-images' AND auth.role() = 'authenticated');

CREATE POLICY "admin_delete_site_images" ON storage.objects
  FOR DELETE USING (bucket_id = 'site-images' AND auth.role() = 'authenticated');
