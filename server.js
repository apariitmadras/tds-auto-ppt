import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import multer from "multer";
import { makeOutline } from "./lib/outline.js";
import { parseTemplate } from "./lib/template.js";
import { buildPptx } from "./lib/pptx.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

app.get("/healthz", (req, res) => {
  res.json({ status: "ok", app: "auto-ppt", build: "v1" });
});

// Multer in-memory: we do not persist uploads; keep small/secure
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB
});

// Generate PPT endpoint: multipart form with fields + template file
app.post("/api/generate", upload.single("template"), async (req, res) => {
  try {
    const { text = "", guidance = "", provider = "openai", apiKey = "" } = req.body || {};
    const templateFile = req.file;

    if (!text.trim()) {
      return res.status(400).json({ error: "Missing input text." });
    }
    if (!templateFile) {
      return res.status(400).json({ error: "Missing template .pptx/.potx upload." });
    }

    // Use the user-supplied API key when provided. Never log it.
    const llmKey = apiKey || process.env.OPENAI_API_KEY || "";
    const slides = await makeOutline({
      text,
      guidance,
      provider,
      apiKey: llmKey
    }); // returns {slides:[{title, bullets[], notes?}], meta:{}}

    const templateMeta = await parseTemplate(templateFile.buffer);

    const buffer = await buildPptx({
      slides,
      templateMeta
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="generated.pptx"');
    return res.send(buffer);
  } catch (err) {
    console.error("generate error:", err.message);
    return res.status(500).json({ error: "Generation failed", details: err.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
