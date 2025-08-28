import PptxGenJS from "pptxgenjs";

function b64(buf) {
  return buf.toString("base64");
}
function dataUrl(img) {
  return `data:${img.contentType};base64,${b64(img.buffer)}`;
}

export async function buildPptx({ slides, templateMeta }) {
  const { colors = {}, fonts = { major: "Calibri", minor: "Calibri" }, images = [] } = templateMeta || {};
  const accent = colors.accent1 || "#1F4E79";
  const bg = colors.lt1 || "#FFFFFF";
  const textColor = colors.dk1 || "#222222";

  const pptx = new PptxGenJS();

  // Define a simple master using template hints
  pptx.defineSlideMaster({
    title: "MASTER",
    background: { color: bg },
    objects: [
      { rect: { x: 0, y: "90%", w: "100%", h: 0.3, fill: accent } }
    ],
    margin: [0.5, 0.5, 0.5, 0.5]
  });

  // COVER
  const cover = pptx.addSlide({ masterName: "MASTER" });
  if (images.length) {
    // optional: place first image as a faint cover background
    cover.addImage({ data: dataUrl(images[0]), x: 0, y: 0, w: "100%", h: "100%", opacity: 0.15 });
  }
  const first = slides.slides?.[0] || slides[0] || { title: "Overview", bullets: [] };
  cover.addText(first.title || "Overview", {
    x: 0.5, y: 1.2, w: 9, h: 1.2,
    fontFace: fonts.major, fontSize: 44, bold: true, color: textColor
  });
  if (first.bullets?.length) {
    cover.addText(first.bullets.slice(0, 5).map(t => ({ text: t })), {
      x: 0.8, y: 2.5, w: 8.5, h: 3,
      fontFace: fonts.minor, fontSize: 20, color: textColor, bullet: true, lineSpacingMultiple: 1.1
    });
  }
  if (first.notes) cover.addNotes(first.notes);

  // CONTENT SLIDES
  const rest = (slides.slides || slides).slice(1);
  rest.forEach((s) => {
    const slide = pptx.addSlide({ masterName: "MASTER" });
    slide.addText(s.title || "Slide", {
      x: 0.5, y: 0.6, w: 9, h: 0.8,
      fontFace: fonts.major, fontSize: 32, bold: true, color: textColor
    });
    if (s.bullets?.length) {
      slide.addText(s.bullets.map(t => ({ text: t })), {
        x: 0.8, y: 1.6, w: 8.5, h: 4.5,
        fontFace: fonts.minor, fontSize: 20, color: textColor, bullet: true, lineSpacingMultiple: 1.1
      });
    }
    // sprinkle template images occasionally
    if (images.length > 1 && Math.random() < 0.35) {
      const img = images[(Math.random() * images.length) | 0];
      slide.addImage({ data: dataUrl(img), x: 6.4, y: 4.9, w: 3, h: 2 });
    }
    if (s.notes) slide.addNotes(s.notes);
  });

  return await pptx.write("nodebuffer");
}
