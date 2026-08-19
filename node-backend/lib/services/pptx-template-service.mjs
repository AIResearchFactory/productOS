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

// ─── Layout classification helpers ──────────────────────────────────────────

/**
 * Reads the layout name from a slideLayout XML file and classifies it
 * into a role bucket.
 */
function classifyLayout(layoutXml) {
  const nameMatch = layoutXml.match(/<p:cSld[^>]*\bname="([^"]+)"/i);
  const name = (nameMatch ? nameMatch[1] : '').toLowerCase();
  return name;
}

/**
 * Classifies a template sample slide into a role (cover / section / content / end)
 * based on both its linked layout name and its own XML content.
 */
function classifySlide(layoutName, slideXml, isLastSlide) {
  const ln = layoutName.toLowerCase();

  const isEnd = /\bend\b|closing|thank/i.test(ln) ||
    (isLastSlide && /\bend\s*slide\b|\bthank\s*you\b/i.test(slideXml));
  if (isEnd) return 'end';

  if (/cover|intro/i.test(ln) || /type="ctrTitle"/i.test(slideXml)) return 'cover';
  if (/\btitle\b/i.test(ln) && !/sub/i.test(ln)) return 'cover';
  if (/section|divider/i.test(ln) || /type="secHead"/i.test(slideXml)) return 'section';
  if (/column|col\b|box|card|callout/i.test(ln)) return 'column';

  return 'content';
}

// ─── Safe text injection ────────────────────────────────────────────────────

/**
 * Safely replaces only the text content inside existing <a:t> tags in a
 * slide's XML string without altering the surrounding OOXML structure.
 *
 * This is intentionally minimal: we only change the text between <a:t> and
 * </a:t> tags and nothing else.  That keeps all shape properties, body
 * properties, run properties, paragraph properties, etc. from the template
 * intact so PowerPoint can still parse the file.
 */
function safeInjectText(slideXml, slideData) {
  const title = stripMarkdown(slideData.header || slideData.title || '');
  const bullets = (slideData.bullets || []).map(b => stripMarkdown(b));
  const bodyText = (slideData.bodyText || []).map(t => stripMarkdown(t));
  const contentLines = [...bodyText, ...bullets];

  // Find all <a:t>…</a:t> occurrences
  const textTags = [];
  const tagRe = /<a:t>([^<]*)<\/a:t>/g;
  let m;
  while ((m = tagRe.exec(slideXml)) !== null) {
    textTags.push({ index: m.index, fullMatch: m[0], text: m[1] });
  }

  if (textTags.length === 0) return slideXml;

  // Replace first text tag with title
  let result = slideXml;
  if (title && textTags.length >= 1) {
    result = result.replace(textTags[0].fullMatch, `<a:t>${escapeXml(title)}</a:t>`);
  }

  // Replace second text tag with body content joined with newlines
  if (contentLines.length > 0 && textTags.length >= 2) {
    const joined = contentLines.join('\n');
    // We need to re-find the second tag's position in the potentially-shifted string
    // Safest: just do sequential replace of the original match
    result = replaceNth(result, textTags[1].fullMatch, `<a:t>${escapeXml(joined)}</a:t>`, 1);
  }

  return result;
}

/**
 * Replace the n-th occurrence (0-indexed) of `search` in `str` with `replacement`.
 */
function replaceNth(str, search, replacement, n) {
  let count = 0;
  let idx = -1;
  let startSearch = 0;
  while (count <= n) {
    idx = str.indexOf(search, startSearch);
    if (idx === -1) return str; // not found
    if (count === n) {
      return str.substring(0, idx) + replacement + str.substring(idx + search.length);
    }
    startSearch = idx + search.length;
    count++;
  }
  return str;
}

// ─── Template cataloging ────────────────────────────────────────────────────

/**
 * Build a catalog of sample slides from the template, keyed by role.
 * Each entry stores the slide path, its XML, its rels XML, and its role.
 */
