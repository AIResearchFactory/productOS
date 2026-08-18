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
 * Analyzes template files to catalog slide layouts and sample slides by role.
 */
function catalogTemplateStructure(files) {
  const layouts = {};
  const layoutKeys = Object.keys(files).filter(k => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(k));
  
  for (const layoutPath of layoutKeys) {
    const xml = files[layoutPath].toString('utf8');
    const nameMatch = xml.match(/<p:cSld[^>]*\bname="([^"]+)"/i);
    const layoutName = nameMatch ? nameMatch[1] : '';
    const layoutTypeMatch = xml.match(/<p:ph[^>]*\btype="([^"]+)"/i);
    const phType = layoutTypeMatch ? layoutTypeMatch[1] : '';

    layouts[layoutPath] = {
      path: layoutPath,
      name: layoutName,
      phType,
      xml
    };
  }

  // Find sample slides
  const sampleSlidePaths = Object.keys(files)
    .filter(path => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
      return numA - numB;
    });

  const catalog = {
    layouts,
    sampleSlides: [],
    coverSlides: [],
    sectionSlides: [],
    contentSlides: [],
    columnSlides: [],
    endSlide: null
  };

  for (const slidePath of sampleSlidePaths) {
    const slideXml = files[slidePath].toString('utf8');
    const relsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const relsXml = files[relsPath] ? files[relsPath].toString('utf8') : '';
    
    // Find layout referenced in rels
    const layoutMatch = relsXml.match(/Target="(?:\.\.\/)?slideLayouts\/(slideLayout\d+\.xml)"/i);
    const layoutFilename = layoutMatch ? `ppt/slideLayouts/${layoutMatch[1]}` : null;
    const layoutInfo = layoutFilename ? layouts[layoutFilename] : null;
    const layoutName = (layoutInfo?.name || '').toLowerCase();

    const slideEntry = {
      path: slidePath,
      relsPath,
      slideXml,
      relsXml,
      layoutName,
      layoutFilename
    };

    catalog.sampleSlides.push(slideEntry);

    // Classify slide role
    const isCover = /cover|title|intro/i.test(layoutName) || /type="ctrTitle"/i.test(slideXml);
    const isSection = /section|divider|head/i.test(layoutName) || /type="secHead"/i.test(slideXml);
    const isEnd = /end|closing|thank|logo/i.test(layoutName) ||
      (slidePath === sampleSlidePaths[sampleSlidePaths.length - 1] && /end\s*slide|thank\s*you|ibm/i.test(slideXml.toLowerCase()));
    const isColumn = /column|col|box|cards?|callout/i.test(layoutName);

    if (isEnd) {
      catalog.endSlide = slideEntry;
    }
    if (isCover) {
      catalog.coverSlides.push(slideEntry);
    } else if (isSection) {
      catalog.sectionSlides.push(slideEntry);
    } else if (isColumn) {
      catalog.columnSlides.push(slideEntry);
    } else if (!isEnd) {
      catalog.contentSlides.push(slideEntry);
    }
  }

  // Fallback defaults if categorized lists are empty
  if (catalog.coverSlides.length === 0 && catalog.sampleSlides.length > 0) {
    catalog.coverSlides.push(catalog.sampleSlides[0]);
  }
  if (catalog.contentSlides.length === 0 && catalog.sampleSlides.length > 0) {
    catalog.contentSlides.push(catalog.sampleSlides[Math.min(1, catalog.sampleSlides.length - 1)]);
  }
  if (catalog.sectionSlides.length === 0 && catalog.coverSlides.length > 0) {
    catalog.sectionSlides.push(catalog.coverSlides[0]);
  }

  return catalog;
}

/**
 * Replaces title and body/bullet text inside an OOXML slide XML.
 */
