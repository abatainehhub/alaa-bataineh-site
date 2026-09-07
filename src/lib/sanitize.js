import DOMPurify from 'dompurify';

// ── Rich-text sanitization ───────────────────────────────────────────────────
//
// Two allow-lists, deliberately different:
//
// - WRITE: what the TipTap toolbar itself can ever produce (title, description,
//   main content fields). No <a> — there is no link button in the editor, so a
//   stray <a> in saved content would only mean tampered/imported markup.
// - RENDER: WRITE's tags plus <a>, used only after we auto-linkify bare URLs
//   in already-sanitized content for display (see linkifyHtml below).

const WRITE_TAGS   = ['p', 'strong', 'em', 'u', 'ul', 'li', 'br'];
const RENDER_TAGS  = [...WRITE_TAGS, 'a'];
const ALLOWED_ATTR = ['style', 'dir', 'href', 'target', 'rel'];

export const sanitizeRichText = (html) =>
  DOMPurify.sanitize(html || '', { ALLOWED_TAGS: WRITE_TAGS, ALLOWED_ATTR });

const sanitizeForRender = (html) =>
  DOMPurify.sanitize(html || '', { ALLOWED_TAGS: RENDER_TAGS, ALLOWED_ATTR });

// True HTML-string emptiness check — "<p></p>" is a non-empty string but an
// empty document, so a plain .trim() on the raw HTML would wrongly pass.
export const isRichTextEmpty = (html) =>
  !html || !html.replace(/<[^>]*>/g, '').trim();

// Strips all markup and decodes entities, for plain-text contexts: card
// previews, search matching, alt/title attributes.
export const stripHtml = (html) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

// Wraps bare URLs appearing as visible text in already-sanitized rich-text
// HTML with a real <a> tag, then re-sanitizes with the wider render allow-list
// (auto-linked hrefs are user-typed text, not toolbar output, so they need
// their own pass — this also neutralises any dangerous href scheme).
const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

export const linkifyHtml = (html) => {
  if (!html) return '';
  const linked = html.replace(
    URL_REGEX,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="rich-link">${url}</a>`
  );
  return sanitizeForRender(linked);
};
