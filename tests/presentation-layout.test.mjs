import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Slide parsing logic mirrored from src/lib/pptxExport.ts
 * to verify regex stability, layout detection, and ordered notes
 * within the Node test runner.
 *
 * Keep this in sync with the TypeScript source.
 */
function stripBold(text) {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').trim();
}

function parseMarkdownToSlides(content) {
  const slides = [];
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;

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
      const title = slideMatch ? slideMatch[1].trim() : h2Match[1].trim();
      currentSection = { title: title || 'Untitled', lines: [], isMajor: false, startLine: i };
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
    const slide = {
      title: section.title,
      bullets: [],
      subBullets: new Map(),
      bodyText: [],
      images: [],
      layoutHint: section.isMajor ? 'section' : undefined,
      startLine: section.startLine,
      elements: [],
      items: []
    };

    let inTable = false, tableHeaders = [], tableRows = [];
    let inSpeakerNotes = false, speakerNotesLines = [];
    const orderedNotesLines = [];

    let currentItem = null;
    const items = [];

    for (const line of section.lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) { inSpeakerNotes = false; continue; }

      const h3Match = trimmed.match(/^###\s+(.+)/);
      if (h3Match) { slide.header = h3Match[1].trim(); continue; }
      if (/^#+\s/.test(trimmed)) continue;

      const headerMatch = trimmed.match(/^\*\*\s*(?:Header|Layout)\s*[:\*]*\s*(.*?)(?:\*\*|$)/i);
      if (headerMatch) {
        const val = headerMatch[1].toLowerCase().trim();
        const valid = ['split', 'section', 'standard', 'comparison', 'columns', 'timeline', 'image', 'title', 'spotlight'];
        if (valid.includes(val)) slide.layoutHint = val;
        else slide.header = stripBold(headerMatch[1]);
        continue;
      }

      const notesMatch = trimmed.match(/^\*\*\s*Speaker Notes\s*[:\*]*\s*(.*)/i);
      if (notesMatch) { inSpeakerNotes = true; if (notesMatch[1].trim()) speakerNotesLines.push(stripBold(notesMatch[1])); continue; }
      if (inSpeakerNotes) { speakerNotesLines.push(trimmed); continue; }

      const imageMatch = trimmed.match(/!\[(.*?)\]\((.*?)\)/);
      if (imageMatch) {
        slide.images.push({ alt: imageMatch[1], path: imageMatch[2] });
        if (slide.images.length === 1 && slide.bullets.length === 0 && !slide.layoutHint) {
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
          slide.subBullets.get(parentIdx).push(subText);
          orderedNotesLines.push(`  • ${stripBold(subText)}`);
        }

        const lastEl = slide.elements[slide.elements.length - 1];
        if (lastEl && lastEl.type === 'bullet') {
          if (!lastEl.subBullets) lastEl.subBullets = [];
          lastEl.subBullets.push(subText);
        }

        if (currentItem) {
          if (currentItem.year !== undefined) {
            if (currentItem.summary) {
              currentItem.summary += "\n" + subText;
            } else {
              currentItem.summary = subText;
            }
          }
          if (!currentItem.summaryBullets) currentItem.summaryBullets = [];
          currentItem.summaryBullets.push(subText);
        }
        continue;
      }

      const bulletMatch = line.match(/^(?:[-*]|\d+\.)\s+(.*)/);
      if (bulletMatch) {
        const bulletText = bulletMatch[1].trim();
        slide.bullets.push(bulletText);
        orderedNotesLines.push(`• ${stripBold(bulletText)}`);

        slide.elements.push({
          type: 'bullet',
          text: bulletText,
          indentLevel: 0,
          subBullets: []
        });

        const timelineMatch = bulletText.match(/^((?:19|20)\d{2}|[A-Za-z]{3}\s\d+|[A-Za-z]+)\s*[:-]\s*(.*)/);
        if (timelineMatch) {
          currentItem = { 
            year: timelineMatch[1].trim(), 
            title: timelineMatch[2].trim(), 
            summary: "",
            summaryBullets: []
          };
          items.push(currentItem);
        } else {
          if (!currentItem || currentItem.year !== undefined) {
            currentItem = { title: "", summaryBullets: [] };
            items.push(currentItem);
          }
          currentItem.summaryBullets.push(bulletText);
        }
        continue;
      }

      if (trimmed.length > 0) {
        slide.bodyText.push(trimmed);
        orderedNotesLines.push(stripBold(trimmed));

        slide.elements.push({
          type: 'paragraph',
          text: trimmed,
          isLabel: trimmed.includes(':') && trimmed.length < 60,
          isGoal: trimmed.toLowerCase().startsWith('goal:')
        });

        currentItem = { title: trimmed, summaryBullets: [] };
        items.push(currentItem);
      }
    }
    if (inTable && tableHeaders.length > 0) slide.table = { headers: tableHeaders, rows: tableRows };

    if (items.length > 0) {
      slide.items = items.filter(item => {
        if (item.year !== undefined) return true;
        return item.title || (item.summaryBullets && item.summaryBullets.length > 0);
      });
    }

    if (speakerNotesLines.length > 0) {
      slide.speakerNotes = speakerNotesLines.join('\n');
    } else if (orderedNotesLines.length > 0) {
      slide.speakerNotes = orderedNotesLines.join('\n');
    }
    slide.fullText = slide.speakerNotes || '';

    if (slide.bullets.length > 0 || slide.bodyText.length > 0 || slide.table || slide.header || slide.images.length > 0) {
      slides.push(slide);
    }
  }
  return slides;
}