function catalogTemplateSampleSlides(files) {
  // Collect layout names
  const layoutNames = {};
  for (const k of Object.keys(files)) {
    if (/^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(k)) {
      layoutNames[k] = classifyLayout(files[k].toString('utf8'));
    }
  }

  // Collect sample slides sorted by number
  const slidePaths = Object.keys(files)
    .filter(p => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return na - nb;
    });

  const catalog = { cover: [], section: [], content: [], column: [], end: null, all: [] };

  for (let i = 0; i < slidePaths.length; i++) {
    const sp = slidePaths[i];
    const xml = files[sp].toString('utf8');
    const relsPath = sp.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const relsXml = files[relsPath] ? files[relsPath].toString('utf8') : '';

    // Find this slide's linked layout
    const layoutRef = relsXml.match(/Target="(?:\.\.\/)?slideLayouts\/(slideLayout\d+\.xml)"/i);
    const layoutKey = layoutRef ? `ppt/slideLayouts/${layoutRef[1]}` : null;
    const layoutName = (layoutKey && layoutNames[layoutKey]) || '';

    const isLast = i === slidePaths.length - 1;
    const role = classifySlide(layoutName, xml, isLast);

    const entry = { path: sp, relsPath, xml, relsXml, layoutName, role };
    catalog.all.push(entry);

    if (role === 'end') {
      catalog.end = entry;
    } else if (role === 'cover') {
      catalog.cover.push(entry);
    } else if (role === 'section') {
      catalog.section.push(entry);
    } else if (role === 'column') {
      catalog.column.push(entry);
    } else {
      catalog.content.push(entry);
    }
  }

  // Fallbacks
  if (catalog.cover.length === 0 && catalog.all.length > 0) catalog.cover.push(catalog.all[0]);
  if (catalog.content.length === 0 && catalog.all.length > 0) catalog.content.push(catalog.all[Math.min(1, catalog.all.length - 1)]);
  if (catalog.section.length === 0 && catalog.cover.length > 0) catalog.section.push(catalog.cover[0]);

  return catalog;
}

// ─── Relationship & Content_Types helpers ───────────────────────────────────

/**
 * Extract all existing slide relationship IDs & the highest numeric rId from
 * presentation.xml.rels so we can allocate new IDs without conflicts.
 */
