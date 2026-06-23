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

export interface SlideData {
  title: string;
  header?: string;
  bullets: string[];
  subBullets: Map<number, string[]>; // parent bullet index -> sub-bullets
  bodyText: string[];
  speakerNotes?: string;
  table?: { headers: string[]; rows: string[][] };
  images?: { path: string; alt?: string }[];
  charts?: { type: string; data: any }[];
  layoutHint?: 'standard' | 'split' | 'section' | 'title' | 'comparison' | 'columns' | 'timeline' | 'image';
  startLine: number;
  items?: any[];
  fullText?: string;
}

export const SUPPORTED_LAYOUTS = [
  { id: 'standard', label: 'Standard', description: 'Header with bullets or text' },
  { id: 'split', label: 'Split Content', description: 'Title on left, content on right' },
  { id: 'section', label: 'Section Divider', description: 'Full-width colored slide for transitions' },
  { id: 'title', label: 'Title Slide', description: 'Main presentation title' },
  { id: 'comparison', label: 'Comparison', description: 'Two columns for comparing items' },
  { id: 'columns', label: 'Multi-Column', description: '3-4 columns for key features' },
  { id: 'timeline', label: 'Timeline', description: 'Horizontal layout for milestones' },
  { id: 'image', label: 'Image Focus', description: 'Large image with caption' },
] as const;

// Layout constants for a standard 10x5.625 inch slide (16:9)
const SLIDE_WIDTH = 10;
const SLIDE_HEIGHT = 5.625;
const MARGIN_X = 0.5;
const HEADER_HEIGHT = 0.8;
const HEADER_Y = 0.6;
const CONTENT_START_Y = 1.6;
const FOOTER_RESERVE = 0.4;

export const defineModernMasters = (pres: any, primaryColor: string, bgColor: string) => {
  const MARGIN_X = 0.5;
  const SLIDE_HEIGHT = 5.625; // 16:9 ratio

  // 1. SPLIT_MASTER: 40/60 Asymmetrical Split
  // Left side: light background for title. Right side: primary color for content.
  pres.defineSlideMaster({
    title: "SPLIT_MASTER",
    background: { color: bgColor },
    objects: [
      // Right side dominant colored block bleeding to the edge
      { rect: { x: 3.75, y: 0, w: 6.25, h: "100%", fill: { color: primaryColor } } },
      // Subtle left footer line
      { rect: { x: MARGIN_X, y: SLIDE_HEIGHT - 0.4, w: 3.0, h: 0.01, fill: { color: "CCCCCC" } } }
    ]
  });

  // 2. COLUMN_MASTER: Soft UI Cards Background
  pres.defineSlideMaster({
    title: "COLUMN_MASTER",
    background: { color: bgColor },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.07, fill: { color: primaryColor } } }
    ]
  });

  // 3. TIMELINE_MASTER: Clean dashboard aesthetic
  pres.defineSlideMaster({
    title: "TIMELINE_MASTER",
    background: { color: bgColor },
    objects: [
      // Subtle accent bar at top
      { rect: { x: 0, y: 0, w: "100%", h: 0.07, fill: { color: primaryColor } } }
    ]
  });

  // 4. SECTION_MASTER: Modern, clean transition slide
  pres.defineSlideMaster({
    title: "SECTION_MASTER",
    background: { color: primaryColor },
    objects: [
      // Sophisticated left border stripe in white/accent
      { rect: { x: 0, y: 0, w: 0.15, h: "100%", fill: { color: "FFFFFF", transparency: 30 } } },
      // Subtle elegant accent block top-left
      { rect: { x: 0.5, y: 0.5, w: 1.0, h: 0.05, fill: { color: "FFFFFF", transparency: 50 } } }
    ]
  });
};

/**
 * Builds a timeline slide using native shapes and typographic hierarchy.
 */
export const buildTimelineSlide = (pres: any, slideData: any, primaryColor: string) => {
  const notesText = slideData.speakerNotes || slideData.fullText || "";

  const milestones = (slideData.bullets || []).map((b: string, idx: number) => {
    const match = b.match(/^((?:19|20)\d{2}|[A-Za-z]{3}\s\d+|[A-Za-z]+)\s*[:-]\s*(.*)/) || [null, b, ""];
    const year = match[1] || b;
    const title = match[2] || b;
    const subs = slideData.subBullets?.get(idx) || [];
    return {
      year: stripBold(year),
      title: stripBold(title),
      summary: subs.map((s: string) => stripBold(s)).join("\n")
    };
  });

  if (milestones.length === 0) return;

  // Split into chunks of 5 to avoid overlap
  const chunkSize = 5;
  const chunks = [];
  for (let i = 0; i < milestones.length; i += chunkSize) {
    chunks.push(milestones.slice(i, i + chunkSize));
  }

  chunks.forEach((chunk, chunkIdx) => {
    const slide = pres.addSlide({ masterName: "TIMELINE_MASTER" });
    if (notesText) {
      slide.addNotes(notesText);
    }

    const displayTitle = slideData.title + (chunks.length > 1 ? ` (${chunkIdx + 1}/${chunks.length})` : "");
    slide.addText(displayTitle, {
      x: 0.5, y: 0.5, w: 9, h: 0.6,
      fontSize: 28, bold: true, color: "333333"
    });

    const startX = 1.0;
    const spacing = chunk.length > 1 ? 8.0 / (chunk.length - 1) : 0;
    const lineY = 3.5;

    // Draw the main horizontal connecting line
    slide.addShape(pres.ShapeType.line, {
      x: startX, y: lineY, w: 8.0, h: 0,
      line: { color: primaryColor, width: 2 }
    });

    chunk.forEach((item: any, index: number) => {
      const itemX = startX + (index * spacing);

      // Timeline Node (Ellipse)
      slide.addShape(pres.ShapeType.ellipse, {
        x: itemX - 0.1, y: lineY - 0.1, w: 0.2, h: 0.2,
        fill: { color: primaryColor }
      });

      // Massive, contrasting Year/Date
      slide.addText(item.year, {
        x: itemX - 0.5, y: lineY - 0.8, w: 1.5, h: 0.5,
        fontSize: 32, bold: true, color: primaryColor, align: "center"
      });

      // Small, condensed description
      slide.addText([{ text: item.title, options: { bold: true } }, { text: "\n" + item.summary }], {
        x: itemX - 0.6, y: lineY + 0.2, w: 1.6, h: 1.2,
        fontSize: 10, color: "666666", align: "center", valign: "top"
      });
    });
  });
};

