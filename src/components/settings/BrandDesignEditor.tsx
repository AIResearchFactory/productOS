import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
    Palette, Type, Code2, Layout, Sparkles, Check, RefreshCw 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BrandConfig {
  brand_name?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    card_bg?: string;
    text?: string;
  };
  typography?: {
    heading_font?: string;
    body_font?: string;
  };
  logo?: {
    data?: string;
    filename?: string;
    mimeType?: string;
    position?: string;
  };
}

const DEFAULT_BRAND_CONFIG: BrandConfig = {
  brand_name: '',
  colors: {
    primary: '#0F172A',
    secondary: '#2563EB',
    accent: '#F59E0B',
    background: '#FFFFFF',
    card_bg: '#F8FAFC',
    text: '#0F172A',
  },
  typography: {
    heading_font: 'Montserrat',
    body_font: 'Inter',
  },
};

const COLOR_PRESETS = [
  {
    name: 'Modern Tech',
    colors: {
      primary: '#0F172A',
      secondary: '#2563EB',
      accent: '#F59E0B',
      background: '#FFFFFF',
      card_bg: '#F8FAFC',
      text: '#0F172A',
    },
  },
  {
    name: 'Royal Indigo',
    colors: {
      primary: '#1E1B4B',
      secondary: '#6366F1',
      accent: '#EC4899',
      background: '#FAFAFA',
      card_bg: '#F4F4F5',
      text: '#18181B',
    },
  },
  {
    name: 'Emerald Innovation',
    colors: {
      primary: '#064E3B',
      secondary: '#10B981',
      accent: '#F59E0B',
      background: '#FFFFFF',
      card_bg: '#ECFDF5',
      text: '#064E3B',
    },
  },
  {
    name: 'Executive Dark',
    colors: {
      primary: '#090D16',
      secondary: '#38BDF8',
      accent: '#818CF8',
      background: '#0F172A',
      card_bg: '#1E293B',
      text: '#F8FAFC',
    },
  },
  {
    name: 'Warm Coral',
    colors: {
      primary: '#431407',
      secondary: '#F97316',
      accent: '#14B8A6',
      background: '#FFFBEB',
      card_bg: '#FEF3C7',
      text: '#292524',
    },
  },
];

const FONT_OPTIONS_HEADING = [
  'IBM Plex Sans',
  'IBM Plex Mono',
  'IBM Plex Serif',
  'Montserrat',
  'Inter',
  'Roboto',
  'Playfair Display',
  'Outfit',
  'Georgia',
  'Arial',
  'Calibri',
  'Helvetica',
  'Fira Code',
];

const FONT_OPTIONS_BODY = [
  'IBM Plex Sans',
  'IBM Plex Mono',
  'Inter',
  'Open Sans',
  'Roboto',
  'Lato',
  'System UI',
  'Calibri',
  'Helvetica',
  'Fira Code',
];

interface BrandDesignEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function BrandDesignEditor({ value, onChange }: BrandDesignEditorProps) {
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');
  const [brandConfig, setBrandConfig] = useState<BrandConfig>(() => parseJson(value));
  const [jsonString, setJsonString] = useState<string>(value);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [customHeadingMode, setCustomHeadingMode] = useState(false);
  const [customBodyMode, setCustomBodyMode] = useState(false);

