/**
 * Brand System definition for ProductOS Presentations.
 * Defaults to a modern dark slate theme with high contrast typography and vibrant cyan accents.
 */

import { sanitizeHexColor } from './pptxSafeguards.ts';

export interface ProjectBrandConfig {
  colors?: {
    primary?: string;         // Default: Slate Dark (0F172A)
    secondary?: string;       // Default: Emerald (10B981)
    accent?: string;          // Default: Cyan (06B6D4)
    backgroundDark?: string;  // Default: Dark Navy/Slate (0F172A)
    backgroundLight?: string; // Default: Off-White / Pale Slate (F8FAFC)
    textPrimary?: string;     // Default: Light text for dark cards (F8FAFC)
    cardBg?: string;          // Default: Card Slate (1E293B)
  };
  typography?: {
    headingFont?: string;     // Default: Inter
    bodyFont?: string;        // Default: Inter
  };
  logoUrl?: string;
  style?: {
    cardRadius?: 'none' | 'sm' | 'md' | 'lg';
    accentStyle?: 'top-bar' | 'left-stripe' | 'card-border' | 'minimal';
  };
}

export const DEFAULT_MODERN_DARK_BRAND: Required<ProjectBrandConfig> = {
  colors: {
    primary: "0F172A",         // Slate 900
    secondary: "10B981",       // Emerald 500
    accent: "06B6D4",          // Cyan 500
    backgroundDark: "0F172A",  // Slate Dark
    backgroundLight: "F8FAFC", // Slate 50
    textPrimary: "F8FAFC",     // Light text
    cardBg: "1E293B"           // Slate 800
  },
  typography: {
    headingFont: "Inter",
    bodyFont: "Inter"
  },
  logoUrl: "",
  style: {
    cardRadius: "md",
    accentStyle: "card-border"
  }
};

/**
 * Merges given brand settings with Modern Dark defaults and sanitizes all color hex strings.
 */
export function resolveBrandConfig(customBrand?: ProjectBrandConfig): {
  primary: string;
  secondary: string;
  accent: string;
  backgroundDark: string;
  backgroundLight: string;
  textPrimary: string;
  cardBg: string;
  headingFont: string;
  bodyFont: string;
  logoUrl: string;
  cardRadius: string;
  accentStyle: string;
} {
  const merged = {
    primary: customBrand?.colors?.primary || DEFAULT_MODERN_DARK_BRAND.colors.primary,
    secondary: customBrand?.colors?.secondary || DEFAULT_MODERN_DARK_BRAND.colors.secondary,
    accent: customBrand?.colors?.accent || DEFAULT_MODERN_DARK_BRAND.colors.accent,
    backgroundDark: customBrand?.colors?.backgroundDark || DEFAULT_MODERN_DARK_BRAND.colors.backgroundDark,
    backgroundLight: customBrand?.colors?.backgroundLight || DEFAULT_MODERN_DARK_BRAND.colors.backgroundLight,
    textPrimary: customBrand?.colors?.textPrimary || DEFAULT_MODERN_DARK_BRAND.colors.textPrimary,
    cardBg: customBrand?.colors?.cardBg || DEFAULT_MODERN_DARK_BRAND.colors.cardBg,
    headingFont: customBrand?.typography?.headingFont || DEFAULT_MODERN_DARK_BRAND.typography.headingFont,
    bodyFont: customBrand?.typography?.bodyFont || DEFAULT_MODERN_DARK_BRAND.typography.bodyFont,
    logoUrl: customBrand?.logoUrl || "",
    cardRadius: customBrand?.style?.cardRadius || DEFAULT_MODERN_DARK_BRAND.style.cardRadius,
    accentStyle: customBrand?.style?.accentStyle || DEFAULT_MODERN_DARK_BRAND.style.accentStyle
  };

  return {
    primary: sanitizeHexColor(merged.primary, DEFAULT_MODERN_DARK_BRAND.colors.primary),
    secondary: sanitizeHexColor(merged.secondary, DEFAULT_MODERN_DARK_BRAND.colors.secondary),
    accent: sanitizeHexColor(merged.accent, DEFAULT_MODERN_DARK_BRAND.colors.accent),
    backgroundDark: sanitizeHexColor(merged.backgroundDark, DEFAULT_MODERN_DARK_BRAND.colors.backgroundDark),
    backgroundLight: sanitizeHexColor(merged.backgroundLight, DEFAULT_MODERN_DARK_BRAND.colors.backgroundLight),
    textPrimary: sanitizeHexColor(merged.textPrimary, DEFAULT_MODERN_DARK_BRAND.colors.textPrimary),
    cardBg: sanitizeHexColor(merged.cardBg, DEFAULT_MODERN_DARK_BRAND.colors.cardBg),
    headingFont: merged.headingFont,
    bodyFont: merged.bodyFont,
    logoUrl: merged.logoUrl,
    cardRadius: merged.cardRadius,
    accentStyle: merged.accentStyle
  };
}
