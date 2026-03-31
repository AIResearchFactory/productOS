import pptxgen from "pptxgenjs";

export interface BrandSettings {
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

export async function exportToPptx(markdownContent: string, brandSettings?: BrandSettings, title: string = "Presentation") {
  const pres = new pptxgen();
  let defaultUsed = false;

  const font = brandSettings?.fontFamily || "Calibri";
  const primary = brandSettings?.primaryColor ? brandSettings.primaryColor.replace('#', '') : "2C3E50";

  if (!brandSettings?.primaryColor && !brandSettings?.fontFamily) {
    defaultUsed = true;
  }

  // Define Slide Masters
  pres.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.5, fill: { color: primary } } }
    ]
  });

  const slides = parseMarkdownToSlides(markdownContent);

  for (const slideData of slides) {
    const slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
    
    // Add Header
    slide.addText(slideData.header || slideData.title || "Slide", {
      x: 0.5, y: 0.8, w: "90%", h: 1,
      fontSize: 32,
      fontFace: font,
      color: primary,
      bold: true
    });

    // Add Body (Bullet points)
    if (slideData.bullets && slideData.bullets.length > 0) {
      slide.addText(
        slideData.bullets.map((b: string) => ({ text: b, options: { bullet: true } })),
        {
          x: 0.5, y: 2.0, w: "90%", h: 3,
          fontSize: 18,
          fontFace: font,
          color: "333333",
          valign: "top"
        }
      );
    }

    // Add Speaker Notes
    if (slideData.speakerNotes) {
      slide.addNotes(slideData.speakerNotes);
    }
  }

  try {
    await pres.writeFile({ fileName: `${title}.pptx` });
    return { success: true, defaultUsed };
  } catch (error) {
    console.error("Failed to generate PPTX", error);
    return { success: false, error };
  }
}

function parseMarkdownToSlides(content: string) {
  const slides: any[] = [];
  let currentSlide: any = null;

  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# Slide')) {
      if (currentSlide) {
        slides.push(currentSlide);
      }
      currentSlide = { title: trimmed.replace(/^# Slide\s*\d*:\s*/, '').trim(), bullets: [] };
    } else if (currentSlide) {
      if (trimmed.startsWith('**Header:**')) {
        currentSlide.header = trimmed.replace('**Header:**', '').trim();
      } else if (trimmed.startsWith('- ')) {
        currentSlide.bullets.push(trimmed.substring(2).trim());
      } else if (trimmed.startsWith('**Speaker Notes:**')) {
        currentSlide.speakerNotes = trimmed.replace('**Speaker Notes:**', '').trim();
      }
    }
  }

  if (currentSlide) {
    slides.push(currentSlide);
  }

  return slides;
}