/**
 * Builds a multi-column slide using transparent UI cards.
 */
export const buildColumnSlide = (pres: any, slideData: any, primaryColor: string, headingFont?: string, bodyFont?: string) => {
  const slide = pres.addSlide({ masterName: "COLUMN_MASTER" });
  if (slideData.speakerNotes || slideData.fullText) {
    slide.addNotes(slideData.speakerNotes || slideData.fullText || "");
  }

  slide.addText(slideData.title, { 
    x: 0.5, y: 0.5, w: 9, h: 0.6,
    fontSize: 28, bold: true, color: "333333",
    fontFace: headingFont || "Inter"
  });

  const cols = (slideData.bullets || []).map((b: string, idx: number) => {
    const subs = slideData.subBullets?.get(idx) || [];
    return {
      title: stripBold(b),
      summaryBullets: subs.map((s: string) => stripBold(s))
    };
  });

  if (cols.length === 0) return;

  const cardWidth = 8.0 / cols.length;
  
  cols.forEach((col: any, i: number) => {
    const cardX = 0.5 + (i * (cardWidth + 0.3)); // 0.3 is the gap
    
    // Draw the "Card" background
    slide.addShape(pres.ShapeType.rect, {
      x: cardX, y: 1.5, w: cardWidth, h: 3.5,
      fill: { color: primaryColor, transparency: 90 }, // Soft tint
      line: { color: primaryColor, transparency: 70, width: 1 }, // Subtle border
      round: true // Modern rounded corners
    });

    const textProps: any[] = [];

    // Title paragraph
    textProps.push({
      text: col.title || "",
      options: {
        fontSize: 16,
        bold: true,
        color: primaryColor,
        fontFace: headingFont || "Inter",
        paraSpaceAfter: (col.summaryBullets && col.summaryBullets.length > 0) ? 8 : 0
      }
    });

    // Bullets (Body) paragraphs
    if (col.summaryBullets && col.summaryBullets.length > 0) {
      col.summaryBullets.forEach((bulletText: string) => {
        textProps.push({
          text: bulletText,
          options: {
            bullet: { type: 'bullet' },
            fontSize: 12,
            color: "444444",
            fontFace: bodyFont || "Inter",
            paraSpaceAfter: 4
          }
        });
      });
    }

    // Card Content (Title + Bullets in a single text frame to handle auto-wrap and prevent overlap)
    slide.addText(textProps, {
      x: cardX + 0.15, y: 1.65, w: cardWidth - 0.3, h: 3.2,
      valign: "top"
    });
  });
};

export function normalizeSlideData(slide: any): SlideData {
  let subBullets = new Map<number, string[]>();
  if (slide.subBullets) {
    if (slide.subBullets instanceof Map) {
      subBullets = slide.subBullets;
    } else if (typeof slide.subBullets === 'object') {
      for (const key of Object.keys(slide.subBullets)) {
        const idx = parseInt(key, 10);
        if (!isNaN(idx)) {
          const val = slide.subBullets[key];
          subBullets.set(idx, Array.isArray(val) ? val : [String(val)]);
        }
      }
    }
  }

  // If items exists and bullets is empty, populate bullets from items
  let bullets = slide.bullets || [];
  if (bullets.length === 0 && Array.isArray(slide.items)) {
    bullets = slide.items.map((item: any) => {
      if (item.year) {
        return `${item.year} - ${item.title || ''}`;
      }
      return item.title || "";
    });
    // If subBullets is not set, we can populate it from items' summaryBullets
    if (subBullets.size === 0) {
      slide.items.forEach((item: any, idx: number) => {
        if (Array.isArray(item.summaryBullets)) {
          subBullets.set(idx, item.summaryBullets);
        } else if (item.summary) {
          subBullets.set(idx, [item.summary]);
        }
      });
    }
  }

  return {
    title: slide.title || "Untitled Slide",
    header: slide.header,
    bullets: bullets,
    subBullets: subBullets,
    bodyText: slide.bodyText || [],
    speakerNotes: slide.speakerNotes || slide.fullText || "",
    fullText: slide.fullText || slide.speakerNotes || "",
    table: slide.table,
    images: slide.images,
    charts: slide.charts,
    layoutHint: slide.layoutHint,
    startLine: slide.startLine || 0,
    items: slide.items
  };
}