function injectContentIntoSlide(templateSlideXml, slideData) {
  let xml = templateSlideXml;
  const title = stripMarkdown(slideData.header || slideData.title || '');
  const bullets = (slideData.bullets || []).map(b => stripMarkdown(b));
  const bodyText = (slideData.bodyText || []).map(t => stripMarkdown(t));

  // Extract <p:sp> shape elements
  const shapeRegex = /<p:sp>[\s\S]*?<\/p:sp>/g;
  const shapes = xml.match(shapeRegex) || [];

  let titleShapeIdx = -1;
  let bodyShapeIdx = -1;

  shapes.forEach((sp, idx) => {
    if (/<p:ph[^>]*\btype="(?:ctrTitle|title)"/i.test(sp)) {
      if (titleShapeIdx === -1) titleShapeIdx = idx;
    } else if (/<p:ph[^>]*\btype="(?:body|subTitle)"/i.test(sp) || /<p:ph[^>]*\bidx="1"/i.test(sp)) {
      if (bodyShapeIdx === -1) bodyShapeIdx = idx;
    }
  });

  // Fallback if no explicit <p:ph> tags match
  if (titleShapeIdx === -1 && shapes.length > 0) titleShapeIdx = 0;
  if (bodyShapeIdx === -1 && shapes.length > 1) bodyShapeIdx = 1;

  // 1. Inject Title
  if (title && titleShapeIdx !== -1 && shapes[titleShapeIdx]) {
    let titleSp = shapes[titleShapeIdx];
    // Find text run styling <a:rPr ...>
    const rPrMatch = titleSp.match(/<a:rPr\b[^>]*>/i);
    const rPrTag = rPrMatch ? rPrMatch[0] : '';
    const newTxBody = `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>${rPrTag}<a:t>${escapeXml(title)}</a:t></a:r></a:p></p:txBody>`;
    
    if (/<p:txBody>[\s\S]*?<\/p:txBody>/.test(titleSp)) {
      titleSp = titleSp.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, newTxBody);
    } else {
      titleSp = titleSp.replace('</p:sp>', `${newTxBody}</p:sp>`);
    }
    xml = xml.replace(shapes[titleShapeIdx], titleSp);
  } else if (title && xml.includes('<a:t>')) {
    xml = xml.replace(/<a:t>[^<]*<\/a:t>/, `<a:t>${escapeXml(title)}</a:t>`);
  }

  // 2. Inject Body / Bullets
  const allContentItems = [...bodyText, ...bullets];
  if (allContentItems.length > 0 && bodyShapeIdx !== -1 && shapes[bodyShapeIdx]) {
    // Re-match shapes from updated xml
    const updatedShapes = xml.match(shapeRegex) || [];
    if (updatedShapes[bodyShapeIdx]) {
      let bodySp = updatedShapes[bodyShapeIdx];
      const rPrMatch = bodySp.match(/<a:rPr\b[^>]*>/i);
      const rPrTag = rPrMatch ? rPrMatch[0] : '';

      const paragraphsXml = allContentItems.map((item, itemIdx) => {
        const isBullet = itemIdx >= bodyText.length;
        const pPr = isBullet ? '<a:pPr lvl="0"/>' : '';
        return `<a:p>${pPr}<a:r>${rPrTag}<a:t>${escapeXml(item)}</a:t></a:r></a:p>`;
      }).join('');

      const newTxBody = `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphsXml}</p:txBody>`;
      if (/<p:txBody>[\s\S]*?<\/p:txBody>/.test(bodySp)) {
        bodySp = bodySp.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, newTxBody);
      } else {
        bodySp = bodySp.replace('</p:sp>', `${newTxBody}</p:sp>`);
      }
      xml = xml.replace(updatedShapes[bodyShapeIdx], bodySp);
    }
  } else if (allContentItems.length > 0 && xml.includes('<a:t>')) {
    let matches = 0;
    const contentText = allContentItems.join('\n');
    xml = xml.replace(/<a:t>[^<]*<\/a:t>/g, (match) => {
      matches++;
      if (matches === 2) {
        return `<a:t>${escapeXml(contentText)}</a:t>`;
      }
      return match;
    });
  }

  return xml;
}

/**
 * Generates a full presentation (.pptx) from a template (.pptx or .potx),
 * preserving all master slides, layouts, embedded media, and closing branding slides.
 */
