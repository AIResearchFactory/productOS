import test from 'node:test';
import assert from 'node:assert/strict';

import { unpackZip, packZip, crc32 } from '../../lib/zip-utils.mjs';
import { generateFromTemplate, extractBrandConfigFromPptx } from '../../lib/services/pptx-template-service.mjs';

test('crc32 - computes deterministic checksums', () => {
  const buf = Buffer.from('hello world', 'utf8');
  assert.equal(typeof crc32(buf), 'number');
  assert.equal(crc32(buf), crc32(Buffer.from('hello world', 'utf8')));
});

test('unpackZip & packZip - roundtrips zip files cleanly', () => {
  const originalFiles = {
    'ppt/presentation.xml': '<p:presentation><p:sldIdLst></p:sldIdLst></p:presentation>',
    'ppt/slides/slide1.xml': '<p:sld><a:t>Original Title</a:t></p:sld>'
  };

  const zipped = packZip(originalFiles);
  assert.ok(Buffer.isBuffer(zipped));
  assert.ok(zipped.length > 0);

  const unzipped = unpackZip(zipped);
  assert.equal(unzipped['ppt/presentation.xml'].toString('utf8'), originalFiles['ppt/presentation.xml']);
  assert.equal(unzipped['ppt/slides/slide1.xml'].toString('utf8'), originalFiles['ppt/slides/slide1.xml']);
});

test('generateFromTemplate - duplicates slides, converts POTX content types, and preserves layouts and End slide', () => {
  const templateFiles = {
    '[Content_Types].xml': '<Types><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.template.main+xml"/></Types>',
    'ppt/presentation.xml': '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/><p:sldId id="258" r:id="rId3"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    'ppt/slideLayouts/slideLayout1.xml': '<p:sldLayout><p:cSld name="Cover, cyan"><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Cover Title</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sldLayout>',
    'ppt/slideLayouts/slideLayout2.xml': '<p:sldLayout><p:cSld name="Section divider"><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="secHead"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Section Header</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sldLayout>',
    'ppt/slideLayouts/slideLayout3.xml': '<p:sldLayout><p:cSld name="Text, 4 columns"><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Content Title</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Content Body</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sldLayout>',
    'ppt/slideLayouts/slideLayout4.xml': '<p:sldLayout><p:cSld name="End slide"><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>IBM End Slide</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sldLayout>',
    'ppt/slides/slide1.xml': '<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Sample Cover</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    'ppt/slides/_rels/slide1.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>',
    'ppt/slides/slide2.xml': '<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Sample Body</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Sample Text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    'ppt/slides/_rels/slide2.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout3.xml"/></Relationships>',
    'ppt/slides/slide3.xml': '<p:sld><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>IBM</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    'ppt/slides/_rels/slide3.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout4.xml"/></Relationships>'
  };

  const templateZip = packZip(templateFiles);

  const slideData = [
    { title: 'Project Roadmap 2026', bodyText: [], bullets: [] },
    { title: 'Executive Summary', bodyText: ['Key strategic goal.'], bullets: ['Achieve 100% adoption', 'Scale backend'] }
  ];

  const resultZip = generateFromTemplate(templateZip, slideData);
  assert.ok(Buffer.isBuffer(resultZip));

  const resultFiles = unpackZip(resultZip);
  
  // Verify POTX content type was converted to PPTX presentation
  const contentTypes = resultFiles['[Content_Types].xml'].toString('utf8');
  assert.ok(contentTypes.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'));
  assert.ok(!contentTypes.includes('template.main+xml'));

  // Slide 1 (Cover) + Slide 2 (Content) + Slide 3 (End Slide preserved)
  assert.ok(resultFiles['ppt/slides/slide1.xml']);
  assert.ok(resultFiles['ppt/slides/slide2.xml']);
  assert.ok(resultFiles['ppt/slides/slide3.xml']);

  const slide1Xml = resultFiles['ppt/slides/slide1.xml'].toString('utf8');
  assert.ok(slide1Xml.includes('Project Roadmap 2026'));

  const slide2Xml = resultFiles['ppt/slides/slide2.xml'].toString('utf8');
  assert.ok(slide2Xml.includes('Executive Summary'));
  assert.ok(slide2Xml.includes('Key strategic goal.'));
  assert.ok(slide2Xml.includes('Achieve 100% adoption'));

  const slide3Xml = resultFiles['ppt/slides/slide3.xml'].toString('utf8');
  assert.ok(slide3Xml.includes('IBM'));

  // Verify slide layouts are preserved
  assert.ok(resultFiles['ppt/slideLayouts/slideLayout1.xml']);
  assert.ok(resultFiles['ppt/slideLayouts/slideLayout2.xml']);
  assert.ok(resultFiles['ppt/slideLayouts/slideLayout3.xml']);
  assert.ok(resultFiles['ppt/slideLayouts/slideLayout4.xml']);
});

test('extractBrandConfigFromPptx - extracts colors, fonts and logo from template zip', () => {
  const themeXml = `
    <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
      <a:themeElements>
        <a:clrScheme name="Office">
          <a:dk1><a:sysClr val="windowText" lastClr="1E1E2F"/></a:dk1>
          <a:lt1><a:sysClr val="window" lastClr="FAFAFA"/></a:lt1>
          <a:dk2><a:srgbClr val="2D3748"/></a:dk2>
          <a:lt2><a:srgbClr val="F7FAFC"/></a:lt2>
          <a:accent1><a:srgbClr val="4F46E5"/></a:accent1>
          <a:accent2><a:srgbClr val="06B6D4"/></a:accent2>
          <a:accent3><a:srgbClr val="10B981"/></a:accent3>
        </a:clrScheme>
        <a:fontScheme name="Office">
          <a:majorFont><a:latin typeface="Montserrat"/></a:majorFont>
          <a:minorFont><a:latin typeface="Inter"/></a:minorFont>
        </a:fontScheme>
      </a:themeElements>
    </a:theme>
  `;

  const dummyImageBuf = Buffer.from('GIF89a...', 'binary');

  const templateFiles = {
    '[Content_Types].xml': '<Types><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.template.main+xml"/></Types>',
    'ppt/presentation.xml': '<p:presentation></p:presentation>',
    'ppt/theme/theme1.xml': themeXml,
    'ppt/media/company_logo.png': dummyImageBuf,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': '<Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/company_logo.png"/></Relationships>'
  };

  const templateZip = packZip(templateFiles);
  const brand = extractBrandConfigFromPptx(templateZip);

  assert.ok(brand);
  assert.equal(brand.colors.primary, '#4F46E5');
  assert.equal(brand.colors.secondary, '#06B6D4');
  assert.equal(brand.colors.accent, '#10B981');
  assert.equal(brand.colors.background, '#FAFAFA');
  assert.equal(brand.colors.text, '#1E1E2F');
  assert.equal(brand.typography.heading_font, 'Montserrat');
  assert.equal(brand.typography.body_font, 'Inter');
  assert.ok(brand.logo);
  assert.equal(brand.logo.filename, 'company_logo.png');
  assert.ok(brand.logo.data.startsWith('data:image/png;base64,'));
});
