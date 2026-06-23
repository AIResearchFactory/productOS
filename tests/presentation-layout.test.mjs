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
      currentSection = { title: 'Introduction', lines: [line], isMajor: false, startLine: i };
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
      startLine: section.startLine
    };

    let inTable = false, tableHeaders = [], tableRows = [];
    let inSpeakerNotes = false, speakerNotesLines = [];
    const orderedNotesLines = [];

    for (const line of section.lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) { inSpeakerNotes = false; continue; }

      const h3Match = trimmed.match(/^###\s+(.+)/);
      if (h3Match) { slide.header = h3Match[1].trim(); continue; }
      if (/^#+\s/.test(trimmed)) continue;

      const headerMatch = trimmed.match(/^\*\*\s*(?:Header|Layout)\s*[:\*]*\s*(.*?)(?:\*\*|$)/i);
      if (headerMatch) {
        const val = headerMatch[1].toLowerCase().trim();
        const valid = ['split', 'section', 'standard', 'comparison', 'columns', 'timeline', 'image', 'title'];
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

      const subBulletMatch = line.match(/^(?:\s{2,}|\t)[-*]\s+(.*)/);
      if (subBulletMatch) {
        const parentIdx = slide.bullets.length - 1;
        const subText = subBulletMatch[1].trim();
        if (parentIdx >= 0) {
          if (!slide.subBullets.has(parentIdx)) slide.subBullets.set(parentIdx, []);
          slide.subBullets.get(parentIdx).push(subText);
          orderedNotesLines.push(`  • ${stripBold(subText)}`);
        }
        continue;
      }

      const bulletMatch = line.match(/^[-*]\s+(.*)/);
      if (bulletMatch) {
        const bulletText = bulletMatch[1].trim();
        slide.bullets.push(bulletText);
        orderedNotesLines.push(`• ${stripBold(bulletText)}`);
        continue;
      }

      if (trimmed.length > 0) {
        slide.bodyText.push(trimmed);
        orderedNotesLines.push(stripBold(trimmed));
      }
    }
    if (inTable && tableHeaders.length > 0) slide.table = { headers: tableHeaders, rows: tableRows };

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