export async function exportToPptx(markdownOrSlides: string | SlideData[], brandSettings?: BrandSettings, title: string = "Presentation") {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";

  const headingFont = brandSettings?.typography?.heading_font || brandSettings?.fontFamily || "Inter";
  const bodyFont = brandSettings?.typography?.body_font || headingFont;
  
  // Design system constants based on the Scientific Slides guide
  const primaryColor = brandSettings?.colors?.primary || brandSettings?.primaryColor || "0A9396"; // Teal
  const accentColor = brandSettings?.colors?.accent || brandSettings?.accentColor || "EE6C4D"; // Coral
  const textColor = "2C2C2C"; // Charcoal
  const bgColor = "F7FAFC"; // Light Gray
  
  const primary = primaryColor.replace(/^#/, '');
  const accent = accentColor.replace(/^#/, '');

  let defaultUsed = !brandSettings?.colors?.primary && !brandSettings?.primaryColor && !brandSettings?.typography?.heading_font && !brandSettings?.fontFamily;

  // Define Slide Masters
  pres.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: bgColor },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.1, fill: { color: primary } } }, // Slim top bar
      { rect: { x: MARGIN_X, y: SLIDE_HEIGHT - 0.5, w: SLIDE_WIDTH - 1, h: 0.01, fill: { color: "CCCCCC" } } } // Footer separator
    ]
  });

  pres.defineSlideMaster({
    title: "MODERN_MASTER",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: MARGIN_X, y: SLIDE_HEIGHT - 0.4, w: SLIDE_WIDTH - 1, h: 0.01, fill: { color: "EEEEEE" } } }
    ]
  });

  pres.defineSlideMaster({
    title: "TITLE_SLIDE",
    background: { color: primary }
  });

  pres.defineSlideMaster({
    title: "TWO_COLUMN_MASTER",
    background: { color: bgColor },
    objects: [
      { rect: { x: 0.5, y: 1.2, w: 4.3, h: 4, fill: { color: "FFFFFF" } } },
      { rect: { x: 5.2, y: 1.2, w: 4.3, h: 4, fill: { color: "FFFFFF" } } }
    ]
  });

  defineModernMasters(pres, primary, bgColor);

  let parsedSlides: SlideData[] = [];
  if (typeof markdownOrSlides === 'string') {
    const trimmed = markdownOrSlides.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const rawSlides = Array.isArray(parsed) ? parsed : (parsed.slides || [parsed]);
        parsedSlides = rawSlides.map(normalizeSlideData);
      } catch (e) {
        parsedSlides = parseMarkdownToSlides(markdownOrSlides).map(normalizeSlideData);
      }
    } else {
      parsedSlides = parseMarkdownToSlides(markdownOrSlides).map(normalizeSlideData);
    }
  } else if (Array.isArray(markdownOrSlides)) {
    parsedSlides = markdownOrSlides.map(normalizeSlideData);
  }

  if (parsedSlides.length === 0) {
    const slide = pres.addSlide({ masterName: "TITLE_SLIDE" });
    slide.addText(title, {
      x: 0.5, y: 1.5, w: "90%", h: 2,
      fontSize: 44, fontFace: headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });
  } else {
    for (let i = 0; i < parsedSlides.length; i++) {
        const slideData = parsedSlides[i];
        const isFirst = i === 0;
        
        // Determine layout based on content, allowing manual override even for first slide
        const layout = slideData.layoutHint || (isFirst ? 'title' : chooseLayout(slideData));

        if (layout === 'title') {
            addTitleSlide(pres, slideData, headingFont, bodyFont);
        } else if (layout === 'section') {
            const slide = pres.addSlide({ masterName: "SECTION_MASTER" });
            slide.addText(slideData.title, {
              x: 1.0, y: 1.8, w: 8.0, h: 1.2,
              fontSize: 44, fontFace: headingFont, color: "FFFFFF", bold: true, align: "left", valign: "middle"
            });
            if (slideData.bodyText.length > 0) {
              slide.addText(slideData.bodyText.join("\n"), {
                x: 1.0, y: 3.2, w: 8.0, h: 1.5,
                fontSize: 18, fontFace: bodyFont, color: "FFFFFF", transparency: 20, align: "left", valign: "top"
              });
            }
            if (slideData.speakerNotes || slideData.fullText) slide.addNotes(slideData.speakerNotes || slideData.fullText || "");
        } else if (layout === 'split') {
            addSplitSlides(pres, slideData, headingFont, bodyFont, primary, textColor);
        } else if (layout === 'comparison') {
            addComparisonSlide(pres, slideData, headingFont, bodyFont, primary, accent, textColor);
        } else if (layout === 'columns') {
            buildColumnSlide(pres, slideData, primary, headingFont, bodyFont);
        } else if (layout === 'timeline') {
            buildTimelineSlide(pres, slideData, primary);
        } else if (layout === 'image') {
            addImageSlide(pres, slideData, headingFont, bodyFont, primary);
        } else {
            addContentSlides(pres, slideData, headingFont, bodyFont, primary, textColor);
        }
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

export function chooseLayout(data: SlideData): 'standard' | 'split' | 'section' | 'comparison' | 'columns' | 'timeline' | 'image' | 'title' {
  if (data.layoutHint) return data.layoutHint as any;

  const titleLower = data.title.toLowerCase();
  const isGeneric = titleLower.includes('question') || titleLower.includes('discussion') || titleLower.includes('vision');
  
  if (data.table) return 'standard';
  
  const isComparison = !isGeneric && (titleLower.includes('vs') || 
                      titleLower.includes('comparison') ||
                      (data.bullets.length === 2 && data.subBullets.size >= 1));
  if (isComparison) return 'comparison';

  if (!isGeneric && data.bullets.length >= 3 && data.bullets.length <= 4 && Array.from(data.subBullets.values()).every(v => v.length <= 3)) {
      return 'columns';
  }

  const hasTimeline = data.bullets.some(b => /^(19|20)\d{2}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(b));
  if (hasTimeline && data.bullets.length >= 3 && !isGeneric) return 'timeline';

  if (data.bullets.length === 0 && data.bodyText.length < 5) return 'section';
  if (data.bullets.length > 0 && data.bullets.length <= 8 && data.title.length < 40) return 'split';
  
  return 'standard';
}

function addTitleSlide(pres: pptxgen, data: SlideData, headingFont: string, bodyFont: string) {
  const slide = pres.addSlide({ masterName: "TITLE_SLIDE" });
  
  slide.addText(data.title, {
    x: 0.5, y: 1.0, w: "90%", h: 2.0,
    fontSize: 54, fontFace: headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle"
  });

  const subtitle = data.header || data.bodyText[0] || (data.bullets.length > 0 ? data.bullets[0] : "");
  if (subtitle) {
    slide.addText(stripBold(subtitle), {
      x: 0.5, y: 3.2, w: "90%", h: 1,
      fontSize: 28, fontFace: bodyFont, color: "EEEEEE", align: "center", valign: "top"
    });
  }

  if (data.bodyText.length > 1 || (data.bullets.length > 1 && !subtitle)) {
    const metaLines = data.bodyText.length > 1 ? data.bodyText.slice(1).map(l => stripBold(l)).join("\n") : "";
    slide.addText(metaLines, {
      x: 0.5, y: 4.5, w: "90%", h: 1,
      fontSize: 16, fontFace: bodyFont, color: "DDDDDD", align: "center", valign: "top"
    });
  }

  if (data.speakerNotes || data.fullText) slide.addNotes(data.speakerNotes || data.fullText || "");
}


function addComparisonSlide(pres: pptxgen, data: SlideData, headingFont: string, bodyFont: string, primary: string, accent: string, textColor: string) {
  const slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
  
  slide.addText(data.title, {
    x: MARGIN_X, y: HEADER_Y, w: "90%", h: HEADER_HEIGHT,
    fontSize: 36, fontFace: headingFont, color: primary, bold: true
  });

  const mid = Math.ceil(data.bullets.length / 2);
  const leftBullets = data.bullets.slice(0, mid);
  const rightBullets = data.bullets.slice(mid);

  const addColumn = (bullets: string[], xOff: number, startIdx: number, color: string) => {
    let bulletProps: pptxgen.TextProps[] = [];
    bullets.forEach((b, idx) => {
      const globalIdx = startIdx + idx;
      bulletProps.push({
        text: stripBold(b),
        options: { bullet: true, fontSize: 22, fontFace: bodyFont, color, bold: hasBoldPrefix(b), paraSpaceAfter: 4 }
      });
      const subs = data.subBullets.get(globalIdx) || [];
      subs.forEach(s => {
        bulletProps.push({
          text: stripBold(s),
          options: { bullet: true, fontSize: 18, fontFace: bodyFont, color: "666666", indentLevel: 1, paraSpaceAfter: 2 }
        });
      });
    });

    slide.addText(bulletProps, {
      x: xOff, y: 1.5, w: 4.5, h: 3.5,
      valign: "top", fill: { color: "FFFFFF" }
    });
  };

  addColumn(leftBullets, 0.3, 0, textColor);
  addColumn(rightBullets, 5.2, mid, textColor);

  slide.addShape(pres.ShapeType.line, {
      x: 5.0, y: 1.5, w: 0, h: 3.5,
      line: { color: accent, width: 2 }
  });

  if (data.speakerNotes || data.fullText) slide.addNotes(data.speakerNotes || data.fullText || "");
}



function addSplitSlides(pres: pptxgen, data: SlideData, headingFont: string, bodyFont: string, primary: string, _textColor: string) {
  // The SPLIT_MASTER puts the primary color on the right half, so all right-panel
  // text must be white/light to remain legible on that colored background.
  const RIGHT_TEXT_COLOR = "FFFFFF";   // White on primary-color panel
  const RIGHT_SUB_COLOR = "D4E0F5";    // Pale tint for sub-bullets (readable on any mid/dark primary)

  let slideNum = 1;
  let currentSlide = createNewSplitSlide(pres, data, headingFont, primary, slideNum);
  const notesText = data.speakerNotes || data.fullText || "";
  // Add notes to first slide immediately
  if (notesText) currentSlide.addNotes(notesText);
  
  const RIGHT_START_X = 4.0;
  const RIGHT_WIDTH = 5.6;
  const RIGHT_PADDING_TOP = 1.0; // Add some breathing room at top of right panel
  let currentY = RIGHT_PADDING_TOP;

  const checkOverflow = (heightNeeded: number) => {
    if (currentY + heightNeeded > SLIDE_HEIGHT - FOOTER_RESERVE) {
      slideNum++;
      currentSlide = createNewSplitSlide(pres, data, headingFont, primary, slideNum);
      // Also add notes to continuation slides
      if (notesText) currentSlide.addNotes(notesText);
      currentY = RIGHT_PADDING_TOP;
      return true;
    }
    return false;
  };

  // bodyText items are kicker/thesis sentences from the AI pipeline — display prominently
  let hasBodyText = false;
  for (const paragraph of data.bodyText) {
    const text = stripBold(paragraph);
    if (!text) continue;
    hasBodyText = true;
    const fontSize = 18; // Prominent kicker size
    const height = estimateTextHeight(text, fontSize, RIGHT_WIDTH);
    
    checkOverflow(height + 0.2);

    currentSlide.addText(text, {
      x: RIGHT_START_X, y: currentY, w: RIGHT_WIDTH, h: height,
      fontSize: fontSize, fontFace: bodyFont, 
      color: RIGHT_TEXT_COLOR, 
      bold: true,
      italic: false,
      valign: "top"
    });
    currentY += height + 0.22;
  }

  // Thin white separator between kicker and bullets for visual hierarchy
  if (hasBodyText && data.bullets.length > 0) {
    currentSlide.addShape(pres.ShapeType.rect, {
      x: RIGHT_START_X, y: currentY, w: 1.5, h: 0.02,
      fill: { color: "FFFFFF", transparency: 40 },
      line: { color: "FFFFFF", transparency: 40, width: 0 }
    });
    currentY += 0.22;
  }

  if (data.bullets.length > 0) {
    let bulletGroup: pptxgen.TextProps[] = [];
    let groupStartY = currentY;

    for (let bIdx = 0; bIdx < data.bullets.length; bIdx++) {
      const bText = stripBold(data.bullets[bIdx]);
      const bHeight = estimateTextHeight(bText, 16, RIGHT_WIDTH - 0.2); 
      
      const subItems = data.subBullets.get(bIdx) || [];
      let subHeightTotal = 0;
      const subProps: pptxgen.TextProps[] = subItems.map(s => {
        const sText = stripBold(s);
        const sHeight = estimateTextHeight(sText, 13, RIGHT_WIDTH - 0.5);
        subHeightTotal += sHeight + 0.06;
        return {
          text: sText,
          options: { bullet: { type: "bullet" }, fontSize: 13, fontFace: bodyFont, color: RIGHT_SUB_COLOR, indentLevel: 1, paraSpaceAfter: 3 }
        };
      });

      const totalItemHeight = bHeight + subHeightTotal + 0.18;

      if (currentY + totalItemHeight > SLIDE_HEIGHT - FOOTER_RESERVE) {
          if (bulletGroup.length > 0) {
              currentSlide.addText(bulletGroup, { 
                  x: RIGHT_START_X, y: groupStartY, w: RIGHT_WIDTH, 
                  h: currentY - groupStartY, valign: "top" 
              });
          }
          slideNum++;
          currentSlide = createNewSplitSlide(pres, data, headingFont, primary, slideNum);
          if (notesText) currentSlide.addNotes(notesText);
          currentY = RIGHT_PADDING_TOP;
          groupStartY = currentY;
          bulletGroup = [];
      }

      bulletGroup.push({
        text: bText,
        options: {
          bullet: { type: "bullet" }, fontSize: 16, fontFace: bodyFont, color: RIGHT_TEXT_COLOR,
          bold: hasBoldPrefix(data.bullets[bIdx]), paraSpaceAfter: 5, indentLevel: 0
        }
      });
      bulletGroup.push(...subProps);
      currentY += totalItemHeight;
    }

    if (bulletGroup.length > 0) {
      currentSlide.addText(bulletGroup, {
        x: RIGHT_START_X, y: groupStartY, w: RIGHT_WIDTH, h: currentY - groupStartY,
        valign: "top"
      });
    }
  }
}

function createNewSplitSlide(pres: pptxgen, data: SlideData, headingFont: string, primary: string, slideNum: number) {
  const slide = pres.addSlide({ masterName: "SPLIT_MASTER" });
  const displayTitle = (data.title || "Slide") + (slideNum > 1 ? ` (Cont. ${slideNum})` : "");
  
  // Left panel: title in primary color on the light background
  slide.addText(displayTitle, {
    x: 0.4, y: 0.7, w: 3.1, h: 4.5,
    fontSize: 34, fontFace: headingFont, color: primary, bold: true, align: "left", valign: "middle",
    shrinkText: true
  });

  // No separator line needed — the SPLIT_MASTER already creates a hard color split at x=3.75

  return slide;
}

function addImageSlide(pres: pptxgen, data: SlideData, headingFont: string, bodyFont: string, primary: string) {
  const slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slide.addText(data.title, {
    x: MARGIN_X, y: HEADER_Y, w: "90%", h: HEADER_HEIGHT,
    fontSize: 32, fontFace: headingFont, color: primary, bold: true
  });
  if (data.images && data.images.length > 0) {
      slide.addImage({ path: data.images[0].path, x: 1, y: 1.4, w: 8, h: 3.8 });
      if (data.images[0].alt) {
          slide.addText(data.images[0].alt, { x: 1, y: 5.2, w: 8, h: 0.3, fontSize: 12, align: "center", fontFace: bodyFont });
      }
  }
  if (data.speakerNotes || data.fullText) slide.addNotes(data.speakerNotes || data.fullText || "");
}

function addContentSlides(pres: pptxgen, data: SlideData, headingFont: string, bodyFont: string, primary: string, textColor: string) {
  let currentY = CONTENT_START_Y;
  let slideNum = 1;
  let currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);
  const notesText = data.speakerNotes || data.fullText || "";
  if (notesText) currentSlide.addNotes(notesText);

  const checkOverflow = (heightNeeded: number) => {
    if (currentY + heightNeeded > SLIDE_HEIGHT - FOOTER_RESERVE) {
      slideNum++;
      currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);
      if (notesText) currentSlide.addNotes(notesText);
      currentY = CONTENT_START_Y;
      return true;
    }
    return false;
  };

  for (const paragraph of data.bodyText) {
    const text = stripBold(paragraph);
    const isLabel = paragraph.includes(':') && paragraph.length < 60;
    const isGoal = paragraph.toLowerCase().startsWith('goal:');
    const fontSize = 18; 
    const height = estimateTextHeight(text, fontSize, SLIDE_WIDTH - 1);
    
    checkOverflow(height + 0.1);

    currentSlide.addText(text, {
      x: MARGIN_X, y: currentY, w: SLIDE_WIDTH - 1, h: height,
      fontSize: fontSize, fontFace: bodyFont, 
      color: isLabel || isGoal ? primary : "2C2C2C",
      valign: "top", 
      italic: !isLabel && !isGoal,
      bold: isLabel || isGoal
    });
    currentY += height + 0.2; 
  }

  if (data.bullets.length > 0) {
    let bulletGroup: pptxgen.TextProps[] = [];
    let groupStartY = currentY;

    for (let bIdx = 0; bIdx < data.bullets.length; bIdx++) {
      const bText = stripBold(data.bullets[bIdx]);
      const bFontSize = 24; 
      const bHeight = estimateTextHeight(bText, bFontSize, SLIDE_WIDTH - 1.2); 
      
      const subItems = data.subBullets.get(bIdx) || [];
      let subHeightTotal = 0;
      const subProps: pptxgen.TextProps[] = subItems.map(s => {
        const sText = stripBold(s);
        const sFontSize = 18; 
        const sHeight = estimateTextHeight(sText, sFontSize, SLIDE_WIDTH - 1.5);
        subHeightTotal += sHeight + 0.05;
        return {
          text: sText,
          options: { bullet: { type: "bullet" }, fontSize: sFontSize, fontFace: bodyFont, color: "666666", indentLevel: 1, paraSpaceAfter: 2 }
        };
      });

      const totalItemHeight = bHeight + subHeightTotal + 0.2;

      if (currentY + totalItemHeight > SLIDE_HEIGHT - FOOTER_RESERVE) {
          if (bulletGroup.length > 0) {
              currentSlide.addText(bulletGroup, { 
                  x: MARGIN_X, y: groupStartY, w: SLIDE_WIDTH - 1, 
                  h: currentY - groupStartY, valign: "top" 
              });
          }
          slideNum++;
          currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);
          if (notesText) currentSlide.addNotes(notesText);
          currentY = CONTENT_START_Y;
          groupStartY = currentY;
          bulletGroup = [];
      }

      bulletGroup.push({
        text: bText,
        options: {
          bullet: { type: "bullet" }, fontSize: bFontSize, fontFace: bodyFont, color: "222222",
          bold: hasBoldPrefix(data.bullets[bIdx]), paraSpaceAfter: 4, indentLevel: 0
        }
      });
      bulletGroup.push(...subProps);
      currentY += totalItemHeight;
    }

    if (bulletGroup.length > 0) {
      currentSlide.addText(bulletGroup, {
        x: MARGIN_X, y: groupStartY, w: SLIDE_WIDTH - 1, h: currentY - groupStartY,
        valign: "top"
      });
    }
  }

  if (data.table) {
    let tableRows = [...data.table.rows];
    const headers = data.table.headers;
    const TOTAL_TABLE_WIDTH = 9.4;
    const colWidths = calculateColumnWidths(headers, tableRows, TOTAL_TABLE_WIDTH);
    const HEADER_FONT_SIZE = 14; 
    const BODY_FONT_SIZE = 12; 

    const headerHeight = estimateTableRowHeight(headers, colWidths, HEADER_FONT_SIZE);
    
    while (tableRows.length > 0) {
        let availableSpace = SLIDE_HEIGHT - FOOTER_RESERVE - currentY;
        
        if (availableSpace < headerHeight + 0.5) {
            slideNum++;
            currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);
            if (notesText) currentSlide.addNotes(notesText);
            currentY = CONTENT_START_Y;
            availableSpace = SLIDE_HEIGHT - FOOTER_RESERVE - currentY;
        }

        let chunkRows: string[][] = [];
        let usedHeight = headerHeight;
        
        while (tableRows.length > 0) {
            const nextRow = tableRows[0];
            const nextRowHeight = estimateTableRowHeight(nextRow, colWidths, BODY_FONT_SIZE);
            if (usedHeight + nextRowHeight > availableSpace) {
                if (chunkRows.length === 0) {
                    chunkRows.push(tableRows.shift()!);
                    usedHeight += nextRowHeight;
                }
                break;
            }
            chunkRows.push(tableRows.shift()!);
            usedHeight += nextRowHeight;
        }
        
        const tableData: pptxgen.TableRow[] = [
          headers.map((h) => ({
            text: stripBold(h),
            options: { 
              bold: true, fontSize: HEADER_FONT_SIZE, fontFace: bodyFont, color: "FFFFFF", 
              fill: { color: primary }, align: "center", valign: "middle",
              border: { type: "solid", pt: 1, color: "FFFFFF" }
            }
          }))
        ];
        
        chunkRows.forEach(row => {
          tableData.push(row.map((cell) => ({
            text: stripBold(cell.replace(/<br\/?>/g, '\n')),
            options: { 
                fontSize: BODY_FONT_SIZE, fontFace: bodyFont, color: textColor, valign: "top",
                border: { type: "solid", pt: 0.5, color: "DDDDDD" } 
            }
          })));
        });

        currentSlide.addTable(tableData, {
          x: 0.3, y: currentY, w: TOTAL_TABLE_WIDTH,
          colW: colWidths,
          autoPage: false
        });
        
        currentY += usedHeight + 0.2;
        
        if (tableRows.length > 0) {
            slideNum++;
            currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);
            if (notesText) currentSlide.addNotes(notesText);
            currentY = CONTENT_START_Y;
        }
    }
  }
}

