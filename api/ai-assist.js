// Server-side Gemini proxy for the two AI content-assist buttons.
//
// GEMINI_API_KEY never reaches the browser: Vite only inlines VITE_-prefixed
// env vars into the client bundle, and this one deliberately has no prefix.

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const MAX_INPUT_LENGTH = 12000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

const PROMPTS = {
  summarize: (text) =>
    `أنت مساعد كتابة أكاديمي. لخّص النص التالي بإيجاز ووضوح باللغة العربية، مع الحفاظ على المعنى ` +
    `والمصطلحات الأساسية. أعد التلخيص كفقرات نصية عادية فقط، دون أي تنسيق Markdown أو HTML أو عناوين.\n\n` +
    `النص:\n"""\n${text}\n"""`,
  suggest: (text) =>
    `أنت مساعد كتابة أكاديمي متخصص في الاقتصاد السلوكي. بناءً على النص التالي، ولّد محتوى إضافياً متقدماً ` +
    `يوسّع الفكرة بعمق أكاديمي (تحليل أعمق، أمثلة تطبيقية، أو ربط بنظريات ذات صلة). أعد المحتوى كفقرات نصية ` +
    `عادية فقط، دون أي تنسيق Markdown أو HTML أو عناوين.\n\nالنص:\n"""\n${text}\n"""`,
};

const GENERATION_CONFIG = {
  summarize: { temperature: 0.4, maxOutputTokens: 512 },
  suggest: { temperature: 0.8, maxOutputTokens: 1024 },
};

// Escapes HTML-significant characters and wraps each blank-line-separated
// chunk in its own <p> (single line breaks become <br>) — the same
// plain-text-to-HTML convention already used for migrated content, so the
// result is safe, structured HTML before it ever reaches the client.
function textToParagraphHtml(text) {
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escape(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(prompt, generationConfig) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('AI service not configured');
    err.status = 500;
    throw err;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
    });

    if (response.status === 429) {
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt + Math.random() * 250);
        continue;
      }
      const err = new Error('rate_limited');
      err.status = 429;
      throw err;
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const err = new Error(`Gemini request failed (${response.status}): ${body.slice(0, 300)}`);
      err.status = 502;
      throw err;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const err = new Error('Gemini returned no content');
      err.status = 502;
      throw err;
    }
    return text;
  }

  const err = new Error('rate_limited');
  err.status = 429;
  throw err;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { type, text } = req.body || {};

  if (type !== 'summarize' && type !== 'suggest') {
    return res.status(400).json({ error: 'invalid_type' });
  }
  if (typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'missing_text' });
  }
  if (text.length > MAX_INPUT_LENGTH) {
    return res.status(400).json({ error: 'text_too_long', maxLength: MAX_INPUT_LENGTH });
  }

  try {
    const rawText = await callGemini(PROMPTS[type](text), GENERATION_CONFIG[type]);
    return res.status(200).json({ text: textToParagraphHtml(rawText) });
  } catch (err) {
    if (err.status === 429) {
      return res.status(429).json({ error: 'rate_limited' });
    }
    console.error('ai-assist error:', err);
    return res.status(err.status || 500).json({ error: 'ai_request_failed' });
  }
}