  function parseJson(raw: string): BrandConfig {
    if (!raw || !raw.trim()) {
      return DEFAULT_BRAND_CONFIG;
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        brand_name: parsed.brand_name || '',
        colors: { ...DEFAULT_BRAND_CONFIG.colors, ...parsed.colors },
        typography: { ...DEFAULT_BRAND_CONFIG.typography, ...parsed.typography },
      };
    } catch {
      return DEFAULT_BRAND_CONFIG;
    }
  }

  // Keep internal state updated when external prop changes
  useEffect(() => {
    setJsonString(value);
    const parsed = parseJson(value);
    setBrandConfig(parsed);
  }, [value]);

  const updateConfig = (newConfig: BrandConfig) => {
    setBrandConfig(newConfig);
    const formatted = JSON.stringify(newConfig, null, 2);
    setJsonString(formatted);
    setJsonError(null);
    onChange(formatted);
  };

  const handleColorChange = (key: keyof NonNullable<BrandConfig['colors']>, colorVal: string) => {
    const nextConfig: BrandConfig = {
      ...brandConfig,
      colors: {
        ...DEFAULT_BRAND_CONFIG.colors,
        ...brandConfig.colors,
        [key]: colorVal,
      },
    };
    updateConfig(nextConfig);
  };

  const handlePresetSelect = (presetColors: NonNullable<BrandConfig['colors']>) => {
    const nextConfig: BrandConfig = {
      ...brandConfig,
      colors: { ...presetColors },
    };
    updateConfig(nextConfig);
  };

  const handleFontChange = (type: 'heading_font' | 'body_font', fontName: string) => {
    const nextConfig: BrandConfig = {
      ...brandConfig,
      typography: {
        ...DEFAULT_BRAND_CONFIG.typography,
        ...brandConfig.typography,
        [type]: fontName,
      },
    };
    updateConfig(nextConfig);
  };

  const handleBrandNameChange = (name: string) => {
    const nextConfig: BrandConfig = {
      ...brandConfig,
      brand_name: name,
    };
    updateConfig(nextConfig);
  };

  const handleJsonTextChange = (raw: string) => {
    setJsonString(raw);
    try {
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        setBrandConfig({
          brand_name: parsed.brand_name || '',
          colors: { ...DEFAULT_BRAND_CONFIG.colors, ...parsed.colors },
          typography: { ...DEFAULT_BRAND_CONFIG.typography, ...parsed.typography },
        });
      }
      setJsonError(null);
      onChange(raw);
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON format');
      onChange(raw); // preserve draft text
    }
  };

  const colors = brandConfig.colors || DEFAULT_BRAND_CONFIG.colors!;
  const typography = brandConfig.typography || DEFAULT_BRAND_CONFIG.typography!;

  return (
    <div className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Top Header & Editor Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            <h4 className="font-semibold text-base text-foreground">Brand Design System (Presentation Mode)</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-prose">
            Configure visual styling, brand colors, and typography used across exported presentation slide decks.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 border border-border shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setEditorMode('visual')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              editorMode === 'visual'
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layout className="w-3.5 h-3.5" />
            Visual Editor
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('json')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              editorMode === 'json'
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Code2 className="w-3.5 h-3.5" />
            Raw JSON
          </button>
        </div>
      </div>

      {editorMode === 'visual' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Controls Column */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Brand Name Input */}
            <div className="space-y-2">
              <Label htmlFor="brand-name-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Brand / Organization Name
              </Label>
              <Input
                id="brand-name-input"
                value={brandConfig.brand_name || ''}
                onChange={(e) => handleBrandNameChange(e.target.value)}
                placeholder="e.g. ProductOS / Acme Corp"
                className="bg-background"
              />
            </div>

            {/* Color Palette Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Modern Color Presets
                </Label>
                <button
                  type="button"
                  onClick={() => updateConfig(DEFAULT_BRAND_CONFIG)}
                  className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Reset Default
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => {
                  const isActive = colors.primary === preset.colors.primary && colors.secondary === preset.colors.secondary;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handlePresetSelect(preset.colors)}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer",
                        isActive
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border hover:border-primary/50 bg-background text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center -space-x-1">
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.colors.primary }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.colors.secondary }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.colors.accent }} />
                      </div>
                      <span>{preset.name}</span>
                      {isActive && <Check className="w-3 h-3 text-primary ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Pickers */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Brand Palette Customization
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                
                {/* Primary Color */}
                <div className="space-y-1.5 p-2.5 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Primary</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{colors.primary}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.primary || '#0F172A'}
                      onChange={(e) => handleColorChange('primary', e.target.value)}
                      className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent"
                    />
                    <Input
                      value={colors.primary || ''}
                      onChange={(e) => handleColorChange('primary', e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Secondary Color */}
                <div className="space-y-1.5 p-2.5 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Secondary</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{colors.secondary}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.secondary || '#2563EB'}
                      onChange={(e) => handleColorChange('secondary', e.target.value)}
                      className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent"
                    />
                    <Input
                      value={colors.secondary || ''}
                      onChange={(e) => handleColorChange('secondary', e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div className="space-y-1.5 p-2.5 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Accent</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{colors.accent}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.accent || '#F59E0B'}
                      onChange={(e) => handleColorChange('accent', e.target.value)}
                      className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent"
                    />
                    <Input
                      value={colors.accent || ''}
                      onChange={(e) => handleColorChange('accent', e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Background Color */}
                <div className="space-y-1.5 p-2.5 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Background</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{colors.background}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.background || '#FFFFFF'}
                      onChange={(e) => handleColorChange('background', e.target.value)}
                      className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent"
                    />
                    <Input
                      value={colors.background || ''}
                      onChange={(e) => handleColorChange('background', e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Card Background Color */}
                <div className="space-y-1.5 p-2.5 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Card BG</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{colors.card_bg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.card_bg || '#F8FAFC'}
                      onChange={(e) => handleColorChange('card_bg', e.target.value)}
                      className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent"
                    />
                    <Input
                      value={colors.card_bg || ''}
                      onChange={(e) => handleColorChange('card_bg', e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Text Color */}
                <div className="space-y-1.5 p-2.5 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Text</span>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{colors.text}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colors.text || '#0F172A'}
                      onChange={(e) => handleColorChange('text', e.target.value)}
                      className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent"
                    />
                    <Input
                      value={colors.text || ''}
                      onChange={(e) => handleColorChange('text', e.target.value)}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Typography Controls */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-primary" />
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Presentation Typography
                </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Heading Font Selector / Custom Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="heading-font-select" className="text-xs font-medium">Heading Font</Label>
                    <button
                      type="button"
                      onClick={() => setCustomHeadingMode(!customHeadingMode)}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      {customHeadingMode ? 'Choose preset' : 'Type custom font...'}
                    </button>
                  </div>
                  {customHeadingMode ? (
                    <Input
                      id="heading-font-custom"
                      value={typography.heading_font || ''}
                      onChange={(e) => handleFontChange('heading_font', e.target.value)}
                      placeholder="e.g. IBM Plex Sans"
                      className="h-9 text-xs bg-background"
                    />
                  ) : (
                    <select
                      id="heading-font-select"
                      value={typography.heading_font || 'Montserrat'}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setCustomHeadingMode(true);
                        } else {
                          handleFontChange('heading_font', e.target.value);
                        }
                      }}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      {Array.from(new Set([
                        ...(typography.heading_font ? [typography.heading_font] : []),
                        ...FONT_OPTIONS_HEADING
                      ])).map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                      <option value="__custom__">+ Enter custom font name...</option>
                    </select>
                  )}
                </div>

                {/* Body Font Selector / Custom Input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="body-font-select" className="text-xs font-medium">Body Font</Label>
                    <button
                      type="button"
                      onClick={() => setCustomBodyMode(!customBodyMode)}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      {customBodyMode ? 'Choose preset' : 'Type custom font...'}
                    </button>
                  </div>
                  {customBodyMode ? (
                    <Input
                      id="body-font-custom"
                      value={typography.body_font || ''}
                      onChange={(e) => handleFontChange('body_font', e.target.value)}
                      placeholder="e.g. IBM Plex Sans"
                      className="h-9 text-xs bg-background"
                    />
                  ) : (
                    <select
                      id="body-font-select"
                      value={typography.body_font || 'Inter'}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setCustomBodyMode(true);
                        } else {
                          handleFontChange('body_font', e.target.value);
                        }
                      }}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                    >
                      {Array.from(new Set([
                        ...(typography.body_font ? [typography.body_font] : []),
                        ...FONT_OPTIONS_BODY
                      ])).map(font => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                      <option value="__custom__">+ Enter custom font name...</option>
                    </select>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Live Presentation Slide Preview Card */}
          <div className="lg:col-span-5 flex flex-col space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Live Slide Deck Preview
            </Label>
            
            <div
              className="flex-1 min-h-[300px] rounded-xl p-5 border border-black/10 shadow-lg flex flex-col justify-between transition-all duration-300 relative overflow-hidden"
              style={{
                backgroundColor: colors.background || '#FFFFFF',
                color: colors.text || '#0F172A',
                fontFamily: typography.body_font || 'sans-serif',
              }}
            >
              {/* Top Decorative Header Line */}
              <div 
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: colors.secondary || '#2563EB' }}
              />

              <div className="space-y-4 pt-2">
                {/* Brand Name / Badge & Logo */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {brandConfig.logo?.data && (
                      <img
                        src={brandConfig.logo.data}
                        alt="Brand Logo"
                        className="h-6 max-w-[80px] object-contain rounded"
                      />
                    )}
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${colors.secondary}1A` || '#2563EB1A',
                        color: colors.secondary || '#2563EB',
                      }}
                    >
                      {brandConfig.brand_name || 'BRAND PREVIEW'}
                    </span>
                  </div>
                  <span 
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: colors.accent || '#F59E0B' }}
                  />
                </div>

                {/* Slide Title */}
                <h3
                  className="text-xl font-bold tracking-tight leading-snug"
                  style={{
                    fontFamily: typography.heading_font || 'sans-serif',
                    color: colors.primary || '#0F172A',
                  }}
                >
                  Executive Product Roadmap Overview
                </h3>

                {/* Sample Card */}
                <div
                  className="p-3.5 rounded-lg border border-black/5 shadow-xs space-y-1.5"
                  style={{ backgroundColor: colors.card_bg || '#F8FAFC' }}
                >
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-xs font-semibold"
                      style={{ color: colors.primary || '#0F172A' }}
                    >
                      Strategic Milestone Phase 1
                    </span>
                    <span 
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: colors.accent || '#F59E0B',
                        color: '#FFFFFF',
                      }}
                    >
                      HIGH PRIORITY
                    </span>
                  </div>
                  <p className="text-xs opacity-80 leading-relaxed">
                    AI-driven contextual analysis materializes high-converting artifact decks aligned with defined brand rules.
                  </p>
                </div>
              </div>

              {/* Bottom Footer Accent */}
              <div className="pt-4 border-t border-black/10 flex items-center justify-between text-[11px] opacity-70">
                <span>Slide 01 / ProductOS</span>
                <div 
                  className="px-3 py-1 rounded-md font-medium text-xs text-white"
                  style={{ backgroundColor: colors.primary || '#0F172A' }}
                >
                  Export Ready
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Raw JSON Editor View */
        <div className="space-y-3">
          <Textarea
            value={jsonString}
            onChange={(e) => handleJsonTextChange(e.target.value)}
            className="font-mono text-xs min-h-[260px] bg-background"
            placeholder={'{\n  "brand_name": "Acme",\n  "colors": {\n    "primary": "#0F172A"\n  }\n}'}
          />
          {jsonError && (
            <p className="text-xs text-destructive font-mono bg-destructive/10 p-2 rounded-md">
              ⚠ {jsonError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Directly modify brand JSON configuration. Visual form controls and live slide preview sync automatically when valid JSON is entered.
          </p>
        </div>
      )}
    </div>
  );
}
