import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/User/.openclaw/workspace/productOS/node_modules/playwright');

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = path.join(dir, 'productos-visual-mockups.html');
const assetDir = path.resolve(dir, '../../assets/ux');
await fs.mkdir(assetDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(`file://${html.replaceAll('\\', '/')}`, { waitUntil: 'load' });

const shots = [
  ['home', '#home .screen'],
  ['context', '#context .screen'],
  ['outputs', '#outputs .screen'],
  ['automations', '#automations .screen'],
  ['copilot', '#copilot .screen'],
  ['compact', '#compact .screen'],
  ['flows', '#flows .screen'],
];
for (const [name, selector] of shots) {
  const loc = page.locator(selector).first();
  await loc.screenshot({ path: path.join(assetDir, `productos-visual-${name}.png`) });
  console.log(`rendered ${name}`);
}
await browser.close();