function parsePresRels(relsXml) {
  const slideRels = [];          // { rId, target }
  const allRIds = [];
  const re = /<Relationship\s+[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"[^>]*\/?>/gi;
  let m;
  while ((m = re.exec(relsXml)) !== null) {
    const rId = m[1];
    const target = m[2];
    allRIds.push(parseInt(rId.replace('rId', ''), 10));
    if (/slides\/slide\d+\.xml/i.test(target)) {
      slideRels.push({ rId, target });
    }
  }
  const maxId = allRIds.length > 0 ? Math.max(...allRIds) : 0;
  return { slideRels, maxId };
}

/**
 * Remove all <Relationship> entries that point to slides/slide*.xml
 * from the rels XML string.
 */
function removeSlideRelsFromPresRels(relsXml) {
  return relsXml.replace(/<Relationship\s+[^>]*Target="slides\/slide\d+\.xml"[^>]*\/?>\s*/gi, '');
}

/**
 * Remove all <Override> entries for /ppt/slides/slide*.xml from [Content_Types].xml
 */
function removeSlideOverrides(ctXml) {
  return ctXml.replace(/<Override\s+[^>]*PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/?>\s*/gi, '');
}

/**
 * Extract existing sldId entries and determine the max id used.
 */
function parsePresXmlSldIds(presXml) {
  const ids = [];
  const re = /<p:sldId\s+id="(\d+)"/gi;
  let m;
  while ((m = re.exec(presXml)) !== null) {
    ids.push(parseInt(m[1], 10));
  }
  const maxId = ids.length > 0 ? Math.max(...ids) : 255;
  return maxId;
}

// ─── Main export function ───────────────────────────────────────────────────

/**
 * Generates a full presentation (.pptx) from a template (.pptx or .potx),
 * preserving all master slides, slide layouts, themes, embedded media,
 * and the closing branded slide.
 *
 * The approach deliberately keeps all template XML structures intact and
 * only replaces the inner text of <a:t> tags.  This ensures PowerPoint
 * can still parse every shape, chart, image reference, and relationship
 * that the template author set up.
 */
export function generateFromTemplate(templateBuffer, slideDataArray) {
  if (!templateBuffer || !Buffer.isBuffer(templateBuffer)) {
    throw new Error('Invalid template buffer provided.');
  }

  const files = unpackZip(templateBuffer);

  // ── 1. Convert POTX content type to PPTX ──────────────────────────────────
  let contentTypesXml = files['[Content_Types].xml']
    ? files['[Content_Types].xml'].toString('utf8')
    : '';
  if (contentTypesXml) {
    contentTypesXml = contentTypesXml.replace(
      /application\/vnd\.openxmlformats-officedocument\.presentationml\.template\.main\+xml/g,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'
    );
  }

  let presXml = files['ppt/presentation.xml']
    ? files['ppt/presentation.xml'].toString('utf8')
    : '';
  let presRelsXml = files['ppt/_rels/presentation.xml.rels']
    ? files['ppt/_rels/presentation.xml.rels'].toString('utf8')
    : '';

  // ── 2. Catalog template sample slides by role ─────────────────────────────
  const catalog = catalogTemplateSampleSlides(files);

  const slidesToCreate = Array.isArray(slideDataArray) && slideDataArray.length > 0
    ? slideDataArray
    : [{ title: 'Presentation' }];

  // ── 3. Clean out ALL old slide references ─────────────────────────────────
  //    This is critical: we must remove old <Relationship>, <Override>, and
  //    <p:sldId> entries so they don't conflict with the new ones.

  // 3a. Remove old slide Relationship entries from presentation.xml.rels
  presRelsXml = removeSlideRelsFromPresRels(presRelsXml);

  // 3b. Remove old slide Override entries from [Content_Types].xml
  contentTypesXml = removeSlideOverrides(contentTypesXml);

  // 3c. Remove old slide files from the zip
  for (const k of Object.keys(files)) {
    if (/^ppt\/slides\/slide\d+\.xml$/i.test(k) || /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/i.test(k)) {
      delete files[k];
    }
  }

  // ── 4. Determine safe starting points for IDs ─────────────────────────────
  const { maxId: maxRId } = parsePresRels(presRelsXml);
  let nextRIdNum = maxRId + 1;

  const maxSldId = parsePresXmlSldIds(presXml);
  let nextSldId = maxSldId + 1;

  // ── 5. Generate output slides ─────────────────────────────────────────────
  const sldIdEntries = [];
  let slideNum = 0;

  for (let i = 0; i < slidesToCreate.length; i++) {
    const slide = slidesToCreate[i];
    slideNum++;

    // Pick the right prototype slide from the template
    let proto;
    if (i === 0) {
      proto = catalog.cover[0] || catalog.all[0];
    } else if (slide.layoutHint === 'section' || (!slide.bullets?.length && !slide.bodyText?.length && slide.title)) {
      proto = catalog.section[0] || catalog.cover[0] || catalog.all[0];
    } else if (slide.layoutHint === 'columns' || slide.layoutHint === 'split') {
      proto = catalog.column[0] || catalog.content[0] || catalog.all[0];
    } else {
      const idx = (i - 1) % Math.max(1, catalog.content.length);
      proto = catalog.content[idx] || catalog.all[0];
    }

    if (!proto) {
      // Absolute last resort — shouldn't happen unless template has no slides
      proto = { xml: '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sld>', relsXml: '' };
    }

    // Clone prototype and inject text
    const newSlideXml = safeInjectText(proto.xml, slide);
    const newRelsXml = proto.relsXml; // keep layout/master references as-is

    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const slideRelsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

    files[slidePath] = newSlideXml;
    if (newRelsXml) files[slideRelsPath] = newRelsXml;

    // Add relationship
    const rId = `rId${nextRIdNum++}`;
    const relEntry = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/>`;
    presRelsXml = presRelsXml.replace('</Relationships>', `${relEntry}</Relationships>`);

    // Add content type override
    const overrideEntry = `<Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
    contentTypesXml = contentTypesXml.replace('</Types>', `${overrideEntry}</Types>`);

    // Add sldId
    const sldId = nextSldId++;
    sldIdEntries.push(`<p:sldId id="${sldId}" r:id="${rId}"/>`);
  }

  // ── 6. Append closing / end slide if template has one ─────────────────────
  if (catalog.end) {
    slideNum++;
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const slideRelsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

    files[slidePath] = catalog.end.xml;    // keep as-is (logo, images, etc.)
    if (catalog.end.relsXml) files[slideRelsPath] = catalog.end.relsXml;

    const rId = `rId${nextRIdNum++}`;
    presRelsXml = presRelsXml.replace('</Relationships>',
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/></Relationships>`);
    contentTypesXml = contentTypesXml.replace('</Types>',
      `<Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);

    const sldId = nextSldId++;
    sldIdEntries.push(`<p:sldId id="${sldId}" r:id="${rId}"/>`);
  }

  // ── 7. Update presentation.xml slide list ─────────────────────────────────
  const sldIdListXml = `<p:sldIdLst>${sldIdEntries.join('')}</p:sldIdLst>`;
  if (/<p:sldIdLst[\s>]/.test(presXml)) {
    presXml = presXml.replace(/<p:sldIdLst[^>]*>[\s\S]*?<\/p:sldIdLst>/, sldIdListXml);
  } else if (presXml.includes('</p:presentation>')) {
    presXml = presXml.replace('</p:presentation>', `${sldIdListXml}</p:presentation>`);
  }

  // ── 8. Write back XML documents ───────────────────────────────────────────
  files['ppt/presentation.xml'] = presXml;
  files['ppt/_rels/presentation.xml.rels'] = presRelsXml;
  files['[Content_Types].xml'] = contentTypesXml;

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
