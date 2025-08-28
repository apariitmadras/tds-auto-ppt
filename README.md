# Auto PPT Generator

Turn long text/markdown into a downloadable **`.pptx`** that adopts the **style of an uploaded PowerPoint template**. Users can choose an LLM provider (**OpenAI**, **Claude (Anthropic)**, or **Gemini (Google)**) and paste their own API key — or run **without** any key (heuristic mode).

**Live demo:** https://tds-auto-ppt-production.up.railway.app/

---

## Features
- Paste large text + optional one-line guidance
- Upload `.pptx/.potx` template; **reuses template images** (no AI image gen)
- Provider dropdown: **OpenAI / Claude / Gemini**
- Works with or without an API key (heuristic fallback)
- Minimal UI; clear inline error messages

---

## Quick Start

**Requirements**
- Node.js **≥ 18**

**Install & Run**
```bash
git clone <your-repo-url>
cd auto-ppt
npm i
cp .env.example .env   # optional; keep keys blank to test heuristic mode
npm run start
# open http://localhost:8080


## Security & Privacy
- API keys are used in-memory only for that single request; no logging or persistence.
- Uploaded files are processed in memory and not stored.
- No external image generation; output images come only from the uploaded template.

## Short Write-Up (How It Works)

Parsing & mapping text to slides.
The app converts the user’s long text into a slide outline via two paths. If the user provides a valid key and selects a provider (OpenAI, Claude, or Gemini), the server sends a compact system instruction and the user content to the model and requests strict JSON:
{ "slides": [ { "title": string, "bullets": string[], "notes"?: string } ] }.
The JSON is validated and sanitized (caps on title/bullet length) before composition. If no key is present or the model call fails, the app falls back to a heuristic: it segments by markdown headings/blank lines, treats concise first lines as titles, and trims bullets. Slide count scales with input size and structure rather than being fixed.

Applying the template’s style & assets.
The uploaded .pptx/.potx is treated as a ZIP. The server extracts theme hints (colors/fonts) from /ppt/theme/theme*.xml and collects images from /ppt/media/*. Using pptxgenjs, the generator defines a simple master slide with the template’s background/accent color, applies major/minor fonts to titles and body, and composes a new deck from the outline. To meet constraints, no AI images are created; instead, images found in the template are reused (e.g., subtle cover background or small content inserts). This best-effort approach mirrors the template’s look while keeping assets consistent across generated slides.
