import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Slide parsing logic shamelessly copied from src/lib/pptxExport.ts 
 * to verify regex stability and layout detection within the Node test runner.
 */
function parseMarkdownToSlides(content) {
    const slides = [];
    const lines = content.split('\n');
    const sections = [];
    let currentSection = null;

    for (const line of lines) {
        const trimmed = line.trim();
        const h1Match = trimmed.match(/^#\s+(.+)/);
        const h2Match = trimmed.match(/^##\s+(.+)/);
        const slideMatch = trimmed.match(/^(?:#+\s*)?(?:\d+\.\s*)?Slide\s*\d*(?::|-)\s*(.*)/i);

        if (h1Match) {
            if (currentSection) sections.push(currentSection);
            currentSection = { title: h1Match[1].trim(), lines: [], isMajor: true };
        } else if (h2Match || slideMatch) {
            if (currentSection) sections.push(currentSection);
            const title = slideMatch ? slideMatch[1].trim() : h2Match[1].trim();
            currentSection = { title: title || "Untitled", lines: [], isMajor: false };
        } else if (trimmed === '---') {
            if (currentSection) sections.push(currentSection);
            currentSection = null;
        } else if (currentSection) {
            currentSection.lines.push(line);
        }
    }
    if (currentSection) sections.push(currentSection);

    for (const section of sections) {
        const slide = { 
            title: section.title, 
            bullets: [], 
            subBullets: new Map(), 
            bodyText: [],
            layoutHint: section.isMajor ? 'section' : undefined
        };
        
        for (const line of section.lines) {
            const trimmed = line.trim();
            if (trimmed.length === 0) continue;

            const layoutMatch = trimmed.match(/^\*\*\s*(?:Header|Layout)\s*[:\*]*\s*(.*?)(?:\*\*|$)/i);
            if (layoutMatch) { 
                const val = layoutMatch[1].toLowerCase().trim();
                const valid = ['split', 'section', 'standard', 'comparison', 'columns', 'timeline', 'image', 'title'];
                if (valid.includes(val)) slide.layoutHint = val;
                continue; 
            }

            const bulletMatch = line.match(/^[-*]\s+(.*)/);
            if (bulletMatch) { slide.bullets.push(bulletMatch[1].trim()); continue; }

            if (trimmed.length > 0) slide.bodyText.push(trimmed);
        }
        slides.push(slide);
    }
    return slides;
}

test('PPTX: parseMarkdownToSlides handles different slide header formats', () => {
    const md = `
# Title Slide
## Slide 1
---
Slide 2: Summary
### Extra Header
- Bullet 1
`;
    const slides = parseMarkdownToSlides(md);
    assert.equal(slides.length, 3);
    assert.equal(slides[0].title, 'Title Slide');
    assert.equal(slides[0].layoutHint, 'section'); // H1 defaults to section in logic
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