// ─────────────────────────────────────────────────────────
// Existing tests (kept)
// ─────────────────────────────────────────────────────────

test('PPTX: parseMarkdownToSlides handles different slide header formats', () => {
  const md = `
# Title Slide
- Title bullet

## Slide 1
- Slide 1 bullet

---

Slide 2: Summary
### Extra Header
- Bullet 1
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides.length, 3, `Expected 3 slides, got ${slides.length}: ${slides.map(s => s.title).join(', ')}`);
  assert.equal(slides[0].title, 'Title Slide');
  assert.equal(slides[0].layoutHint, 'section'); // H1 defaults to section
  assert.equal(slides[1].title, 'Slide 1');
  assert.equal(slides[2].title, 'Summary');
});


test('PPTX: parseMarkdownToSlides detects layout overrides', () => {
  const md = `
## Features
**Layout: columns**
- Feature 1
- Feature 2

## Comparison
**Layout: comparison**
- Item A
- Item B
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides[0].layoutHint, 'columns');
  assert.equal(slides[1].layoutHint, 'comparison');
});

test('PPTX: parseMarkdownToSlides handles loose layout formatting', () => {
  const md = `
## Modern View
**Layout: SPLIT**
Some text
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides[0].layoutHint, 'split');
});

// ─────────────────────────────────────────────────────────
// New tests — content ordering and notes correctness
// ─────────────────────────────────────────────────────────

test('PPTX ordering: speakerNotes preserves interleaved bodyText + bullets in document order', () => {
  // This reproduces the scrambled-notes bug: if the old code ran, notes would be
  // "Intro paragraph\nConclusion paragraph\n• First bullet\n• Second bullet"
  // (all bodyText grouped before all bullets). The fix should give:
  // "Intro paragraph\n• First bullet\n• Second bullet\nConclusion paragraph"
  const md = `
## Strategic Themes Overview

Intro paragraph

- First bullet
- Second bullet

Conclusion paragraph
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides.length, 1);
  const notes = slides[0].speakerNotes;

  // Verify order: intro comes before bullets, bullets come before conclusion
  const introPos = notes.indexOf('Intro paragraph');
  const bullet1Pos = notes.indexOf('First bullet');
  const bullet2Pos = notes.indexOf('Second bullet');
  const conclusionPos = notes.indexOf('Conclusion paragraph');

  assert.ok(introPos !== -1, 'Notes should contain intro paragraph');
  assert.ok(bullet1Pos !== -1, 'Notes should contain first bullet');
  assert.ok(bullet2Pos !== -1, 'Notes should contain second bullet');
  assert.ok(conclusionPos !== -1, 'Notes should contain conclusion paragraph');

  assert.ok(introPos < bullet1Pos, 'Intro paragraph should appear before first bullet in notes');
  assert.ok(bullet1Pos < bullet2Pos, 'First bullet should appear before second bullet in notes');
  assert.ok(bullet2Pos < conclusionPos, 'Second bullet should appear before conclusion paragraph in notes');
});

test('PPTX ordering: sub-bullets appear after their parent bullet in notes', () => {
  const md = `
## Why This Matters

Why This Matters:

- 73% of enterprises deploying AI agents in 2026 (Forrester)
  - Source: Forrester Q1 2026 report
- Cyera acquired Ryft specifically for agentic AI security (May 2026)
  - Deal valued at $1.2B
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides.length, 1);

  const notes = slides[0].speakerNotes;
  const bodyPos = notes.indexOf('Why This Matters');
  const bullet1Pos = notes.indexOf('73% of enterprises');
  const sub1Pos = notes.indexOf('Forrester Q1 2026');
  const bullet2Pos = notes.indexOf('Cyera acquired Ryft');
  const sub2Pos = notes.indexOf('Deal valued');

  assert.ok(bodyPos < bullet1Pos, 'Body text should appear before bullets');
  assert.ok(bullet1Pos < sub1Pos, 'Parent bullet should appear before its sub-bullet');
  assert.ok(sub1Pos < bullet2Pos, 'Sub-bullet of first bullet should appear before second bullet');
  assert.ok(bullet2Pos < sub2Pos, 'Second parent bullet should appear before its sub-bullet');

  // Sub-bullets should use indented marker
  assert.ok(notes.includes('  •'), 'Sub-bullets should have indented bullet marker in notes');
});

test('PPTX ordering: explicit Speaker Notes block overrides auto-built notes', () => {
  const md = `
## Custom Notes Slide

Some body text

- A bullet

**Speaker Notes:**
This is the explicit notes content that should win.
It should NOT be mixed with the body text or bullets.
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides.length, 1);
  const notes = slides[0].speakerNotes;

  assert.ok(notes.includes('explicit notes content'), 'Explicit speaker notes should be used');
  assert.ok(!notes.includes('Some body text'), 'Body text should NOT appear when explicit notes are present');
  assert.ok(!notes.includes('A bullet'), 'Bullets should NOT appear when explicit notes are present');
});

