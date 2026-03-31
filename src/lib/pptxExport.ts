import pptxgen from "pptxgenjs";

export interface BrandSettings {
  primaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  typography?: {
    heading_font?: string;
    body_font?: string;
  };
}

export async function exportToPptx(markdownContent: string, brandSettings?: BrandSettings, title: string = "Presentation") {
  const pres = new pptxgen();
  let defaultUsed = false;

  const font = brandSettings?.typography?.heading_font || brandSettings?.fontFamily || "Calibri";
  const primaryRaw = brandSettings?.colors?.primary || brandSettings?.primaryColor || "2C3E50";
  const primary = primaryRaw.replace(/^#/, '');

  if (!brandSettings?.colors?.primary && !brandSettings?.primaryColor && !brandSettings?.typography?.heading_font && !brandSettings?.fontFamily) {
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
    const slideMatch = trimmed.match(/^(?:#+\s*)?(?:\d+\.\s*)?Slide\s*\d*(?::|-)?\s*(.*)/i);
    
    if (slideMatch) {
      if (currentSlide) {
        slides.push(currentSlide);
      }
      currentSlide = { title: slideMatch[1].trim() || "New Slide", bullets: [] };
    } else if (currentSlide) {
      const headerMatch = trimmed.match(/^\*\*\s*Header\s*[:\*]*\s*(.*)/i);
      const notesMatch = trimmed.match(/^\*\*\s*Speaker Notes\s*[:\*]*\s*(.*)/i);
      
      if (headerMatch) {
        currentSlide.header = headerMatch[1].trim();
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        currentSlide.bullets.push(trimmed.substring(2).trim());
      } else if (notesMatch) {
        currentSlide.speakerNotes = notesMatch[1].trim();
      } else if (trimmed.length > 0 && !trimmed.startsWith('**') && !trimmed.startsWith('#')) {
        // Fallback for bodies that aren't strictly bulleted, or extra text
        // Only if we already have some context
      }
    }
  }

  if (currentSlide) {
    slides.push(currentSlide);
  }

  return slides;
}