function createNewContentSlide(pres: pptxgen, data: SlideData, headingFont: string, primary: string, slideNum: number) {
  const slide = pres.addSlide({ masterName: "MASTER_SLIDE" });
  const displayTitle = (data.header || data.title || "Slide") + (slideNum > 1 ? ` (Cont. ${slideNum})` : "");
  
  slide.addText(displayTitle, {
    x: MARGIN_X, y: HEADER_Y, w: "90%", h: HEADER_HEIGHT,
    fontSize: 28, fontFace: headingFont, color: primary, bold: true
  });
  return slide;
}

function estimateTextHeight(text: string, fontSize: number, widthInches: number): number {
  if (!text) return 0.2;
  const widthPoints = widthInches * 72;
  const charsPerLine = Math.max(1, Math.floor(widthPoints / (fontSize * 0.42))); 
  
  const paragraphs = text.split('\n');
  let totalLines = 0;
  
  for (const p of paragraphs) {
    const pLength = p.trim().length;
    if (pLength === 0) {
      totalLines += 0.5;
      continue;
    }
    totalLines += Math.max(1, Math.ceil(pLength / charsPerLine));
  }
  
  return (totalLines * (fontSize / 72) * 1.3) + 0.05;
}

function calculateColumnWidths(headers: string[], rows: string[][], totalWidth: number): number[] {
  const colCount = headers.length;
  if (colCount === 0) return [];
  
  const weights = new Array(colCount).fill(0);

  headers.forEach((h, i) => {
    weights[i] = Math.max(weights[i], Math.min(h.length, 20) * 1.5);
  });

  rows.forEach(row => {
    row.forEach((cell, i) => {
      if (i < colCount) {
        const len = cell.length;
        weights[i] = Math.max(weights[i], Math.min(len, 100)); 
      }
    });
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let widths = weights.map(w => Math.max(0.7, (w / totalWeight) * totalWidth));
  const currentTotal = widths.reduce((a, b) => a + b, 0);
  const factor = totalWidth / currentTotal;
  return widths.map(w => w * factor);
}

function estimateTableRowHeight(row: string[], colWidths: number[], fontSize: number): number {
  let maxHeight = 0;
  row.forEach((cell, i) => {
    const height = estimateTextHeight(cell, fontSize, colWidths[i] || 1);
    if (height > maxHeight) maxHeight = height;
  });
  return Math.max(0.35, maxHeight);
}

function stripBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
}

function hasBoldPrefix(text: string): boolean {
  return /^\*\*.+?\*\*/.test(text.trim());
}

export function parseMarkdownToSlides(content: string): SlideData[] {
  const slides: SlideData[] = [];
  const lines = content.split('\n');

  const sections: { title: string; lines: string[]; isMajor?: boolean; startLine: number }[] = [];
  let currentSection: { title: string; lines: string[]; isMajor?: boolean; startLine: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const h1Match = trimmed.match(/^#\s+(.+)/);
    const h2Match = trimmed.match(/^##\s+(.+)/);
    const slideMatch = trimmed.match(/^(?:#+\s*)?(?:\d+\.\s*)?Slide\s*\d*(?::|-)\s*(.*)/i);

    if (h1Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: h1Match[1].trim(), lines: [], isMajor: true, startLine: i };
    } else if (h2Match || slideMatch) {
      if (currentSection) sections.push(currentSection);
      const title = slideMatch ? slideMatch[1].trim() : h2Match![1].trim();
      currentSection = { title: title || "Untitled", lines: [], isMajor: false, startLine: i };
    } else if (trimmed === '---') {
      if (currentSection) sections.push(currentSection);
      currentSection = null;
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else if (trimmed.length > 0) {
      const defaultTitle = sections.length === 0 ? "Introduction" : "End Slide";
      currentSection = { title: defaultTitle, lines: [line], isMajor: false, startLine: i };
    }
  }
  if (currentSection) sections.push(currentSection);

  for (const section of sections) {
    const slide: SlideData = { 
      title: section.title, 
      bullets: [], 
      subBullets: new Map(), 
      bodyText: [],
      images: [],
      layoutHint: section.isMajor ? 'section' : undefined,
      startLine: section.startLine
    };
    
    let inTable = false, tableHeaders: string[] = [], tableRows: string[][] = [];
    let inSpeakerNotes = false, speakerNotesLines: string[] = [];
    // orderedNotesLines captures content in document order (bodyText and bullets interleaved)
    // so speaker notes reflect the original reading flow, not a re-grouped dump.
    const orderedNotesLines: string[] = [];

    for (const line of section.lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) { inSpeakerNotes = false; continue; }

      const h3Match = trimmed.match(/^###\s+(.+)/);
      if (h3Match) { slide.header = h3Match[1].trim(); continue; }
      if (/^#+\s/.test(trimmed)) continue;

      const headerMatch = trimmed.match(/^\*\*\s*(?:Header|Layout)\s*[:\*]*\s*(.*?)(?:\*\*|$)/i);
      if (headerMatch) { 
        const val = headerMatch[1].toLowerCase().trim();
        if (val === 'split') slide.layoutHint = 'split';
        else if (val === 'section') slide.layoutHint = 'section';
        else if (val === 'standard') slide.layoutHint = 'standard';
        else if (val === 'comparison') slide.layoutHint = 'comparison';
        else if (val === 'columns') slide.layoutHint = 'columns';
        else if (val === 'timeline') slide.layoutHint = 'timeline';
        else if (val === 'title') slide.layoutHint = 'title';
        else if (val === 'image') slide.layoutHint = 'image';
        else slide.header = stripBold(headerMatch[1]); 
        continue; 
      }

      const notesMatch = trimmed.match(/^\*\*\s*Speaker Notes\s*[:\*]*\s*(.*)/i);
      if (notesMatch) { inSpeakerNotes = true; if (notesMatch[1].trim()) speakerNotesLines.push(stripBold(notesMatch[1])); continue; }
      if (inSpeakerNotes) { speakerNotesLines.push(trimmed); continue; }

      const imageMatch = trimmed.match(/!\[(.*?)\]\((.*?)\)/);
      if (imageMatch) {
          slide.images!.push({ alt: imageMatch[1], path: imageMatch[2] });
          if (slide.images!.length === 1 && slide.bullets.length === 0 && !slide.layoutHint) {
              slide.layoutHint = 'image';
          }
          continue;
      }

      if (trimmed.startsWith('|')) {
        if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;
        const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
        if (!inTable) { inTable = true; tableHeaders = cells; } else tableRows.push(cells);
        continue;
      } else if (inTable) {
        slide.table = { headers: tableHeaders, rows: tableRows };
        inTable = false;
      }

      const subBulletMatch = line.match(/^(?:\s{2,}|\t)(?:[-*]|\d+\.)\s+(.*)/);
      if (subBulletMatch) {
        const parentIdx = slide.bullets.length - 1;
        const subText = subBulletMatch[1].trim();
        if (parentIdx >= 0) {
          if (!slide.subBullets.has(parentIdx)) slide.subBullets.set(parentIdx, []);
          slide.subBullets.get(parentIdx)!.push(subText);
          // Add sub-bullet to ordered notes with indentation marker
          orderedNotesLines.push(`  • ${stripBold(subText)}`);
        }
        continue;
      }

      const bulletMatch = line.match(/^(?:[-*]|\d+\.)\s+(.*)/);
      if (bulletMatch) {
        const bulletText = bulletMatch[1].trim();
        slide.bullets.push(bulletText);
        // Add bullet to ordered notes so it appears in document order
        orderedNotesLines.push(`• ${stripBold(bulletText)}`);
        continue;
      }

      if (trimmed.length > 0) {
        slide.bodyText.push(trimmed);
        // Add body paragraph to ordered notes in document order
        orderedNotesLines.push(stripBold(trimmed));
      }
    }
    if (inTable && tableHeaders.length > 0) slide.table = { headers: tableHeaders, rows: tableRows };

    // Speaker notes priority: explicit "**Speaker Notes:**" block wins; otherwise use
    // the ordered notes built from document line traversal (preserves interleave order).
    if (speakerNotesLines.length > 0) {
      slide.speakerNotes = speakerNotesLines.join('\n');
    } else if (orderedNotesLines.length > 0) {
      slide.speakerNotes = orderedNotesLines.join('\n');
    }
    // fullText always mirrors speakerNotes so downstream consumers get ordered content
    slide.fullText = slide.speakerNotes || '';

    if (slide.bullets.length > 0 || slide.bodyText.length > 0 || slide.table || slide.header || (slide.images && slide.images.length > 0)) slides.push(slide);
  }
  return slides;
}
