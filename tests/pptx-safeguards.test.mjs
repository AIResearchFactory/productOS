import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanitizeHexColor,
  deepCloneOptions,
  sanitizeShadowOptions,
  sanitizeChartOptions,
  calculateHeroFontSize
} from '../src/lib/presentation/pptxSafeguards.ts';

import { resolveBrandConfig, DEFAULT_MODERN_DARK_BRAND } from '../src/lib/presentation/brandSystem.ts';

test('sanitizeHexColor - strips leading # and normalizes valid hex', () => {
  assert.equal(sanitizeHexColor('#0F172A'), '0F172A');
  assert.equal(sanitizeHexColor('06b6d4'), '06B6D4');
  assert.equal(sanitizeHexColor('#FFF'), 'FFFFFF');
  assert.equal(sanitizeHexColor('#FF0000FF'), 'FF0000'); // Strips 8-digit alpha
});

test('sanitizeHexColor - falls back gracefully on invalid input', () => {
  assert.equal(sanitizeHexColor('invalid-color', '0F172A'), '0F172A');
  assert.equal(sanitizeHexColor(null, '10B981'), '10B981');
});

test('deepCloneOptions - creates isolated copies without mutating target', () => {
  const original = { x: 1, y: 2, fill: { color: '0F172A' } };
  const cloned = deepCloneOptions(original);
  cloned.x = 99;
  cloned.fill.color = 'FFFFFF';
  assert.equal(original.x, 1);
  assert.equal(original.fill.color, '0F172A');
});

test('sanitizeShadowOptions - ensures non-negative shadow offset', () => {
  const shadow = { offset: -5, opacity: 0.5 };
  const sanitized = sanitizeShadowOptions(shadow);
  assert.equal(sanitized.offset, 5);
  assert.equal(sanitized.angle, 270);
});

test('sanitizeChartOptions - validates stacked chart label positions', () => {
  const opts = sanitizeChartOptions('stackedBar', { dataLabelPosition: 'outEnd', chartColors: ['#0F172A'] });
  assert.equal(opts.dataLabelPosition, 'ctr');
  assert.equal(opts.chartColors[0], '0F172A');
});

test('calculateHeroFontSize - scales hero digits dynamically', () => {
  assert.equal(calculateHeroFontSize('100%'), 72);
  assert.equal(calculateHeroFontSize('$4.2M ARR'), 54);
  assert.equal(calculateHeroFontSize('+85% YoY Growth Rate'), 36);
});

test('resolveBrandConfig - defaults to Modern Dark Slate Theme', () => {
  const brand = resolveBrandConfig();
  assert.equal(brand.primary, '0F172A');
  assert.equal(brand.accent, '06B6D4');
  assert.equal(brand.secondary, '10B981');
  assert.equal(brand.backgroundDark, '0F172A');
  assert.equal(brand.textPrimary, 'F8FAFC');
});

test('resolveBrandConfig - sanitizes custom brand inputs with leading #', () => {
  const custom = {
    colors: {
      primary: '#1E293B',
      accent: '#38BDF8'
    }
  };
  const brand = resolveBrandConfig(custom);
  assert.equal(brand.primary, '1E293B');
  assert.equal(brand.accent, '38BDF8');
});
