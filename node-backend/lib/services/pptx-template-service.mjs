import { unpackZip, packZip } from '../zip-utils.mjs';

/**
 * Escapes XML special characters in string.
 */
function escapeXml(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Strips bold syntax markdown tokens (**text**) for slide text insertion.
 */
function stripMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
}

/**
 * Processes a sample .pptx or .potx buffer, duplicating template slides
 * and injecting parsed document content into OOXML placeholder tags (<a:t>).
 */
export function generateFromTemplate(templateBuffer, slideDataArray) {
  if (!templateBuffer || !Buffer.isBuffer(templateBuffer)) {
    throw new Error('Invalid template buffer provided.');
  }

  const files = unpackZip(templateBuffer);
  
  // Find available slide XML files in template
  const slidePaths = Object.keys(files)
    .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort();

  if (slidePaths.length === 0) {
    throw new Error('No slide templates found in the provided presentation file.');
  }

  // Use the first template slide as master template prototype
  const templateSlideXml = files[slidePaths[0]].toString('utf8');

  // Read presentation.xml to track slide IDs
  let presXml = files['ppt/presentation.xml'] ? files['ppt/presentation.xml'].toString('utf8') : '';

  slideDataArray.forEach((slide, index) => {
    const slideNumber = index + 1;
    const newSlidePath = `ppt/slides/slide${slideNumber}.xml`;

    let slideXml = templateSlideXml;

    const title = stripMarkdown(slide.title || 'Untitled Slide');
    const bullets = (slide.bullets || []).map(b => stripMarkdown(b));
    const bodyText = (slide.bodyText || []).map(t => stripMarkdown(t));

    // Replace Title placeholder or first text tag
    if (title) {
      if (slideXml.includes('<a:t>')) {
        slideXml = slideXml.replace(/<a:t>[^<]*<\/a:t>/, `<a:t>${escapeXml(title)}</a:t>`);
      }
    }

    // Replace remaining body/bullet placeholders if present
    const contentText = [...bodyText, ...bullets].join('\n');
    if (contentText && slideXml.includes('<a:t>')) {
      // Replace second occurrence of text if available
      let matches = 0;
      slideXml = slideXml.replace(/<a:t>[^<]*<\/a:t>/g, (match) => {
        matches++;
        if (matches === 2) {
          return `<a:t>${escapeXml(contentText)}</a:t>`;
        }
        return match;
      });
    }

    files[newSlidePath] = slideXml;

    // Create corresponding .rels file for slide if missing
    const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    if (!files[relsPath] && files['ppt/slides/_rels/slide1.xml.rels']) {
      files[relsPath] = files['ppt/slides/_rels/slide1.xml.rels'];
    }
  });

  // Ensure ppt/presentation.xml contains entries for all new slides
  if (presXml && presXml.includes('<p:sldIdLst>')) {
    let sldListItems = '';
    slideDataArray.forEach((_, idx) => {
      const slideId = 256 + idx;
      const rId = `rId${100 + idx}`;
      sldListItems += `<p:sldId id="${slideId}" r:id="${rId}"/>`;
    });
    
    presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${sldListItems}</p:sldIdLst>`);
    files['ppt/presentation.xml'] = presXml;
  }

  return packZip(files);
}
