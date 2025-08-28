// lib/outline.js
import { OpenAI } from "openai";

// ---------- Heuristic (no-LLM) fallback ----------
function heuristicOutline(raw, guidance = "") {
  const lines = String(raw || "").split(/\r?\n/);
  const blocks = [];
  let curr = [];
  for (const ln of lines) {
    if (/^##\s+/.test(ln) || ln.trim() === "") {
      if (curr.length) { blocks.push(curr.join("\n")); curr = []; }
      if (/^##\s+/.test(ln)) curr.push(ln.replace(/^##\s+/, ""));
    } else {
      curr.push(ln);
    }
  }
  if (curr.length) blocks.push(curr.join("\n"));

  const slides = blocks
    .filter(b => b.trim())
    .map((b, i) => {
      const [first, ...rest] = b.split("\n").filter(Boolean);
      const title = first && first.length < 120 ? first : `Slide ${i + 1}`;
      const bullets = rest.length ? rest.slice(0, 8) : [b.slice(0, 200)];
      return { title, bullets };
    });

  if (!slides.length) {
    const chunk = String(raw || "").slice(0, 600);
    return { slides: [{ title: guidance || "Overview", bullets: chunk.split(/\.\s+/).slice(0, 6) }] };
  }
  return { slides };
}

// ---------- Common prompt pieces ----------
function systemPrompt() {
  return [
    "You turn long text into a concise slide outline.",
    'Return JSON only: {"slides":[{"title":string,"bullets":string[],"notes"?:string}], "meta"?:{}}',
    "Guidelines: 6-12 bullets per slide max; 6-15 slides total depending on content length.",
    "Do not invent images. Do not include markdown formatting."
  ].join(" ");
}
function userPrompt(text, guidance) {
  return `Guidance (optional): ${guidance || "none"}\n\nInput text:\n${text}`;
}
function sanitizeOutline(parsed) {
  // Minimal validation + sanitation to keep output safe
  if (!parsed || !Array.isArray(parsed.slides)) throw new Error("Invalid JSON outline");
  parsed.slides = parsed.slides.map((s, i) => ({
    title: String(s.title || `Slide ${i + 1}`).slice(0, 120),
    bullets: (s.bullets || []).map(b => String(b).slice(0, 300)).slice(0, 12),
    ...(s.notes ? { notes: String(s.notes).slice(0, 1000) } : {})
  }));
  return parsed;
}

// ---------- Provider calls ----------
async function outlineOpenAI({ apiKey, text, guidance }) {
  const openai = new OpenAI({ apiKey });
  const resp = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user",   content: userPrompt(text, guidance) }
    ]
  });
  const content = resp.choices?.[0]?.message?.content || "";
  return sanitizeOutline(JSON.parse(content));
}

async function outlineAnthropic({ apiKey, text, guidance }) {
  // Claude Messages API (minimal JSON return)
  const body = {
    model: process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307",
    max_tokens: 2000,
    temperature: 0.2,
    system: systemPrompt(),
    messages: [{ role: "user", content: userPrompt(text, guidance) }]
  };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}`);
  const data = await r.json();
  const content =
    data?.content?.[0]?.text ??
    (Array.isArray(data?.content) ? data.content.map(p => p.text).join("\n") : "");
  return sanitizeOutline(JSON.parse(content));
}

async function outlineGemini({ apiKey, text, guidance }) {
  // Gemini generateContent (v1beta)
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      { role: "user", parts: [{ text: `${systemPrompt()}\n\n${userPrompt(text, guidance)}` }] }
    ],
    generationConfig: { temperature: 0.2 }
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const data = await r.json();
  const textOut =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.content?.parts?.map(p => p.text).join("\n") || "";
  return sanitizeOutline(JSON.parse(textOut));
}

// ---------- Public entry ----------
export async function makeOutline({ text, guidance = "", provider = "openai", apiKey = "" }) {
  // If no key, skip LLM and use heuristic
  if (!apiKey) return heuristicOutline(text, guidance);

  try {
    const p = String(provider || "openai").toLowerCase();
    if (p === "openai")    return await outlineOpenAI({ apiKey, text, guidance });
    if (p === "anthropic") return await outlineAnthropic({ apiKey, text, guidance });
    if (p === "gemini")    return await outlineGemini({ apiKey, text, guidance });
    // Unknown provider -> heuristic
    return heuristicOutline(text, guidance);
  } catch (e) {
    // Any failure -> heuristic, so the app still works
    return heuristicOutline(text, guidance);
  }
}
