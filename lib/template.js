import JSZip from "jszip";
import { parseStringPromise } from "xml2js";
import path from "path";

const EXT_MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".emf": "image/emf",
  ".wmf": "image/wmf"
};

export async function parseTemplate(buffer) {
  const zip = await JSZip.loadAsync(buffer);

  // 1) Extract theme colors & fonts (best-effort; exact fidelity not required) :contentReference[oaicite:2]{index=2}
  let colors = {};
  let fonts = { major: "Calibri", minor: "Calibri" };
  const themeFile = zip.file("ppt/theme/theme1.xml") || zip.file("ppt/theme/theme2.xml");
  if (themeFile) {
    try {
      const xml = await themeFile.async("string");
      const json = await parseStringPromise(xml, { explicitArray: true });
      const t = json.a: /* nope, handle default */ json;
      // Safe best-effort extraction:
      const clrScheme = json?.["a:theme"]?.["a:themeElements"]?.[0]?.["a:clrScheme"]?.[0] || {};
      ["accent1","accent2","accent3","accent4","accent5","accent6","dk1","lt1","dk2","lt2"].forEach(k=>{
        const node = clrScheme[`a:${k}`]?.[0];
        const srgb = node?.["a:srgbClr"]?.[0]?.$?.val;
        if (srgb) colors[k] = `#${srgb}`;
      });
      const fontScheme = json?.["a:theme"]?.["a:themeElements"]?.[0]?.["a:fontScheme"]?.[0] || {};
      const major = fontScheme?.["a:majorFont"]?.[0]?.["a:latin"]?.[0]?.$?.typeface;
      const minor = fontScheme?.["a:minorFont"]?.[0]?.["a:latin"]?.[0]?.$?.typeface;
      if (major) fonts.major = major;
      if (minor) fonts.minor = minor;
    } catch {}
  }

  // 2) Extract images from /ppt/media (these are the ones we’re allowed to reuse) :contentReference[oaicite:3]{index=3}
  const images = [];
  const mediaFiles = Object.values(zip.files).filter(f => f.name.startsWith("ppt/media/"));
  for (const f of mediaFiles) {
    const ext = path.extname(f.name).toLowerCase();
    const contentType = EXT_MIME[ext] || "application/octet-stream";
    const buf = await f.async("nodebuffer");
    images.push({ name: path.basename(f.name), contentType, buffer: buf });
  }

  return { colors, fonts, images };
}
