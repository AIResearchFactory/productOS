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

test('generateFromTemplate - basic text injection and slide generation', () => {
  const templateFiles = {
    '[Content_Types].xml': '<Types><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
    'ppt/presentation.xml': '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    'ppt/slides/slide1.xml': '<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Title Here</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:txBody><a:p><a:r><a:t>Body Here</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    'ppt/slides/_rels/slide1.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'
  };

  const templateZip = packZip(templateFiles);

  const slideData = [
    { title: 'Executive Summary', bodyText: ['Key Insight'], bullets: ['Bullet A'] },
    { title: 'Growth Plan', bodyText: ['$4.2M ARR'], bullets: ['45% YoY'] }
  ];

  const resultZip = generateFromTemplate(templateZip, slideData);
  assert.ok(Buffer.isBuffer(resultZip));

  const resultFiles = unpackZip(resultZip);

  // Both slides must exist
  assert.ok(resultFiles['ppt/slides/slide1.xml']);
  assert.ok(resultFiles['ppt/slides/slide2.xml']);

  // Title injected into first <a:t> tag
  const s1 = resultFiles['ppt/slides/slide1.xml'].toString('utf8');
  assert.ok(s1.includes('Executive Summary'), 'Slide 1 should contain title');

  const s2 = resultFiles['ppt/slides/slide2.xml'].toString('utf8');
  assert.ok(s2.includes('Growth Plan'), 'Slide 2 should contain title');
});

test('generateFromTemplate - old slide relationships are fully cleaned up (no duplicates)', () => {
  // This test verifies the critical fix: old rId→slides/slide*.xml entries
  // must be removed before new ones are added.
  const templateFiles = {
    '[Content_Types].xml': '<Types><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
    'ppt/presentation.xml': '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>',
    'ppt/slides/slide1.xml': '<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Cover Title</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    'ppt/slides/_rels/slide1.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>',
    'ppt/slides/slide2.xml': '<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Body Title</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    'ppt/slides/_rels/slide2.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'
  };

  const templateZip = packZip(templateFiles);
  const resultZip = generateFromTemplate(templateZip, [{ title: 'Only Slide' }]);
  const resultFiles = unpackZip(resultZip);

  const rels = resultFiles['ppt/_rels/presentation.xml.rels'].toString('utf8');

  // Old rId3 (which pointed to slide2.xml) must be GONE
  assert.ok(!rels.includes('Id="rId3"'), 'Old rId3 should be removed');

  // Non-slide relationships (rId1 for slideMaster) must be preserved
  assert.ok(rels.includes('slideMasters/slideMaster1.xml'), 'slideMaster relationship must survive');

  // Exactly 1 new slide relationship should exist
  const slideRelCount = (rels.match(/Target="slides\/slide\d+\.xml"/g) || []).length;
  assert.equal(slideRelCount, 1, 'Should have exactly 1 slide relationship');

  // No old Override entries for slide2 in Content_Types
  const ct = resultFiles['[Content_Types].xml'].toString('utf8');
  assert.ok(!ct.includes('slide2.xml'), 'Old slide2 override should be removed');
});

