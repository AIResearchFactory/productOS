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

interface SlideData {
  title: string;
  header?: string;
  bullets: string[];
  subBullets: Map<number, string[]>; // parent bullet index -> sub-bullets
  bodyText: string[];
  speakerNotes?: string;
  table?: { headers: string[]; rows: string[][] };
}

// Layout constants for a standard 10x5.625 inch slide (16:9)
const SLIDE_WIDTH = 10;
const SLIDE_HEIGHT = 5.625;
const MARGIN_X = 0.5;
const HEADER_HEIGHT = 0.8;
const HEADER_Y = 0.6;
const CONTENT_START_Y = 1.4;
const FOOTER_RESERVE = 0.4;

export async function exportToPptx(markdownContent: string, brandSettings?: BrandSettings, title: string = "Presentation") {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";

  const headingFont = brandSettings?.typography?.heading_font || brandSettings?.fontFamily || "Calibri";
  const bodyFont = brandSettings?.typography?.body_font || headingFont;
  const primaryRaw = brandSettings?.colors?.primary || brandSettings?.primaryColor || "2C3E50";
  const primary = primaryRaw.replace(/^#/, '');

  let defaultUsed = !brandSettings?.colors?.primary && !brandSettings?.primaryColor && !brandSettings?.typography?.heading_font && !brandSettings?.fontFamily;

  // Define Slide Masters
  pres.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.5, fill: { color: primary } } }
    ]
  });

  pres.defineSlideMaster({
    title: "TITLE_SLIDE",
    background: { color: primary },
  });

  const parsedSlides = parseMarkdownToSlides(markdownContent);

  if (parsedSlides.length === 0) {
    const slide = pres.addSlide({ masterName: "TITLE_SLIDE" });
    slide.addText(title, {
      x: 0.5, y: 1.5, w: "90%", h: 2,
      fontSize: 36, fontFace: headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });
  } else {
    for (let i = 0; i < parsedSlides.length; i++) {
      const slideData = parsedSlides[i];
      const isTitle = i === 0;

      if (isTitle) {
        addTitleSlide(pres, slideData, headingFont, bodyFont);
      } else {
        addContentSlides(pres, slideData, headingFont, bodyFont, primary);
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

function addTitleSlide(pres: pptxgen, data: SlideData, headingFont: string, bodyFont: string) {
  const slide = pres.addSlide({ masterName: "TITLE_SLIDE" });
  slide.addText(data.title, {
    x: 0.5, y: 1.2, w: "90%", h: 1.5,
    fontSize: 36, fontFace: headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle"
  });

  const subtitle = data.bodyText[0] || (data.bullets.length > 0 ? data.bullets[0] : "");
  if (subtitle) {
    slide.addText(stripBold(subtitle), {
      x: 0.5, y: 3.0, w: "90%", h: 1,
      fontSize: 20, fontFace: bodyFont, color: "CCCCCC", align: "center", valign: "top"
    });
  }

  if (data.bodyText.length > 1) {
    const metaLines = data.bodyText.slice(1).map(l => stripBold(l)).join("\n");
    slide.addText(metaLines, {
      x: 0.5, y: 4.0, w: "90%", h: 1,
      fontSize: 14, fontFace: bodyFont, color: "AAAAAA", align: "center", valign: "top"
    });
  }

  if (data.speakerNotes) slide.addNotes(data.speakerNotes);
}

function addContentSlides(pres: pptxgen, data: SlideData, headingFont: string, bodyFont: string, primary: string) {
  let currentY = CONTENT_START_Y;
  let slideNum = 1;
  let currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);

  // Helper to add a new slide if overflow
  const checkOverflow = (heightNeeded: number) => {
    if (currentY + heightNeeded > SLIDE_HEIGHT - FOOTER_RESERVE) {
      slideNum++;
      currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);
      currentY = CONTENT_START_Y;
      return true;
    }
    return false;
  };

  // 1. Add Body Text
  for (const paragraph of data.bodyText) {
    const text = stripBold(paragraph);
    const height = estimateTextHeight(text, 14, SLIDE_WIDTH - 1);
    checkOverflow(height + 0.1);

    currentSlide.addText(text, {
      x: MARGIN_X, y: currentY, w: SLIDE_WIDTH - 1, h: height,
      fontSize: 14, fontFace: bodyFont, color: "555555", valign: "top", italic: true
    });
    currentY += height + 0.15; // Increased spacing
  }

  // 2. Add Bullets
  if (data.bullets.length > 0) {
    let bulletGroup: pptxgen.TextProps[] = [];
    let groupStartY = currentY;

    for (let bIdx = 0; bIdx < data.bullets.length; bIdx++) {
      const bText = stripBold(data.bullets[bIdx]);
      const bHeight = estimateTextHeight(bText, 16, SLIDE_WIDTH - 1.2); 
      
      const subItems = data.subBullets.get(bIdx) || [];
      let subHeightTotal = 0;
      const subProps: pptxgen.TextProps[] = subItems.map(s => {
        const sText = stripBold(s);
        const sHeight = estimateTextHeight(sText, 13, SLIDE_WIDTH - 1.5);
        subHeightTotal += sHeight + 0.05;
        return {
          text: sText,
          options: { bullet: { type: "bullet" }, fontSize: 13, fontFace: bodyFont, color: "666666", indentLevel: 1, paraSpaceAfter: 2 }
        };
      });

      const totalItemHeight = bHeight + subHeightTotal + 0.15;

      // If this specific bullet item (and its subs) overflows, push current group and start new slide
      if (currentY + totalItemHeight > SLIDE_HEIGHT - FOOTER_RESERVE) {
          if (bulletGroup.length > 0) {
              currentSlide.addText(bulletGroup, { 
                  x: MARGIN_X, y: groupStartY, w: SLIDE_WIDTH - 1, 
                  h: currentY - groupStartY, valign: "top" 
              });
          }
          slideNum++;
          currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);
          currentY = CONTENT_START_Y;
          groupStartY = currentY;
          bulletGroup = [];
      }

      bulletGroup.push({
        text: bText,
        options: {
          bullet: { type: "bullet" }, fontSize: 16, fontFace: bodyFont, color: "333333",
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

  // 3. Add Table (if any)
  if (data.table) {
    let tableRows = [...data.table.rows];
    const headers = data.table.headers;
    
    while (tableRows.length > 0) {
        const rowHeight = 0.35;
        const headerHeight = 0.5;
        const availableSpace = SLIDE_HEIGHT - FOOTER_RESERVE - currentY;
        
        // If we can't fit even the header + 1 row, move to next slide
        if (availableSpace < headerHeight + rowHeight) {
            slideNum++;
            currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);
            currentY = CONTENT_START_Y;
        }
        
        const maxRowsThatFit = Math.floor((SLIDE_HEIGHT - FOOTER_RESERVE - currentY - headerHeight) / rowHeight);
        const chunkRows = tableRows.splice(0, Math.max(1, maxRowsThatFit));
        
        const tableData: pptxgen.TableRow[] = [
          headers.map(h => ({
            text: stripBold(h),
            options: { bold: true, fontSize: 10, fontFace: bodyFont, color: "FFFFFF", fill: { color: primary }, align: "center", valign: "middle" }
          }))
        ];
        
        chunkRows.forEach(row => {
          tableData.push(row.map(cell => ({
            text: stripBold(cell.replace(/<br\/?>/g, '\n')),
            options: { fontSize: 9, fontFace: bodyFont, color: "333333", valign: "top" }
          })));
        });

        currentSlide.addTable(tableData, {
          x: 0.3, y: currentY, w: 9.4,
          border: { type: "solid", pt: 0.5, color: "CCCCCC" },
          autoPage: false
        });
        
        currentY += headerHeight + (chunkRows.length * rowHeight) + 0.2;
        
        if (tableRows.length > 0) {
            slideNum++;
            currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);
            currentY = CONTENT_START_Y;
        }
    }
  }

  if (data.speakerNotes) currentSlide.addNotes(data.speakerNotes);
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
  // Conservative estimate: Calibri/Roboto at 14pt is about 0.07-0.08 inches per character average
  // widthPoints = widthInches * 72
  // Average char width is roughly 0.45 of font size in points
  const widthPoints = widthInches * 72;
  const charsPerLine = Math.floor(widthPoints / (fontSize * 0.42)); 
  
  const paragraphs = text.split('\n');
  let totalLines = 0;
  
  for (const p of paragraphs) {
    const pLength = p.trim().length;
    if (pLength === 0) {
      totalLines += 0.5; // Small gap for empty lines
      continue;
    }
    totalLines += Math.max(1, Math.ceil(pLength / charsPerLine));
  }
  
  // Line spacing of 1.4 + some padding
  return (totalLines * (fontSize / 72) * 1.4) + 0.1;
}

function stripBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
}

function hasBoldPrefix(text: string): boolean {
  return /^\*\*.+?\*\*/.test(text.trim());
}

function parseMarkdownToSlides(content: string): SlideData[] {
  const slides: SlideData[] = [];
  const lines = content.split('\n');

  const sections: { title: string; lines: string[] }[] = [];
  let currentSection: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const h2Match = trimmed.match(/^##\s+(.+)/);
    const h1Match = trimmed.match(/^#\s+(.+)/);
    const slideMatch = trimmed.match(/^(?:#+\s*)?(?:\d+\.\s*)?Slide\s*\d*(?::|-)\s*(.*)/i);

    if (h2Match || slideMatch) {
      if (currentSection) sections.push(currentSection);
      const title = slideMatch ? slideMatch[1].trim() : h2Match![1].trim();
      currentSection = { title: title || "Untitled", lines: [] };
    } else if (h1Match && !currentSection) {
      currentSection = { title: h1Match[1].trim(), lines: [] };
    } else if (trimmed === '---') {
      if (currentSection) sections.push(currentSection);
      currentSection = null;
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else if (trimmed.length > 0) {
      currentSection = { title: "Introduction", lines: [line] };
    }
  }
  if (currentSection) sections.push(currentSection);

  for (const section of sections) {
    const slide: SlideData = { title: section.title, bullets: [], subBullets: new Map(), bodyText: [] };
    let inTable = false, tableHeaders: string[] = [], tableRows: string[][] = [], inSpeakerNotes = false, speakerNotesLines: string[] = [];

    for (const line of section.lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) { inSpeakerNotes = false; continue; }

      const h3Match = trimmed.match(/^###\s+(.+)/);
      if (h3Match) { slide.header = h3Match[1].trim(); continue; }
      if (/^#+\s/.test(trimmed)) continue;

      const headerMatch = trimmed.match(/^\*\*\s*Header\s*[:\*]*\s*(.*)/i);
      if (headerMatch) { slide.header = stripBold(headerMatch[1]); continue; }

      const notesMatch = trimmed.match(/^\*\*\s*Speaker Notes\s*[:\*]*\s*(.*)/i);
      if (notesMatch) { inSpeakerNotes = true; if (notesMatch[1].trim()) speakerNotesLines.push(stripBold(notesMatch[1])); continue; }

      if (inSpeakerNotes) { speakerNotesLines.push(trimmed); continue; }

      if (trimmed.startsWith('|')) {
        if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;
        const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
        if (!inTable) { inTable = true; tableHeaders = cells; } else tableRows.push(cells);
        continue;
      } else if (inTable) {
        slide.table = { headers: tableHeaders, rows: tableRows };
        inTable = false;
      }

      const bulletMatch = line.match(/^[-*]\s+(.*)/);
      if (bulletMatch) { slide.bullets.push(bulletMatch[1].trim()); continue; }

      const subBulletMatch = line.match(/^(?:\s{2,}|\t)[-*]\s+(.*)/);
      if (subBulletMatch) {
        const parentIdx = slide.bullets.length - 1;
        if (parentIdx >= 0) {
          if (!slide.subBullets.has(parentIdx)) slide.subBullets.set(parentIdx, []);
          slide.subBullets.get(parentIdx)!.push(subBulletMatch[1].trim());
        }
        continue;
      }
      if (trimmed.length > 0) slide.bodyText.push(trimmed);
    }
    if (inTable && tableHeaders.length > 0) slide.table = { headers: tableHeaders, rows: tableRows };
    if (speakerNotesLines.length > 0) slide.speakerNotes = speakerNotesLines.join('\n');
    if (slide.bullets.length > 0 || slide.bodyText.length > 0 || slide.table || slide.header) slides.push(slide);
  }
  return slides;
}
