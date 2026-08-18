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
    .filter(path => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

  if (slidePaths.length === 0) {
    throw new Error('No slide templates found in the provided presentation file.');
  }

  let presXml = files['ppt/presentation.xml'] ? files['ppt/presentation.xml'].toString('utf8') : '';
  let relsXml = files['ppt/_rels/presentation.xml.rels'] ? files['ppt/_rels/presentation.xml.rels'].toString('utf8') : '';
  let contentTypesXml = files['[Content_Types].xml'] ? files['[Content_Types].xml'].toString('utf8') : '';

  const slidesToCreate = Array.isArray(slideDataArray) && slideDataArray.length > 0
    ? slideDataArray
    : [{ title: 'Presentation' }];
  const sldIdEntries = [];

  slidesToCreate.forEach((slide, index) => {
    const slideNumber = index + 1;
    const newSlidePath = `ppt/slides/slide${slideNumber}.xml`;
    const rId = `rId${100 + slideNumber}`;
    const slideId = 256 + index;

    // Pick template slide prototype (rotate if multi-slide template available)
    const baseTemplatePath = slidePaths[index % slidePaths.length];
    let slideXml = files[baseTemplatePath].toString('utf8');

    const title = stripMarkdown(slide.title || 'Untitled Slide');
    const bullets = (slide.bullets || []).map(b => stripMarkdown(b));
    const bodyText = (slide.bodyText || []).map(t => stripMarkdown(t));

    // Replace Title placeholder or first text tag <a:t>
    if (title && slideXml.includes('<a:t>')) {
      slideXml = slideXml.replace(/<a:t>[^<]*<\/a:t>/, `<a:t>${escapeXml(title)}</a:t>`);
    }

    // Replace remaining body/bullet placeholders
    const contentText = [...bodyText, ...bullets].join('\n');
    if (contentText && slideXml.includes('<a:t>')) {
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

    // Ensure slide .rels file exists
    const relsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    if (!files[relsPath]) {
      const baseRelsPath = baseTemplatePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
      if (files[baseRelsPath]) {
        files[relsPath] = files[baseRelsPath];
      } else if (files['ppt/slides/_rels/slide1.xml.rels']) {
        files[relsPath] = files['ppt/slides/_rels/slide1.xml.rels'];
      }
    }

    // Add relationship to ppt/_rels/presentation.xml.rels if not present
    if (relsXml && !relsXml.includes(`Target="slides/slide${slideNumber}.xml"`)) {
      const newRel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNumber}.xml"/>`;
      relsXml = relsXml.replace('</Relationships>', `${newRel}</Relationships>`);
    }

    // Add Override entry to [Content_Types].xml if not present
    if (contentTypesXml && !contentTypesXml.includes(`PartName="/ppt/slides/slide${slideNumber}.xml"`)) {
      const newOverride = `<Override PartName="/ppt/slides/slide${slideNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
      contentTypesXml = contentTypesXml.replace('</Types>', `${newOverride}</Types>`);
    }

    sldIdEntries.push(`<p:sldId id="${slideId}" r:id="${rId}"/>`);
  });

  // Clean up old extra slide XML files if created slides count < original slide count
  if (slidePaths.length > slidesToCreate.length) {
    for (let i = slidesToCreate.length; i < slidePaths.length; i++) {
      delete files[slidePaths[i]];
      const oldRels = slidePaths[i].replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
      delete files[oldRels];
    }
  }

  // Save updated ppt/presentation.xml, ppt/_rels/presentation.xml.rels, and [Content_Types].xml
  if (presXml && presXml.includes('<p:sldIdLst>')) {
    presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${sldIdEntries.join('')}</p:sldIdLst>`);
    files['ppt/presentation.xml'] = presXml;
  }
  if (relsXml) {
    files['ppt/_rels/presentation.xml.rels'] = relsXml;
  }
  if (contentTypesXml) {
    files['[Content_Types].xml'] = contentTypesXml;
  }

  return packZip(files);
}

/**
 * Extracts theme colors, typography, and embedded brand media (logos) from a .pptx or .potx zip buffer.
 */
export function extractBrandConfigFromPptx(templateBuffer) {
  if (!templateBuffer || !Buffer.isBuffer(templateBuffer)) {
    return null;
  }
  try {
    const files = unpackZip(templateBuffer);
    const themePath = Object.keys(files).find(p => /^ppt\/theme\/theme\d+\.xml$/i.test(p));
    
    const brandConfig = {
      colors: {},
      typography: {}
    };

    if (themePath) {
      const themeXml = files[themePath].toString('utf8');

      const extractColor = (tagName) => {
        const tagRegex = new RegExp(`<a:${tagName}[^>]*>([\\s\\S]*?)</a:${tagName}>`, 'i');
        const tagMatch = themeXml.match(tagRegex);
        if (!tagMatch) return null;
        const inner = tagMatch[1];
        const srgbMatch = inner.match(/<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/i);
        if (srgbMatch) return `#${srgbMatch[1].toUpperCase()}`;
        const sysMatch = inner.match(/<a:sysClr\s+[^>]*?lastClr="([0-9A-Fa-f]{6})"/i);
        if (sysMatch) return `#${sysMatch[1].toUpperCase()}`;
        return null;
      };

      const dk1 = extractColor('dk1');
      const lt1 = extractColor('lt1');
      const dk2 = extractColor('dk2');
      const lt2 = extractColor('lt2');
      const accent1 = extractColor('accent1');
      const accent2 = extractColor('accent2');
      const accent3 = extractColor('accent3');
      const accent4 = extractColor('accent4');
      const accent5 = extractColor('accent5');
      const accent6 = extractColor('accent6');

      if (accent1) brandConfig.colors.primary = accent1;
      else if (dk1) brandConfig.colors.primary = dk1;

      if (accent2) brandConfig.colors.secondary = accent2;
      else if (accent1 && dk1) brandConfig.colors.secondary = dk1;

      if (accent3) brandConfig.colors.accent = accent3;
      else if (accent4) brandConfig.colors.accent = accent4;

      if (lt1) brandConfig.colors.background = lt1;
      if (lt2) brandConfig.colors.card_bg = lt2;
      else if (lt1) brandConfig.colors.card_bg = lt1 === '#FFFFFF' ? '#F8FAFC' : lt1;

      if (dk1) brandConfig.colors.text = dk1;

      const majorMatch = themeXml.match(/<a:majorFont>[\s\S]*?<a:latin\s+typeface="([^"]+)"/i);
      const minorMatch = themeXml.match(/<a:minorFont>[\s\S]*?<a:latin\s+typeface="([^"]+)"/i);

      if (majorMatch && majorMatch[1] && !majorMatch[1].startsWith('+mj-')) {
        brandConfig.typography.heading_font = majorMatch[1];
      }
      if (minorMatch && minorMatch[1] && !minorMatch[1].startsWith('+mn-')) {
        brandConfig.typography.body_font = minorMatch[1];
      }
    }

    // Extract embedded brand media / logo (e.g. image from slide master or media directory)
    const mediaKeys = Object.keys(files).filter(k => /^ppt\/media\/[^/]+\.(png|jpe?g|svg|webp|gif)$/i.test(k));
    if (mediaKeys.length > 0) {
      // Find image referenced in slideMasters relationships if possible
      let chosenKey = mediaKeys[0];
      const masterRelKey = Object.keys(files).find(k => /^ppt\/slideMasters\/_rels\/slideMaster\d+\.xml\.rels$/i.test(k));
      if (masterRelKey) {
        const masterRelXml = files[masterRelKey].toString('utf8');
        const match = masterRelXml.match(/Target="(?:\.\.\/)?media\/([^"]+)"/i);
        if (match && files[`ppt/media/${match[1]}`]) {
          chosenKey = `ppt/media/${match[1]}`;
        }
      }

      const imgBuffer = files[chosenKey];
      if (imgBuffer && Buffer.isBuffer(imgBuffer) && imgBuffer.length > 0 && imgBuffer.length < 5 * 1024 * 1024) {
        const ext = chosenKey.split('.').pop().toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
        const filename = chosenKey.replace(/^ppt\/media\//i, '');
        brandConfig.logo = {
          data: `data:${mime};base64,${imgBuffer.toString('base64')}`,
          filename,
          mimeType: mime
        };
      }
    }

    if (
      Object.keys(brandConfig.colors).length > 0 ||
      Object.keys(brandConfig.typography).length > 0 ||
      brandConfig.logo
    ) {
      return brandConfig;
    }
    return null;
  } catch (err) {
    console.warn('[pptx-template-service] Failed to extract brand config from presentation template:', err.message);
    return null;
  }
}