test('generateFromTemplate - converts POTX content type to PPTX and preserves End slide', () => {
  const templateFiles = {
    '[Content_Types].xml': '<Types><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.template.main+xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
    'ppt/presentation.xml': '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/></Relationships>',
    'ppt/slideLayouts/slideLayout1.xml': '<p:sldLayout><p:cSld name="Cover, cyan"><p:spTree/></p:cSld></p:sldLayout>',
    'ppt/slideLayouts/slideLayout2.xml': '<p:sldLayout><p:cSld name="End slide"><p:spTree/></p:cSld></p:sldLayout>',
    'ppt/slides/slide1.xml': '<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Cover</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    'ppt/slides/_rels/slide1.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>',
    'ppt/slides/slide2.xml': '<p:sld><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>IBM Logo End Slide</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>',
    'ppt/slides/_rels/slide2.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/></Relationships>',
    'ppt/slideLayouts/slideLayout3.xml': '<p:sldLayout><p:cSld name="Content"><p:spTree/></p:cSld></p:sldLayout>'
  };

  const templateZip = packZip(templateFiles);

  const resultZip = generateFromTemplate(templateZip, [
    { title: 'My Presentation' },
    { title: 'Key Findings', bodyText: ['Finding A'], bullets: ['Detail 1'] }
  ]);

  const resultFiles = unpackZip(resultZip);

  // POTX content type should be converted
  const ct = resultFiles['[Content_Types].xml'].toString('utf8');
  assert.ok(ct.includes('presentation.main+xml'), 'Should be presentation format');
  assert.ok(!ct.includes('template.main+xml'), 'Should not be template format');

  // Should have 3 slides: 2 content + 1 end slide
  assert.ok(resultFiles['ppt/slides/slide1.xml'], 'Slide 1 exists');
  assert.ok(resultFiles['ppt/slides/slide2.xml'], 'Slide 2 exists');
  assert.ok(resultFiles['ppt/slides/slide3.xml'], 'Slide 3 (end slide) exists');

  // End slide should be preserved as-is with IBM logo text
  const endXml = resultFiles['ppt/slides/slide3.xml'].toString('utf8');
  assert.ok(endXml.includes('IBM Logo End Slide'), 'End slide content should be preserved');

  // Layouts must still be in the zip
  assert.ok(resultFiles['ppt/slideLayouts/slideLayout1.xml'], 'Layout 1 preserved');
  assert.ok(resultFiles['ppt/slideLayouts/slideLayout2.xml'], 'Layout 2 preserved');
  assert.ok(resultFiles['ppt/slideLayouts/slideLayout3.xml'], 'Layout 3 preserved');

  // presentation.xml should have valid sldIdLst with 3 entries
  const presXml = resultFiles['ppt/presentation.xml'].toString('utf8');
  const sldIdCount = (presXml.match(/<p:sldId /g) || []).length;
  assert.equal(sldIdCount, 3, 'Should have 3 sldId entries in presentation.xml');
});

test('generateFromTemplate - XML structure not corrupted (shapes preserved)', () => {
  // This test ensures we don't break OOXML shape structure.
  // A real template has complex nested XML — we should only touch <a:t> inner text.
  const complexSlideXml = `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="2743200"/></a:xfrm></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" dirty="0" sz="4400"/><a:t>Click to add title</a:t></a:r></a:p></p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Subtitle 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Click to add subtitle</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;

  const templateFiles = {
    '[Content_Types].xml': '<Types><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>',
    'ppt/presentation.xml': '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst></p:presentation>',
    'ppt/_rels/presentation.xml.rels': '<Relationships><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    'ppt/slides/slide1.xml': complexSlideXml,
    'ppt/slides/_rels/slide1.xml.rels': '<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'
  };

  const templateZip = packZip(templateFiles);
  const resultZip = generateFromTemplate(templateZip, [{ title: 'My Startup', bodyText: ['We build stuff'], bullets: [] }]);
  const resultFiles = unpackZip(resultZip);
  const s1 = resultFiles['ppt/slides/slide1.xml'].toString('utf8');

  // Title should be replaced
  assert.ok(s1.includes('My Startup'), 'Title should be injected');
  assert.ok(!s1.includes('Click to add title'), 'Original title placeholder should be gone');

  // CRITICAL: All structural XML elements must still be present
  assert.ok(s1.includes('<p:nvGrpSpPr>'), 'Group shape properties must survive');
  assert.ok(s1.includes('type="ctrTitle"'), 'Placeholder type must survive');
  assert.ok(s1.includes('<a:bodyPr'), 'Body properties must survive');
  assert.ok(s1.includes('<a:rPr'), 'Run properties must survive');
  assert.ok(s1.includes('<a:spLocks'), 'Shape locks must survive');
  assert.ok(s1.includes('id="2"'), 'Shape IDs must survive');
  assert.ok(s1.includes('<a:xfrm>'), 'Transform must survive');
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
