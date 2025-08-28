// lib/template.js
import JSZip from "jszip";
import { parseStringPromise } from "xml2js";
import path from "path";

// Best-effort MIME map for images we may find in /ppt/media
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

  // ---------- 1) THEME (colors + fonts, best-effort; exact fidelity not required) ----------
  let colors = {};
  let fonts = { major: "Calibri", minor: "Calibri" };

  // Find the first theme file like ppt/theme/theme1.xml
  const themeEntryName = Object.keys(zip.files).find((n) =>
    /^ppt\/theme\/theme\d+\.xml$/i.test(n)
  );

  if (themeEntryName) {
    try {
      const xml = await zip.file(themeEntryName).async("string");
      const json = await parseStringPromise(xml, { explicitArray: true });

      // xml2js preserves namespaces as keys like "a:theme"
      const theme = json?.["a:theme"] || json?.theme || null;
      const themeElements = theme?.["a:themeElements"]?.[0];
      const clrScheme = themeElements?.["a:clrScheme"]?.[0];
      const fontScheme = themeElements?.["a:fontScheme"]?.[0];

      const getHex = (node) => {
        const srgb = node?.["a:srgbClr"]?.[0]?.$?.val;
        const schemeClr = node?.["a:schemeClr"]?.[0]?.$?.val;
        if (srgb) return `#${srgb}`;
        if (schemeClr) return schemeClr; // fallback (may be names like "accent1")
        return undefined;
      };

      const keys = ["accent1","accent2","accent3","accent4","accent5","accent6","dk1","lt1","dk2","lt2"];
      keys.forEach((k) => {
        const n = clrScheme?.[`a:${k}`]?.[0];
        const v = n && getHex(n);
        if (v) colors[k] = v;
      });

      const major = fontScheme?.["a:majorFont"]?.[0]?.["a:latin"]?.[0]?.$?.typeface;
      const minor = fontScheme?.["a:minorFont"]?.[0]?.["a:latin"]?.[0]?.$?.typeface;
      if (major) fonts.major = major;
      if (minor) fonts.minor = minor;
    } catch {
      // Theme parsing is best-effort; ignore failures
    }
  }

  // ---------- 2) IMAGES (we only REUSE images already in the template) ----------
  const images = [];
  for (const name of Object.keys(zip.files)) {
    if (name.startsWith("ppt/media/")) {
      const ext = path.extname(name).toLowerCase();
      const contentType = EXT_MIME[ext] || "application/octet-stream";
      const buf = await zip.file(name).async("nodebuffer");
      images.push({ name: path.basename(name), contentType, buffer: buf });
    }
  }

  return { colors, fonts, images };
}
