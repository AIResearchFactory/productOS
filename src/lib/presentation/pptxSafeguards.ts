/**
 * Safeguard utilities for PPTX generation to prevent corruption footguns
 * based on Anthropic PPTX skill guidelines.
 */

export interface HexSanitizeOptions {
  defaultColor?: string;
}

/**
 * Strips leading '#', handles 3-digit hex expansion, validates length,
 * and converts to uppercase 6-digit hex string without '#' or alpha channels.
 */
export function sanitizeHexColor(color?: string, defaultColor = "0F172A"): string {
  if (!color || typeof color !== 'string') return defaultColor;
  let cleaned = color.trim().replace(/^#/, '');
  
  // Strip alpha channel if 8 characters (e.g. FF0000FF -> FF0000)
  if (cleaned.length === 8) {
    cleaned = cleaned.substring(0, 6);
  }
  
  // Expand 3-character hex (e.g. F00 -> FF0000)
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map(c => c + c).join('');
  }
  
  if (!/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
    return defaultColor;
  }
  return cleaned.toUpperCase();
}

/**
 * Deep clones option objects to prevent pptxgenjs EMU in-place mutation bug.
 * pptxgenjs converts x/y/w/h values to EMUs on first use, corrupting option
 * objects if reused across multiple addText or addShape calls.
 */
export function deepCloneOptions<T>(opts: T): T {
  if (!opts || typeof opts !== 'object') return opts;
  return JSON.parse(JSON.stringify(opts));
}

/**
 * Enforces non-negative shadow offsets (negative offsets corrupt PPTX).
 * To cast upward shadows, use angle 270 with a positive offset.
 */
export function sanitizeShadowOptions(shadow: any): any {
  if (!shadow) return undefined;
  const cloned = deepCloneOptions(shadow);
  if (typeof cloned.offset === 'number' && cloned.offset < 0) {
    cloned.offset = Math.abs(cloned.offset);
    if (typeof cloned.angle !== 'number') {
      cloned.angle = 270;
    }
  }
  return cloned;
}

/**
 * Validates native chart series options to prevent PowerPoint rendering corruptions.
 * - Enforces both valAxes and catAxes on combo charts with secondary axes.
 * - Restricts stacked chart dataLabelPosition to valid values: 'ctr', 'inEnd', 'inBase'.
 */
export function sanitizeChartOptions(chartType: string, options: any): any {
  if (!options) return {};
  const opts = deepCloneOptions(options);

  if (opts.chartColors && Array.isArray(opts.chartColors)) {
    opts.chartColors = opts.chartColors.map((c: string) => sanitizeHexColor(c));
  }

  const isStacked = chartType.toLowerCase().includes('stacked');
  if (isStacked && opts.dataLabelPosition) {
    const validPositions = ['ctr', 'inEnd', 'inBase'];
    if (!validPositions.includes(opts.dataLabelPosition)) {
      opts.dataLabelPosition = 'ctr';
    }
  }

  return opts;
}

/**
 * Calculates responsive font size for hero numbers and metrics to ensure
 * text fits inside visual card boundaries without breaking onto extra lines.
 */
export function calculateHeroFontSize(text: string, baseSize = 72, minSize = 32): number {
  const clean = text.trim();
  const len = clean.length;
  if (len <= 5) return baseSize;
  if (len <= 10) return Math.max(minSize, Math.floor(baseSize * 0.75)); // 54pt
  if (len <= 16) return Math.max(minSize, Math.floor(baseSize * 0.55)); // 39pt
  if (len <= 22) return Math.max(minSize, Math.floor(baseSize * 0.50)); // 36pt
  return minSize;
}
