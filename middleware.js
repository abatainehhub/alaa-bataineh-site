// Vercel Routing Middleware — injects per-article Open Graph/Twitter meta
// tags (and the real <title>) into the served HTML for /article/:id* before
// it reaches the browser or a social-media crawler.
//
// Runs for EVERY request to that path (bots and real visitors alike) rather
// than trying to detect crawlers by User-Agent, which is fragile — some
// preview crawlers (Slack, iMessage, Discord) don't send an easily
// recognizable UA at all. A real visitor's browser gets the same injected
// HTML shell; it boots the SPA exactly as before, since only <head> meta
// tags are touched, and the client-side router (see src/App.jsx) takes over
// from there. As a side effect, this is also what makes a direct visit to
// an article URL work at all in production — it always returns valid HTML
// for this path, independent of any separate SPA-fallback rewrite.

export const config = {
  matcher: '/article/:id*',
  runtime: 'nodejs',
};

const SITE_NAME = 'درب للاقتصاد السلوكي والإسلامي';
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80';

// No DOMParser in a Node.js middleware environment, so tags are stripped by
// regex and the small set of entities our own sanitizer ever produces are
// decoded manually — &amp; must decode last, or a literal "&amp;lt;" would
// wrongly end up as "<" instead of the literal text "&lt;".
const stripHtml = (raw) =>
  (raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const escapeAttr = (s) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export default async function middleware(request) {
  const url = new URL(request.url);
  const id = url.pathname.match(/^\/article\/([^/]+)/)?.[1];
  if (!id) return; // shouldn't happen given the matcher, but fall through safely

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  let article = null;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/content_items?id=eq.${encodeURIComponent(id)}&select=title,description,image_url`,
        { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` } }
      );
      if (res.ok) {
        const rows = await res.json();
        article = rows[0] || null;
      }
    } catch (err) {
      console.error('middleware: failed to fetch article for OG tags', err);
    }
  }

  const title = article ? stripHtml(article.title) : 'مقال غير موجود';
  // Falls back the same way a missing cover image falls back to DEFAULT_COVER
  // — some rows have a genuinely empty description, which would otherwise
  // render as a blank line in the share preview.
  const description = (article && stripHtml(article.description)) || `منصة ${SITE_NAME}`;
  const image = article?.image_url || DEFAULT_COVER;
  const fullTitle = `${title} | ${SITE_NAME}`;

  let html;
  try {
    const shellRes = await fetch(new URL('/index.html', request.url));
    html = await shellRes.text();
  } catch (err) {
    console.error('middleware: failed to fetch index.html shell', err);
    return; // fall through to normal static serving rather than break the page
  }

  html = html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeAttr(fullTitle)}</title>`)
    .replace(
      /(<meta name="description" content=")([^"]*)(")/,
      (_m, before, _old, after) => `${before}${escapeAttr(description)}${after}`
    )
    .replace(
      /(<meta property="og:site_name"\s+content=")([^"]*)(")/,
      (_m, before, _old, after) => `${before}${escapeAttr(SITE_NAME)}${after}`
    )
    .replace(
      /(<meta property="og:title"\s+content=")([^"]*)(")/,
      (_m, before, _old, after) => `${before}${escapeAttr(fullTitle)}${after}`
    )
    .replace(
      /(<meta property="og:description"\s+content=")([^"]*)(")/,
      (_m, before, _old, after) => `${before}${escapeAttr(description)}${after}`
    )
    .replace(
      /(<meta property="og:url"\s+content=")([^"]*)(")/,
      (_m, before, _old, after) => `${before}${escapeAttr(url.toString())}${after}`
    )
    .replace(
      /(<meta name="twitter:title"\s+content=")([^"]*)(")/,
      (_m, before, _old, after) => `${before}${escapeAttr(fullTitle)}${after}`
    )
    .replace(
      /(<meta name="twitter:description"\s+content=")([^"]*)(")/,
      (_m, before, _old, after) => `${before}${escapeAttr(description)}${after}`
    );

  // og:image/twitter:image aren't in the static shell at all yet — insert them.
  html = html.replace(
    '</head>',
    `    <meta property="og:image" content="${escapeAttr(image)}" />\n` +
      `    <meta name="twitter:image" content="${escapeAttr(image)}" />\n` +
      `  </head>`
  );

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Short edge cache: keeps repeated crawler hits off Supabase without
      // making an edited article's preview go stale for long.
      'cache-control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600',
    },
  });
}