test('PPTX ordering: multiple slides each get their own correctly ordered notes', () => {
  const md = `
## Slide A

Intro A

- Bullet A1
- Bullet A2

Closing A

## Slide B

Intro B

- Bullet B1

Closing B
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides.length, 2);

  const notesA = slides[0].speakerNotes;
  const notesB = slides[1].speakerNotes;

  // Slide A notes order
  assert.ok(notesA.indexOf('Intro A') < notesA.indexOf('Bullet A1'), 'Slide A: Intro before bullet');
  assert.ok(notesA.indexOf('Bullet A2') < notesA.indexOf('Closing A'), 'Slide A: Bullets before closing');

  // Slide B notes order
  assert.ok(notesB.indexOf('Intro B') < notesB.indexOf('Bullet B1'), 'Slide B: Intro before bullet');
  assert.ok(notesB.indexOf('Bullet B1') < notesB.indexOf('Closing B'), 'Slide B: Bullet before closing');

  // Notes should not bleed between slides
  assert.ok(!notesA.includes('Intro B'), 'Slide A notes should not contain Slide B content');
  assert.ok(!notesB.includes('Intro A'), 'Slide B notes should not contain Slide A content');
});

test('PPTX ordering: fullText mirrors speakerNotes exactly', () => {
  const md = `
## Mirror Test

Body text here

- Bullet one
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides.length, 1);
  assert.equal(slides[0].fullText, slides[0].speakerNotes, 'fullText should equal speakerNotes');
});

test('PPTX parsing: numbered lists are recognized as bullets and sub-bullets', () => {
  const md = `
## Numbered Lists Slide

1. First main item
   1. First sub item
   2. Second sub item
2. Second main item
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides.length, 1);
  assert.equal(slides[0].bullets.length, 2);
  assert.equal(slides[0].bullets[0], 'First main item');
  assert.equal(slides[0].bullets[1], 'Second main item');

  const subBullets0 = slides[0].subBullets.get(0);
  assert.ok(subBullets0, 'Should have sub-bullets for first bullet');
  assert.equal(subBullets0.length, 2);
  assert.equal(subBullets0[0], 'First sub item');
  assert.equal(subBullets0[1], 'Second sub item');
});

test('PPTX parsing: trailing text after delimiter defaults to End Slide', () => {
  const md = `
# Title slide
- A title slide bullet

---

## Content Slide
Some content here

---
Document Owner: Product Management
Last Updated: June 22, 2026
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides.length, 3);
  assert.equal(slides[0].title, 'Title slide');
  assert.equal(slides[1].title, 'Content Slide');
  assert.equal(slides[2].title, 'End Slide');
});

test('PPTX parsing: elements array preserves interleaved order and subbullets', () => {
  const md = `
## Interleaved Slide
Why This Matters:
- Bullet 1
  - Sub 1
- Bullet 2
Second Header:
- Bullet 3
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides.length, 1);
  const elements = slides[0].elements;
  assert.equal(elements.length, 5);

  assert.equal(elements[0].type, 'paragraph');
  assert.equal(elements[0].text, 'Why This Matters:');

  assert.equal(elements[1].type, 'bullet');
  assert.equal(elements[1].text, 'Bullet 1');
  assert.deepEqual(elements[1].subBullets, ['Sub 1']);

  assert.equal(elements[2].type, 'bullet');
  assert.equal(elements[2].text, 'Bullet 2');

  assert.equal(elements[3].type, 'paragraph');
  assert.equal(elements[3].text, 'Second Header:');

  assert.equal(elements[4].type, 'bullet');
  assert.equal(elements[4].text, 'Bullet 3');
});

test('PPTX parsing: items grouping maps columns and timelines fallback correctly', () => {
  const md = `
## Columns Slide
**Layout: columns**
MCP Server Monitoring
- Monitor Model Context Protocol (MCP) servers
- Track data flows through AI agent infrastructure

Local AI Agent Discovery
- Discover coding assistants and local AI tools
- Inspect agent history and activity
`;
  const slides = parseMarkdownToSlides(md);
  assert.equal(slides.length, 1);
  const items = slides[0].items;
  assert.equal(items.length, 2);

  assert.equal(items[0].title, 'MCP Server Monitoring');
  assert.deepEqual(items[0].summaryBullets, [
    'Monitor Model Context Protocol (MCP) servers',
    'Track data flows through AI agent infrastructure'
  ]);

  assert.equal(items[1].title, 'Local AI Agent Discovery');
  assert.deepEqual(items[1].summaryBullets, [
    'Discover coding assistants and local AI tools',
    'Inspect agent history and activity'
  ]);
});


