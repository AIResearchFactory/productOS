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
import { Copy, Check, AlertTriangle } from 'lucide-react';

// ── Mermaid singleton init ──────────────────────────────────────────────────
let mermaidReady: Promise<typeof import('mermaid')> | null = null;

function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
        securityLevel: 'strict',
        fontFamily: 'Inter, system-ui, sans-serif',
      });
      return mod;
    });
  }
  return mermaidReady;
}

// Re-initialise theme when the user switches modes
function reinitTheme() {
  getMermaid().then((mod) => {
    mod.default.initialize({
      startOnLoad: false,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'Inter, system-ui, sans-serif',
    });
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
}

let renderCounter = 0;

function MermaidDiagramInner({ code, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderGenRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const render = useCallback(async () => {
    const gen = ++renderGenRef.current;

    if (!code.trim()) {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const mermaidMod = await getMermaid();
      const id = `mermaid-svg-${++renderCounter}`;
      const { svg } = await mermaidMod.default.render(id, code.trim());

      if (renderGenRef.current === gen) {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
        setError(null);
      }
    } catch (err: any) {
      if (renderGenRef.current === gen) {
        console.warn('[MermaidDiagram] Render failed:', err);
        setError(err?.message || 'Failed to render mermaid diagram');
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      }
    } finally {
      if (renderGenRef.current === gen) {
        setLoading(false);
      }
    }
  }, [code]);

  // Render on mount and when code changes
  useEffect(() => {
    render();
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
        className={`mermaid-svg-container flex items-center justify-center p-4 ${loading ? 'hidden' : ''}`}
        style={{ minHeight: error ? 0 : 60 }}
      />

      {/* Error fallback */}
      {error && (
        <div className="p-3">
          <div className="flex items-center gap-1.5 text-destructive text-xs font-medium mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Diagram syntax error
          </div>
          <pre className="text-[11px] leading-relaxed font-mono bg-muted/60 rounded p-3 overflow-x-auto whitespace-pre-wrap text-muted-foreground border border-border/30">
            {code}
          </pre>
          <div className="text-[10px] text-muted-foreground/60 mt-1.5 italic">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}

const MermaidDiagram = memo(MermaidDiagramInner);
export default MermaidDiagram;
