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

export async function exportToPptx(markdownContent: string, brandSettings?: BrandSettings, title: string = "Presentation") {
  const pres = new pptxgen();
  let defaultUsed = false;

  const headingFont = brandSettings?.typography?.heading_font || brandSettings?.fontFamily || "Calibri";
  const bodyFont = brandSettings?.typography?.body_font || headingFont;
  const primaryRaw = brandSettings?.colors?.primary || brandSettings?.primaryColor || "2C3E50";
  const primary = primaryRaw.replace(/^#/, '');
  // accent color available for future use via brandSettings?.colors?.accent

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

  pres.defineSlideMaster({
    title: "TITLE_SLIDE",
    background: { color: primary },
  });

  const slides = parseMarkdownToSlides(markdownContent);

  if (slides.length === 0) {
    // Fallback: if parsing yields nothing, create a single slide with the title
    const slide = pres.addSlide({ masterName: "TITLE_SLIDE" });
    slide.addText(title, {
      x: 0.5, y: 1.5, w: "90%", h: 2,
      fontSize: 36,
      fontFace: headingFont,
      color: "FFFFFF",
      bold: true,
      align: "center",
      valign: "middle"
    });
    try {
      await pres.writeFile({ fileName: `${title}.pptx` });
      return { success: true, defaultUsed };
    } catch (error) {
      console.error("Failed to generate PPTX", error);
      return { success: false, error };
    }
  }

  for (let i = 0; i < slides.length; i++) {
    const slideData = slides[i];
    const isTitle = i === 0;

    if (isTitle) {
      // Title slide with accent background
      const slide = pres.addSlide({ masterName: "TITLE_SLIDE" });
      slide.addText(slideData.title, {
        x: 0.5, y: 1.2, w: "90%", h: 1.5,
        fontSize: 36,
        fontFace: headingFont,
        color: "FFFFFF",
        bold: true,
        align: "center",
        valign: "middle"
      });

      // Subtitle from body text or first bullet
      const subtitle = slideData.bodyText.length > 0
        ? slideData.bodyText[0]
        : slideData.bullets.length > 0
          ? slideData.bullets[0]
          : "";
      if (subtitle) {
        slide.addText(stripBold(subtitle), {
          x: 0.5, y: 3.0, w: "90%", h: 1,
          fontSize: 20,
          fontFace: bodyFont,
          color: "CCCCCC",
          align: "center",
          valign: "top"
        });
      }

      // Additional metadata lines
      if (slideData.bodyText.length > 1) {
        const metaLines = slideData.bodyText.slice(1).map(l => stripBold(l)).join("\n");
        slide.addText(metaLines, {
          x: 0.5, y: 4.0, w: "90%", h: 1,
          fontSize: 14,
          fontFace: bodyFont,
          color: "AAAAAA",
          align: "center",
          valign: "top"
        });
      }

      if (slideData.speakerNotes) {
        slide.addNotes(slideData.speakerNotes);
      }
      continue;
    }

    // Content slides
    const slide = pres.addSlide({ masterName: "MASTER_SLIDE" });

    // Slide title
    slide.addText(slideData.header || slideData.title || "Slide", {
      x: 0.5, y: 0.6, w: "90%", h: 0.8,
      fontSize: 28,
      fontFace: headingFont,
      color: primary,
      bold: true
    });

    let yPosition = 1.5;

    // Body text (non-bullet paragraphs)
    if (slideData.bodyText.length > 0) {
      const bodyContent = slideData.bodyText.map(t => stripBold(t)).join("\n");
      slide.addText(bodyContent, {
        x: 0.5, y: yPosition, w: "90%", h: Math.min(slideData.bodyText.length * 0.35, 1.5),
        fontSize: 14,
        fontFace: bodyFont,
        color: "555555",
        valign: "top",
        italic: true,
      });
      yPosition += Math.min(slideData.bodyText.length * 0.35, 1.5) + 0.1;
    }

    // Bullet points with sub-bullets
    if (slideData.bullets.length > 0) {
      const textRows: pptxgen.TextProps[] = [];
      for (let bIdx = 0; bIdx < slideData.bullets.length; bIdx++) {
        textRows.push({
          text: stripBold(slideData.bullets[bIdx]),
          options: {
            bullet: { type: "bullet" },
            fontSize: 16,
            fontFace: bodyFont,
            color: "333333",
            bold: hasBoldPrefix(slideData.bullets[bIdx]),
            paraSpaceAfter: 4,
            indentLevel: 0,
          }
        });
        // Add sub-bullets
        const subs = slideData.subBullets.get(bIdx);
        if (subs && subs.length > 0) {
          for (const sub of subs) {
            textRows.push({
              text: stripBold(sub),
              options: {
                bullet: { type: "bullet" },
                fontSize: 13,
                fontFace: bodyFont,
                color: "666666",
                indentLevel: 1,
                paraSpaceAfter: 2,
              }
            });
          }
        }
      }

      const availableHeight = slideData.table ? 2.0 : 4.0;
      slide.addText(textRows, {
        x: 0.5, y: yPosition, w: "90%", h: availableHeight,
        valign: "top"
      });
      yPosition += availableHeight + 0.1;
    }

    // Table rendering
    if (slideData.table) {
      const tableRows: pptxgen.TableRow[] = [];

      // Header row
      tableRows.push(
        slideData.table.headers.map(h => ({
          text: stripBold(h),
          options: {
            bold: true,
            fontSize: 10,
            fontFace: bodyFont,
            color: "FFFFFF",
            fill: { color: primary },
            align: "center" as const,
            valign: "middle" as const,
          }
        }))
      );

      // Data rows
      for (const row of slideData.table.rows) {
        tableRows.push(
          row.map(cell => ({
            text: stripBold(cell.replace(/<br>/g, '\n').replace(/<br\/>/g, '\n')),
            options: {
              fontSize: 8,
              fontFace: bodyFont,
              color: "333333",
              valign: "top" as const,
            }
          }))
        );
      }

      // Limit rows to avoid overflow
      const maxRows = 8;
      const displayRows = tableRows.slice(0, maxRows + 1); // +1 for header

      slide.addTable(displayRows, {
        x: 0.3, y: yPosition, w: 9.4,
        fontSize: 9,
        border: { type: "solid", pt: 0.5, color: "CCCCCC" },
        colW: Array(slideData.table.headers.length).fill(9.4 / slideData.table.headers.length),
        autoPage: false,
      });

      if (tableRows.length > maxRows + 1) {
        slide.addText(`(${tableRows.length - maxRows - 1} more rows — see full document)`, {
          x: 0.5, y: yPosition + (displayRows.length * 0.35) + 0.1, w: "90%", h: 0.3,
          fontSize: 9,
          fontFace: bodyFont,
          color: "999999",
          italic: true,
        });
      }
    }

    // Speaker notes
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

/** Strip **bold** markers from text */
function stripBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
}

/** Check if text starts with a **bold** segment */
function hasBoldPrefix(text: string): boolean {
  return /^\*\*.+?\*\*/.test(text.trim());
}

/**
 * Parse standard markdown into slide data.
 * Splits on ## headings and --- horizontal rules.
 * Supports:
 * - ## headings → slide titles
 * - ### subheadings → slide header override
 * - - / * bullets → bullet points
 * - Indented bullets (  - ) → sub-bullets
 * - | table | syntax → tables
 * - **Speaker Notes:** → speaker notes
 * - **Header:** → header override
 * - Plain text → body paragraphs
 * - "Slide N:" legacy syntax → also supported
 */
function parseMarkdownToSlides(content: string): SlideData[] {
  const slides: SlideData[] = [];
  const lines = content.split('\n');

  // First, split the content into sections by ## headings or --- dividers
  const sections: { title: string; lines: string[] }[] = [];
  let currentSection: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for ## heading (but not # which is the doc title — handle separately)
    const h2Match = trimmed.match(/^##\s+(.+)/);
    const h1Match = trimmed.match(/^#\s+(.+)/);
    // Legacy "Slide N:" header
    const slideMatch = trimmed.match(/^(?:#+\s*)?(?:\d+\.\s*)?Slide\s*\d*(?::|-)\s*(.*)/i);

    if (h2Match || slideMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      const title = slideMatch ? slideMatch[1].trim() : h2Match![1].trim();
      currentSection = { title: title || "Untitled", lines: [] };
    } else if (h1Match && !currentSection) {
      // # Top-level heading → title slide
      currentSection = { title: h1Match[1].trim(), lines: [] };
    } else if (trimmed === '---') {
      // Horizontal rule: push current section (if any) and start a new one implicitly
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
        currentSection = null;
      }
      // If currentSection exists but is empty, just push it
      else if (currentSection) {
        sections.push(currentSection);
        currentSection = null;
      }
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else {
      // Lines before any heading — skip or attach to an implicit first section
      if (!currentSection) {
        currentSection = { title: "Introduction", lines: [] };
      }
      currentSection.lines.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  // Now parse each section into a SlideData
  for (const section of sections) {
    const slide: SlideData = {
      title: section.title,
      bullets: [],
      subBullets: new Map(),
      bodyText: [],
    };

    let inTable = false;
    let tableHeaders: string[] = [];
    let tableRows: string[][] = [];
    let inSpeakerNotes = false;
    let speakerNotesLines: string[] = [];

    for (const line of section.lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (trimmed.length === 0) {
        inSpeakerNotes = false;
        continue;
      }

      // ### subheading → header override
      const h3Match = trimmed.match(/^###\s+(.+)/);
      if (h3Match) {
        slide.header = h3Match[1].trim();
        continue;
      }

      // Skip any remaining # headings (shouldn't normally appear mid-section)
      if (/^#+\s/.test(trimmed)) continue;

      // **Header:** pattern
      const headerMatch = trimmed.match(/^\*\*\s*Header\s*[:\*]*\s*(.*)/i);
      if (headerMatch) {
        slide.header = stripBold(headerMatch[1]);
        continue;
      }

      // **Speaker Notes:** pattern
      const notesMatch = trimmed.match(/^\*\*\s*Speaker Notes\s*[:\*]*\s*(.*)/i);
      if (notesMatch) {
        inSpeakerNotes = true;
        if (notesMatch[1].trim()) {
          speakerNotesLines.push(stripBold(notesMatch[1]));
        }
        continue;
      }

      if (inSpeakerNotes) {
        speakerNotesLines.push(trimmed);
        continue;
      }

      // Table row (starts with |)
      if (trimmed.startsWith('|')) {
        // Check if it's a separator row (| --- | --- |)
        if (/^\|[\s-:|]+\|$/.test(trimmed)) {
          // It's the separator — skip it, headers were already captured
          continue;
        }

        const cells = trimmed
          .split('|')
          .slice(1, -1) // Remove first and last empty elements from split
          .map(c => c.trim());

        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      } else {
        // If we were in a table and hit a non-table line, finalize the table
        if (inTable) {
          slide.table = { headers: tableHeaders, rows: tableRows };
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
      }

      // Bullet point (top-level): lines starting with - or * (no leading whitespace)
      const bulletMatch = line.match(/^[-*]\s+(.*)/);
      if (bulletMatch) {
        slide.bullets.push(bulletMatch[1].trim());
        continue;
      }

      // Sub-bullet (indented by 2+ spaces or a tab)
      const subBulletMatch = line.match(/^(?:\s{2,}|\t)[-*]\s+(.*)/);
      if (subBulletMatch) {
        const parentIdx = slide.bullets.length - 1;
        if (parentIdx >= 0) {
          if (!slide.subBullets.has(parentIdx)) {
            slide.subBullets.set(parentIdx, []);
          }
          slide.subBullets.get(parentIdx)!.push(subBulletMatch[1].trim());
        }
        continue;
      }

      // Status Legend or other minor inline text — treat as body
      // Plain text paragraph
      if (trimmed.length > 0) {
        slide.bodyText.push(trimmed);
      }
    }

    // Finalize any remaining table
    if (inTable && tableHeaders.length > 0) {
      slide.table = { headers: tableHeaders, rows: tableRows };
    }

    // Finalize speaker notes
    if (speakerNotesLines.length > 0) {
      slide.speakerNotes = speakerNotesLines.join('\n');
    }

    // Only add slide if it has meaningful content
    if (slide.bullets.length > 0 || slide.bodyText.length > 0 || slide.table || slide.header) {
      slides.push(slide);
    }
  }

  return slides;
}
