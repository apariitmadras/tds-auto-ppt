import { OpenAI } from "openai";

// Basic fallback outline (no LLM): split on H2/blank lines
function heuristicOutline(raw, guidance = "") {
  const lines = raw.split(/\r?\n/);
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
    const chunk = raw.slice(0, 600);
    return { slides: [{ title: guidance || "Overview", bullets: chunk.split(/\.\s+/).slice(0, 6) }] };
  }
  return { slides };
}

export async function makeOutline({ text, guidance = "", provider = "openai", apiKey = "" }) {
  // Use LLM only if a key is available (user-supplied or env).
  if (!apiKey || provider !== "openai") {
    return heuristicOutline(text, guidance);
  }

  try {
    const openai = new OpenAI({ apiKey });

    const system = [
      "You turn long text into a concise slide outline.",
      "Return pure JSON only. No prose.",
      "Schema: {\"slides\":[{\"title\":string, \"bullets\":string[], \"notes\"?:string}], \"meta\"?:{}}",
      "Guidelines: 6-12 bullets per slide max; 6-15 slides total depending on content length.",
      "Do not invent images. Do not include markdown formatting."
    ].join(" ");

    const user = [
      `Guidance (optional): ${guidance || "none"}`,
      "Input text:",
      text
    ].join("\n\n");

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    const content = resp.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(content);
    // Minimal validation
    if (!parsed || !Array.isArray(parsed.slides)) throw new Error("Invalid JSON outline");
    // Sanitize slides
    parsed.slides = parsed.slides.map((s, i) => ({
      title: String(s.title || `Slide ${i + 1}`).slice(0, 120),
      bullets: (s.bullets || []).map(b => String(b).slice(0, 300)).slice(0, 12),
      ...(s.notes ? { notes: String(s.notes).slice(0, 1000) } : {})
    }));
    return parsed;
  } catch (e) {
    // Fallback if LLM fails or quota ends
    return heuristicOutline(text, guidance);
  }
}
