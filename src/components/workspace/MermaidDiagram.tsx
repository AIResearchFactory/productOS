/**
 * MermaidDiagram.tsx
 * Shared component that renders mermaid source code as an SVG diagram.
 *
 * Used in:
 *  - RichMarkdownEditor (Tiptap NodeView for code blocks with language=mermaid)
 *  - ChatPanel (ReactMarkdown code component override)
 *
 * Features:
 *  - Lazy-initialises mermaid once (singleton)
 *  - Renders to SVG via mermaid.render()
 *  - Falls back to raw code + error banner on parse failure
 *  - Respects dark/light theme
 *  - Click-to-copy source
 */

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Copy, Check } from 'lucide-react';

// ── Mermaid singleton init ──────────────────────────────────────────────────
let mermaidReady: Promise<typeof import('mermaid')> | null = null;

function getMermaidConfig() {
  return {
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: (document.documentElement.classList.contains('dark') ? 'dark' : 'default') as 'dark' | 'default',
    securityLevel: 'strict' as const,
    fontFamily: 'Inter, system-ui, sans-serif',
  };
}

function cleanupStrayMermaidNodes(id?: string) {
  if (typeof document === 'undefined') return;
  if (id) {
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
  }
  document
    .querySelectorAll('body > [id^="mermaid-svg-"], body > [id^="dmermaid-svg-"]')
    .forEach((node) => node.remove());
}

function isMermaidErrorSvg(svg: string): boolean {
  return (
    svg.includes('aria-roledescription="error"') ||
    svg.includes('class="error-icon"') ||
    svg.includes('Syntax error in text')
  );
}

function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize(getMermaidConfig());
      cleanupStrayMermaidNodes();
      return mod;
    });
  }
  return mermaidReady;
}

// Re-initialise theme when the user switches modes
function reinitTheme() {
  getMermaid().then((mod) => {
    mod.default.initialize(getMermaidConfig());
  });
}

// ── Component ───────────────────────────────────────────────────────────────

interface MermaidDiagramProps {
  /** Raw mermaid source (the text inside the fenced code block). */
  code: string;
  /** Optional extra className for the wrapper div. */
  className?: string;
  /** Optional flag for parent detection (e.g. react-markdown pre wrapper) */
  isMermaid?: boolean;
  /** Whether to display the raw code block when diagram parsing/rendering fails (default: true). */
  showCodeOnError?: boolean;
}

let renderCounter = 0;

function MermaidDiagramInner({ code, className, showCodeOnError = true }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderGenRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const render = useCallback(async () => {
    const gen = ++renderGenRef.current;
    const trimmed = code.trim();

    if (!trimmed) {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const id = `mermaid-svg-${++renderCounter}`;
    try {
      const mermaidMod = await getMermaid();
      const mermaid = mermaidMod.default;

      // Validate first with suppressErrors so Mermaid does not inject error DOM nodes into document.body
      const isValid = await mermaid.parse(trimmed, { suppressErrors: true });
      if (!isValid) {
        throw new Error('Unsupported or invalid Mermaid diagram syntax');
      }

      const { svg } = await mermaid.render(id, trimmed);
      cleanupStrayMermaidNodes(id);

      if (isMermaidErrorSvg(svg)) {
        throw new Error('Unsupported or invalid Mermaid diagram syntax');
      }

      if (renderGenRef.current === gen) {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        setError(null);
      }
    } catch (err: any) {
      cleanupStrayMermaidNodes(id);
      if (renderGenRef.current === gen) {
        setError(err?.message || 'Unsupported or invalid Mermaid diagram');
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      }
    } finally {
      cleanupStrayMermaidNodes(id);
      if (renderGenRef.current === gen) {
        setLoading(false);
      }
    }
  }, [code]);

  // Render on mount and when code changes
  useEffect(() => {
    render();
    return () => {
      cleanupStrayMermaidNodes();
    };
  }, [render]);

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      reinitTheme();
      render();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, [render]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  // In editor mode (showCodeOnError === false), the editable code block is rendered directly below,
  // so hide the preview container completely when the diagram is unsupported or has a syntax error.
  if (error && !showCodeOnError) {
    return null;
  }

  return (
    <div
      className={`mermaid-diagram-wrapper relative group rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden my-2 ${className || ''}`}
    >
      {/* Copy button (top-right, on hover and focus-visible) */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-opacity p-1.5 rounded-md bg-muted/80 hover:bg-muted border border-border/50 text-muted-foreground hover:text-foreground"
        title="Copy mermaid source"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
      </button>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center p-8 text-muted-foreground text-xs gap-2">
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Rendering diagram…
        </div>
      )}

      {/* SVG container */}
      <div
        ref={containerRef}
        className={`mermaid-svg-container flex items-center justify-center p-4 ${loading || error ? 'hidden' : ''}`}
        style={{ minHeight: error ? 0 : 60 }}
      />

      {/* Fallback when diagram is unsupported or invalid */}
      {error && showCodeOnError && (
        <pre className="text-[11px] leading-relaxed font-mono bg-muted/60 p-3 overflow-x-auto whitespace-pre-wrap text-foreground">
          {code}
        </pre>
      )}
    </div>
  );
}

const MermaidDiagram = memo(MermaidDiagramInner);
export default MermaidDiagram;
