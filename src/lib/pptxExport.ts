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
  layoutHint?: 'standard' | 'split' | 'section' | 'title';
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

  const headingFont = brandSettings?.typography?.heading_font || brandSettings?.fontFamily || "Inter";
  const bodyFont = brandSettings?.typography?.body_font || headingFont;
  const primaryRaw = brandSettings?.colors?.primary || brandSettings?.primaryColor || "0052FF"; // Modern bright blue default
  const primary = primaryRaw.replace(/^#/, '');

  let defaultUsed = !brandSettings?.colors?.primary && !brandSettings?.primaryColor && !brandSettings?.typography?.heading_font && !brandSettings?.fontFamily;

  // Define Slide Masters
  pres.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.15, fill: { color: primary } } } // Slimmer sleek bar
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
    title: "SECTION_MASTER",
    background: { color: primary },
    objects: [
      { rect: { x: 0, y: 0, w: 0.6, h: "100%", fill: { color: "00000022" } } } // Side accent
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
      fontSize: 44, fontFace: headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });
  } else {
    for (let i = 0; i < parsedSlides.length; i++) {
      const slideData = parsedSlides[i];
      const isFirst = i === 0;
      
      // Determine layout based on content
      const layout = isFirst ? 'title' : (slideData.layoutHint || chooseLayout(slideData));

      if (layout === 'title') {
        addTitleSlide(pres, slideData, headingFont, bodyFont);
      } else if (layout === 'section') {
        addSectionSlide(pres, slideData, headingFont, bodyFont);
      } else if (layout === 'split') {
        addSplitSlides(pres, slideData, headingFont, bodyFont, primary);
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

function chooseLayout(data: SlideData): 'standard' | 'split' | 'section' {
  if (data.table) return 'standard';
  if (data.bullets.length === 0 && data.bodyText.length < 5) return 'section';
  // If we have a reasonable amount of content and a clear title, split looks great
  if (data.bullets.length > 0 && data.bullets.length <= 8 && data.title.length < 40) return 'split';
  return 'standard';
}

function addTitleSlide(pres: pptxgen, data: SlideData, headingFont: string, bodyFont: string) {
  const slide = pres.addSlide({ masterName: "TITLE_SLIDE" });
  
  // Add some decorative shapes for "Premium" feel
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 2.5, w: "100%", h: 0.1, fill: { color: "FFFFFF33" } });

  slide.addText(data.title, {
    x: 0.5, y: 1.0, w: "90%", h: 1.5,
    fontSize: 48, fontFace: headingFont, color: "FFFFFF", bold: true, align: "center", valign: "middle"
  });

  const subtitle = data.bodyText[0] || (data.bullets.length > 0 ? data.bullets[0] : "");
  if (subtitle) {
    slide.addText(stripBold(subtitle), {
      x: 0.5, y: 2.8, w: "90%", h: 1,
      fontSize: 22, fontFace: bodyFont, color: "EEEEEE", align: "center", valign: "top"
    });
  }

  if (data.bodyText.length > 1) {
    const metaLines = data.bodyText.slice(1).map(l => stripBold(l)).join("\n");
    slide.addText(metaLines, {
      x: 0.5, y: 4.2, w: "90%", h: 1,
      fontSize: 14, fontFace: bodyFont, color: "DDDDDD", align: "center", valign: "top"
    });
  }

  if (data.speakerNotes) slide.addNotes(data.speakerNotes);
}

function addSectionSlide(pres: pptxgen, data: SlideData, headingFont: string, bodyFont: string) {
  const slide = pres.addSlide({ masterName: "SECTION_MASTER" });
  
  slide.addText(data.title, {
    x: 1, y: 1.5, w: 8, h: 2,
    fontSize: 42, fontFace: headingFont, color: "FFFFFF", bold: true, align: "left", valign: "middle"
  });

  if (data.bodyText.length > 0) {
    slide.addText(data.bodyText.join("\n"), {
      x: 1, y: 3.5, w: 8, h: 1.5,
      fontSize: 18, fontFace: bodyFont, color: "FFFFFFEE", align: "left", valign: "top"
    });
  }
}

function addSplitSlides(pres: pptxgen, data: SlideData, headingFont: string, bodyFont: string, primary: string) {
  let slideNum = 1;
  let currentSlide = createNewSplitSlide(pres, data, headingFont, primary, slideNum);
  
  const RIGHT_START_X = 3.8;
  const RIGHT_WIDTH = 5.8;
  let currentY = 0.8;

  const checkOverflow = (heightNeeded: number) => {
    if (currentY + heightNeeded > SLIDE_HEIGHT - FOOTER_RESERVE) {
      slideNum++;
      currentSlide = createNewSplitSlide(pres, data, headingFont, primary, slideNum);
      currentY = 0.8; // Restart at top of content area
      return true;
    }
    return false;
  };

  // 1. Add Body Text (often used for "What it does", etc.)
  for (const paragraph of data.bodyText) {
    const isLabel = paragraph.includes(':') && paragraph.length < 50;
    const text = stripBold(paragraph);
    const fontSize = isLabel ? 14 : 13;
    const height = estimateTextHeight(text, fontSize, RIGHT_WIDTH);
    
    checkOverflow(height + 0.1);

    currentSlide.addText(text, {
      x: RIGHT_START_X, y: currentY, w: RIGHT_WIDTH, h: height,
      fontSize: fontSize, fontFace: bodyFont, 
      color: isLabel ? primary : "444444", 
      bold: isLabel,
      italic: !isLabel && !paragraph.toLowerCase().startsWith('goal:'),
      valign: "top"
    });
    currentY += height + 0.15;
  }

  // 2. Add Bullets
  if (data.bullets.length > 0) {
    let bulletGroup: pptxgen.TextProps[] = [];
    let groupStartY = currentY;

    for (let bIdx = 0; bIdx < data.bullets.length; bIdx++) {
      const bText = stripBold(data.bullets[bIdx]);
      const bHeight = estimateTextHeight(bText, 15, RIGHT_WIDTH - 0.2); 
      
      const subItems = data.subBullets.get(bIdx) || [];
      let subHeightTotal = 0;
      const subProps: pptxgen.TextProps[] = subItems.map(s => {
        const sText = stripBold(s);
        const sHeight = estimateTextHeight(sText, 12, RIGHT_WIDTH - 0.5);
        subHeightTotal += sHeight + 0.05;
        return {
          text: sText,
          options: { bullet: { type: "bullet" }, fontSize: 12, fontFace: bodyFont, color: "666666", indentLevel: 1, paraSpaceAfter: 2 }
        };
      });

      const totalItemHeight = bHeight + subHeightTotal + 0.15;

      if (currentY + totalItemHeight > SLIDE_HEIGHT - FOOTER_RESERVE) {
          if (bulletGroup.length > 0) {
              currentSlide.addText(bulletGroup, { 
                  x: RIGHT_START_X, y: groupStartY, w: RIGHT_WIDTH, 
                  h: currentY - groupStartY, valign: "top" 
              });
          }
          slideNum++;
          currentSlide = createNewSplitSlide(pres, data, headingFont, primary, slideNum);
          currentY = 0.8;
          groupStartY = currentY;
          bulletGroup = [];
      }

      bulletGroup.push({
        text: bText,
        options: {
          bullet: { type: "bullet" }, fontSize: 15, fontFace: bodyFont, color: "222222",
          bold: hasBoldPrefix(data.bullets[bIdx]), paraSpaceAfter: 4, indentLevel: 0
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

  if (data.speakerNotes) currentSlide.addNotes(data.speakerNotes);
}

function createNewSplitSlide(pres: pptxgen, data: SlideData, headingFont: string, primary: string, slideNum: number) {
  const slide = pres.addSlide({ masterName: "MODERN_MASTER" });
  const displayTitle = (data.title || "Slide") + (slideNum > 1 ? ` (Cont. ${slideNum})` : "");
  
  // Left Side Title
  slide.addText(displayTitle, {
    x: 0.5, y: 0.8, w: 2.8, h: 4,
    fontSize: 34, fontFace: headingFont, color: primary, bold: true, align: "left", valign: "top"
  });

  // Vertical line divider from the design mockup
  slide.addShape(pres.ShapeType.line, {
    x: 3.5, y: 0.6, w: 0, h: 4.5,
    line: { color: "E1E1E1", width: 1 }
  });

  return slide;
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
    const isLabel = paragraph.includes(':') && paragraph.length < 60;
    const isGoal = paragraph.toLowerCase().startsWith('goal:');
    const height = estimateTextHeight(text, 14, SLIDE_WIDTH - 1);
    
    checkOverflow(height + 0.1);

    currentSlide.addText(text, {
      x: MARGIN_X, y: currentY, w: SLIDE_WIDTH - 1, h: height,
      fontSize: 14, fontFace: bodyFont, 
      color: isLabel || isGoal ? primary : "555555", 
      valign: "top", 
      italic: !isLabel && !isGoal,
      bold: isLabel || isGoal
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
    const TOTAL_TABLE_WIDTH = 9.4;
    const colWidths = calculateColumnWidths(headers, tableRows, TOTAL_TABLE_WIDTH);
    const HEADER_FONT_SIZE = 10;
    const BODY_FONT_SIZE = 9;

    const headerHeight = estimateTableRowHeight(headers, colWidths, HEADER_FONT_SIZE);
    
    while (tableRows.length > 0) {
        let availableSpace = SLIDE_HEIGHT - FOOTER_RESERVE - currentY;
        
        // If we can't fit even the header + 1 row, move to next slide
        if (availableSpace < headerHeight + 0.4) {
            slideNum++;
            currentSlide = createNewContentSlide(pres, data, headingFont, primary, slideNum);
            currentY = CONTENT_START_Y;
            availableSpace = SLIDE_HEIGHT - FOOTER_RESERVE - currentY;
        }

        let chunkRows: string[][] = [];
        let usedHeight = headerHeight;
        
        // Add rows one by one until we overflow the slide
        while (tableRows.length > 0) {
            const nextRow = tableRows[0];
            const nextRowHeight = estimateTableRowHeight(nextRow, colWidths, BODY_FONT_SIZE);
            
            // Check if adding this row would exceed available space
            if (usedHeight + nextRowHeight > availableSpace) {
                // If it's a fresh slide and even the first row doesn't fit, we have to force it
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
              fill: { color: primary }, align: "center", valign: "middle" 
            }
          }))
        ];
        
        chunkRows.forEach(row => {
          tableData.push(row.map((cell) => ({
            text: stripBold(cell.replace(/<br\/?>/g, '\n')),
            options: { fontSize: BODY_FONT_SIZE, fontFace: bodyFont, color: "333333", valign: "top" }
          })));
        });

        currentSlide.addTable(tableData, {
          x: 0.3, y: currentY, w: TOTAL_TABLE_WIDTH,
          colW: colWidths,
          border: { type: "solid", pt: 0.5, color: "CCCCCC" },
          autoPage: false
        });
        
        currentY += usedHeight + 0.1;
        
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

  // Heuristic: Measure content to decide weights
  headers.forEach((h, i) => {
    weights[i] = Math.max(weights[i], Math.min(h.length, 20) * 1.5);
  });

  rows.forEach(row => {
    row.forEach((cell, i) => {
      if (i < colCount) {
        // We give more weight to longer text, but with diminishing returns
        const len = cell.length;
        weights[i] = Math.max(weights[i], Math.min(len, 100)); 
      }
    });
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  // Distribute width proportional to weight, but with a minimum of 0.7 inches (enough for a date or short number)
  let widths = weights.map(w => Math.max(0.7, (w / totalWeight) * totalWidth));
  
  // Re-adjust to ensure total sum is exactly totalWidth (accounting for minimums)
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

      const headerMatch = trimmed.match(/^\*\*\s*(?:Header|Layout)\s*[:\*]*\s*(.*)/i);
      if (headerMatch) { 
        const val = headerMatch[1].toLowerCase().trim();
        if (val === 'split') slide.layoutHint = 'split';
        else if (val === 'section') slide.layoutHint = 'section';
        else if (val === 'standard') slide.layoutHint = 'standard';
        else slide.header = stripBold(headerMatch[1]); 
        continue; 
      }

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
