/**
 * Debug script: Inspects the structure of the sample_deck stored for a project
 * to understand exactly what's in a real IBM POTX/PPTX template.
 *
 * Usage: node node-backend/scripts/inspect-template.mjs <projectId>
 * If no projectId is given, scans for any project that has a sample_deck.pptx.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { unpackZip, packZip } from '../lib/zip-utils.mjs';

const APP_DATA = process.env.APP_DATA_DIR || path.join(
  os.platform() === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : os.platform() === 'win32'
      ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      : path.join(os.homedir(), '.local', 'share'),
  'ai-researcher'
);

async function findTemplatePath(projectId) {
  const projectsDir = process.env.PROJECTS_DIR || path.join(APP_DATA, 'projects');

  if (projectId) {
    const tp = path.join(projectsDir, projectId, '.metadata', 'sample_deck.pptx');
    try { await fs.access(tp); return tp; } catch { /* not found */ }
  }

  // Scan for any project with a template
  for (const entry of await fs.readdir(projectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const tp = path.join(projectsDir, entry.name, '.metadata', 'sample_deck.pptx');
    try {
      await fs.access(tp);
      console.log(`Found template in project: ${entry.name}`);
      return tp;
    } catch { /* skip */ }
  }
  return null;
}

async function main() {
  const projectId = process.argv[2];
  const templatePath = await findTemplatePath(projectId);
  if (!templatePath) {
    console.error('No sample_deck.pptx found');
    process.exit(1);
  }

  console.log(`\nInspecting: ${templatePath}\n`);
  const buf = await fs.readFile(templatePath);
  const files = unpackZip(buf);

  console.log('=== ALL FILES IN ZIP ===');
  const keys = Object.keys(files).sort();
  for (const k of keys) {
    const size = Buffer.isBuffer(files[k]) ? files[k].length : Buffer.from(String(files[k])).length;
    console.log(`  ${k}  (${size} bytes)`);
  }

  console.log('\n=== [Content_Types].xml ===');
  if (files['[Content_Types].xml']) {
    console.log(files['[Content_Types].xml'].toString('utf8').substring(0, 2000));
  }

  console.log('\n=== ppt/presentation.xml (first 3000 chars) ===');
  if (files['ppt/presentation.xml']) {
    console.log(files['ppt/presentation.xml'].toString('utf8').substring(0, 3000));
  }

  console.log('\n=== ppt/_rels/presentation.xml.rels ===');
  if (files['ppt/_rels/presentation.xml.rels']) {
    console.log(files['ppt/_rels/presentation.xml.rels'].toString('utf8').substring(0, 3000));
  }

  // List slide layouts with names
  const layoutPaths = keys.filter(k => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(k));
  console.log(`\n=== SLIDE LAYOUTS (${layoutPaths.length}) ===`);
  for (const lp of layoutPaths) {
    const xml = files[lp].toString('utf8');
    const nameMatch = xml.match(/<p:cSld[^>]*\bname="([^"]+)"/i);
    const phTypes = [...xml.matchAll(/<p:ph[^>]*\btype="([^"]+)"/gi)].map(m => m[1]);
    console.log(`  ${lp} => name="${nameMatch?.[1] || '(none)'}"  phTypes=[${phTypes.join(', ')}]`);
  }

  // List sample slides
  const slidePaths = keys.filter(k => /^ppt\/slides\/slide\d+\.xml$/i.test(k)).sort();
  console.log(`\n=== SAMPLE SLIDES (${slidePaths.length}) ===`);
  for (const sp of slidePaths) {
    const xml = files[sp].toString('utf8');
    const relsPath = sp.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
    const relsXml = files[relsPath] ? files[relsPath].toString('utf8') : '';
    
    // Find referenced layout
    const layoutRef = relsXml.match(/Target="(?:\.\.\/)?slideLayouts\/(slideLayout\d+\.xml)"/i);
    const layoutFile = layoutRef ? `ppt/slideLayouts/${layoutRef[1]}` : null;
    let layoutName = '';
    if (layoutFile && files[layoutFile]) {
      const lxml = files[layoutFile].toString('utf8');
      const nm = lxml.match(/<p:cSld[^>]*\bname="([^"]+)"/i);
      layoutName = nm?.[1] || '';
    }

    // Count text nodes
    const textNodes = xml.match(/<a:t>[^<]*<\/a:t>/g) || [];
    const phTypes = [...xml.matchAll(/<p:ph[^>]*\btype="([^"]+)"/gi)].map(m => m[1]);
    
    console.log(`  ${sp}`);
    console.log(`    layout: ${layoutFile || '(none)'} => "${layoutName}"`);
    console.log(`    phTypes in slide XML: [${phTypes.join(', ')}]`);
    console.log(`    text nodes (${textNodes.length}): ${textNodes.slice(0, 5).join(' | ')}${textNodes.length > 5 ? ' ...' : ''}`);
    
    // Show rels content
    if (relsXml) {
      const rels = [...relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/gi)].map(m => `${m[1]}->${m[2]}`);
      console.log(`    rels: ${rels.join(', ')}`);
    }
  }

  // Show slide rels for slide 1 fully
  if (files['ppt/slides/_rels/slide1.xml.rels']) {
    console.log('\n=== ppt/slides/_rels/slide1.xml.rels ===');
    console.log(files['ppt/slides/_rels/slide1.xml.rels'].toString('utf8'));
  }

  // Show the first slide XML (first 2000 chars)
  if (slidePaths.length > 0) {
    console.log(`\n=== ${slidePaths[0]} (first 2000 chars) ===`);
    console.log(files[slidePaths[0]].toString('utf8').substring(0, 2000));
  }

  // Show last slide XML if it looks like an end slide
  if (slidePaths.length > 1) {
    const lastSlide = slidePaths[slidePaths.length - 1];
    const lastXml = files[lastSlide].toString('utf8');
    console.log(`\n=== ${lastSlide} (last slide - first 2000 chars) ===`);
    console.log(lastXml.substring(0, 2000));
  }

  // Test round-trip
  console.log('\n=== Round-trip test ===');
  const repacked = packZip(files);
  const reunpacked = unpackZip(repacked);
  const origKeys = Object.keys(files).sort();
  const reKeys = Object.keys(reunpacked).sort();
  console.log(`  Original file count: ${origKeys.length}`);
  console.log(`  Repacked file count: ${reKeys.length}`);
  const missingInRepack = origKeys.filter(k => !reKeys.includes(k));
  if (missingInRepack.length > 0) {
    console.log(`  MISSING after repack: ${missingInRepack.join(', ')}`);
  } else {
    console.log('  All files preserved ✓');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
