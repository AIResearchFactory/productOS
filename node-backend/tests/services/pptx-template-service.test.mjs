import test from 'node:test';
import assert from 'node:assert/strict';

import { unpackZip, packZip, crc32 } from '../../lib/zip-utils.mjs';
import { generateFromTemplate } from '../../lib/services/pptx-template-service.mjs';

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

test('generateFromTemplate - duplicates slides and replaces OOXML placeholders', () => {
  const templateFiles = {
    'ppt/presentation.xml': '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
    'ppt/slides/slide1.xml': '<p:sld><a:t>Title Placeholder</a:t><a:t>Body Placeholder</a:t></p:sld>',
    'ppt/slides/_rels/slide1.xml.rels': '<Relationships></Relationships>'
  };

  const templateZip = packZip(templateFiles);

  const slideData = [
    { title: 'Executive Summary', bodyText: ['Key Insight 1'], bullets: ['Bullet A'] },
    { title: 'Financial Growth', bodyText: ['$4.2M ARR'], bullets: ['45% YoY'] }
  ];

  const resultZip = generateFromTemplate(templateZip, slideData);
  assert.ok(Buffer.isBuffer(resultZip));

  const resultFiles = unpackZip(resultZip);
  assert.ok(resultFiles['ppt/slides/slide1.xml']);
  assert.ok(resultFiles['ppt/slides/slide2.xml']);

  const slide1Xml = resultFiles['ppt/slides/slide1.xml'].toString('utf8');
  assert.ok(slide1Xml.includes('Executive Summary'));
  assert.ok(slide1Xml.includes('Key Insight 1'));

  const slide2Xml = resultFiles['ppt/slides/slide2.xml'].toString('utf8');
  assert.ok(slide2Xml.includes('Financial Growth'));
  assert.ok(slide2Xml.includes('$4.2M ARR'));
});