export function generateFromTemplate(templateBuffer, slideDataArray) {
  if (!templateBuffer || !Buffer.isBuffer(templateBuffer)) {
    throw new Error('Invalid template buffer provided.');
  }

  const files = unpackZip(templateBuffer);

  // 1. Ensure [Content_Types].xml is updated from template to presentation format
  let contentTypesXml = files['[Content_Types].xml'] ? files['[Content_Types].xml'].toString('utf8') : '';
  if (contentTypesXml) {
    contentTypesXml = contentTypesXml.replace(
      /application\/vnd\.openxmlformats-officedocument\.presentationml\.template\.main\+xml/g,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'
    );
  }

  let presXml = files['ppt/presentation.xml'] ? files['ppt/presentation.xml'].toString('utf8') : '';
  let presRelsXml = files['ppt/_rels/presentation.xml.rels'] ? files['ppt/_rels/presentation.xml.rels'].toString('utf8') : '';

  // 2. Catalog layouts and sample slides in template
  const catalog = catalogTemplateStructure(files);

  const slidesToCreate = Array.isArray(slideDataArray) && slideDataArray.length > 0
    ? slideDataArray
    : [{ title: 'Presentation' }];

  const sldIdEntries = [];
  const finalSlideFiles = {};
  let currentSlideNum = 1;

  // 3. Generate presentation slides from input data
  slidesToCreate.forEach((slide, index) => {
    const slideNumber = currentSlideNum++;
    const newSlidePath = `ppt/slides/slide${slideNumber}.xml`;
    const newRelsPath = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    const rId = `rId${100 + slideNumber}`;
    const slideId = 256 + index;

    // Determine target layout type
    let chosenPrototype = null;
    if (index === 0) {
      chosenPrototype = catalog.coverSlides[0] || catalog.sampleSlides[0];
    } else if (slide.layoutHint === 'section' || (!slide.bullets?.length && !slide.bodyText?.length && slide.title)) {
      chosenPrototype = catalog.sectionSlides[0] || catalog.coverSlides[0] || catalog.sampleSlides[0];
    } else if (slide.layoutHint === 'columns' || slide.layoutHint === 'split') {
      chosenPrototype = catalog.columnSlides[0] || catalog.contentSlides[0] || catalog.sampleSlides[0];
    } else {
      const contentIdx = (index - 1) % Math.max(1, catalog.contentSlides.length);
      chosenPrototype = catalog.contentSlides[contentIdx] || catalog.sampleSlides[0];
    }

    if (!chosenPrototype && catalog.sampleSlides.length > 0) {
      chosenPrototype = catalog.sampleSlides[0];
    }

    let slideXml = chosenPrototype ? chosenPrototype.slideXml : '<p:sld><p:cSld><p:spTree></p:spTree></p:cSld></p:sld>';
    let relsXml = chosenPrototype?.relsXml || files['ppt/slides/_rels/slide1.xml.rels']?.toString('utf8') || '<Relationships></Relationships>';

    // Inject document title, body, and bullet points
    slideXml = injectContentIntoSlide(slideXml, slide);

    finalSlideFiles[newSlidePath] = slideXml;
    finalSlideFiles[newRelsPath] = relsXml;

    // Ensure relationship exists in presentation.xml.rels
    if (presRelsXml && !presRelsXml.includes(`Target="slides/slide${slideNumber}.xml"`)) {
      const newRel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNumber}.xml"/>`;
      presRelsXml = presRelsXml.replace('</Relationships>', `${newRel}</Relationships>`);
    }

    // Ensure Override in [Content_Types].xml
    if (contentTypesXml && !contentTypesXml.includes(`PartName="/ppt/slides/slide${slideNumber}.xml"`)) {
      const newOverride = `<Override PartName="/ppt/slides/slide${slideNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
      contentTypesXml = contentTypesXml.replace('</Types>', `${newOverride}</Types>`);
    }

    sldIdEntries.push(`<p:sldId id="${slideId}" r:id="${rId}"/>`);
  });

  // 4. Append End / Closing slide if present in template
  if (catalog.endSlide) {
    const endSlideNumber = currentSlideNum++;
    const endSlidePath = `ppt/slides/slide${endSlideNumber}.xml`;
    const endRelsPath = `ppt/slides/_rels/slide${endSlideNumber}.xml.rels`;
    const endRId = `rId${100 + endSlideNumber}`;
    const endSlideId = 256 + slidesToCreate.length;

    finalSlideFiles[endSlidePath] = catalog.endSlide.slideXml;
    finalSlideFiles[endRelsPath] = catalog.endSlide.relsXml;

    if (presRelsXml && !presRelsXml.includes(`Target="slides/slide${endSlideNumber}.xml"`)) {
      const endRel = `<Relationship Id="${endRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${endSlideNumber}.xml"/>`;
      presRelsXml = presRelsXml.replace('</Relationships>', `${endRel}</Relationships>`);
    }

    if (contentTypesXml && !contentTypesXml.includes(`PartName="/ppt/slides/slide${endSlideNumber}.xml"`)) {
      const endOverride = `<Override PartName="/ppt/slides/slide${endSlideNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
      contentTypesXml = contentTypesXml.replace('</Types>', `${endOverride}</Types>`);
    }

    sldIdEntries.push(`<p:sldId id="${endSlideId}" r:id="${endRId}"/>`);
  }

  // 5. Remove any old slide files that are no longer part of output
  const oldSlidePaths = Object.keys(files).filter(k => /^ppt\/slides\/slide\d+\.xml$/i.test(k) || /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/i.test(k));
  for (const oldPath of oldSlidePaths) {
    delete files[oldPath];
  }

  // Add final generated slide files
  for (const [path, content] of Object.entries(finalSlideFiles)) {
    files[path] = content;
  }

  // 6. Update presentation.xml, presentation.xml.rels, and [Content_Types].xml
  if (presXml && presXml.includes('<p:sldIdLst>')) {
    presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${sldIdEntries.join('')}</p:sldIdLst>`);
  } else if (presXml && presXml.includes('</p:presentation>')) {
    presXml = presXml.replace('</p:presentation>', `<p:sldIdLst>${sldIdEntries.join('')}</p:sldIdLst></p:presentation>`);
  }
  files['ppt/presentation.xml'] = presXml;

  if (presRelsXml) {
    files['ppt/_rels/presentation.xml.rels'] = presRelsXml;
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
