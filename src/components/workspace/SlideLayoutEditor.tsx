import { useMemo } from 'react';
import { parseMarkdownToSlides, SUPPORTED_LAYOUTS, chooseLayout } from '@/lib/pptxExport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layout, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SlideLayoutEditorProps {
  content: string;
  onChange: (newContent: string) => void;
}

export default function SlideLayoutEditor({ content, onChange }: SlideLayoutEditorProps) {
  const slides = useMemo(() => parseMarkdownToSlides(content), [content]);

  const handleLayoutChange = (index: number, newLayout: string) => {
    const lines = content.split('\n');
    let currentSlideIdx = -1;
    let newLines = [...lines];
    // Find the start line of the slide at index
    let startLine = -1;
    let isInSection = false;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        const h1Match = trimmed.match(/^#\s+/);
        const h2Match = trimmed.match(/^##\s+/);
        const slideMatch = trimmed.match(/^(?:#+\s*)?(?:\d+\.\s*)?Slide\s*\d*(?::|-)/i);
        const separator = trimmed === '---';
        
        if (h1Match || h2Match || slideMatch) {
            currentSlideIdx++;
            if (currentSlideIdx === index) {
                startLine = i;
                break;
            }
            isInSection = true;
        } else if (separator) {
            isInSection = false;
        } else if (trimmed.length > 0 && !isInSection) {
            currentSlideIdx++;
            if (currentSlideIdx === index) {
                startLine = i;
                break;
            }
            isInSection = true;
        }
    }

    if (startLine === -1) {
        // Fallback: if we only have one implicit slide (no header)
        if (index === 0 && slides.length > 0) {
            newLines.splice(0, 0, `**Layout: ${newLayout}**`);
            onChange(newLines.join('\n'));
        }
        return;
    }

    // Look for existing layout line in this slide block
    let layoutLineIdx = -1;
    for (let i = startLine + 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        // Stop if we hit next slide
        if (trimmed.match(/^#\s+/) || trimmed.match(/^##\s+/) || trimmed === '---' || trimmed.match(/^(?:#+\s*)?(?:\d+\.\s*)?Slide\s*\d*(?::|-)/i)) break;
        
        if (trimmed.match(/^\*\*\s*(?:Header|Layout)\s*[:\*]*\s*/i)) {
            layoutLineIdx = i;
            break;
        }
    }

    if (layoutLineIdx !== -1) {
        // Update existing line
        newLines[layoutLineIdx] = `**Layout: ${newLayout}**`;
    } else {
        // Insert new line after the slide title line
        newLines.splice(startLine + 1, 0, `**Layout: ${newLayout}**`);
    }

    onChange(newLines.join('\n'));
  };

  return (
    <ScrollArea className="h-full bg-background/50">
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
                <Layout className="w-6 h-6 text-primary" />
            </div>
            <div>
                <h2 className="text-2xl font-bold">Slide Layout Editor</h2>
                <p className="text-muted-foreground text-sm">
                    Customize visual layouts per slide. Overrides are saved directly in your markdown as <code>**Layout: X**</code>.
                </p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {slides.map((slide, idx) => {
            const currentLayout = slide.layoutHint || (idx === 0 ? 'title' : chooseLayout(slide));
            
            return (
              <Card key={`${idx}-${slide.title}`} className="overflow-hidden border-border/50 bg-card/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3 border-b border-white/5 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-background/50 px-2 py-0.5 rounded border border-border/30">
                      Slide {idx + 1}
                    </span>
                    {slide.layoutHint ? (
                      <span className="flex items-center gap-1 text-[10px] text-primary font-bold uppercase tracking-tighter">
                        <CheckCircle2 className="w-3 h-3 text-primary" />
                        Custom
                      </span>
                    ) : (
                        <span className="text-[10px] text-muted-foreground/50 font-bold uppercase tracking-tighter italic">
                            Auto-detected
                        </span>
                    )}
                  </div>
                  <CardTitle className="text-base truncate mt-2 font-semibold">{slide.title || "Untitled Slide"}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Visual Layout</label>
                    <Select value={currentLayout} onValueChange={(val) => handleLayoutChange(idx, val)}>
                      <SelectTrigger className="w-full h-9 text-xs bg-background/50 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LAYOUTS.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            <div className="flex flex-col items-start py-0.5">
                              <span className="font-semibold text-sm">{l.label}</span>
                              <span className="text-[10px] text-muted-foreground leading-tight">{l.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-muted/40 rounded-lg p-3 text-[10px] border border-white/5 min-h-[80px]">
                    <div className="font-bold mb-2 uppercase opacity-40 text-[9px] flex items-center gap-1">
                        <div className="w-1 h-3 bg-primary/40 rounded-full" />
                        Content Preview
                    </div>
                    {slide.bullets.length > 0 ? (
                      <ul className="list-disc ml-4 space-y-1 text-foreground/80">
                        {slide.bullets.slice(0, 3).map((b, i) => (
                          <li key={i} className="line-clamp-2">{b}</li>
                        ))}
                        {slide.bullets.length > 3 && <li className="opacity-50 italic">... and {slide.bullets.length - 3} more bullets</li>}
                      </ul>
                    ) : (
                      <p className="italic opacity-50 px-1">{slide.bodyText[0] || "No text content preview available."}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {slides.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50 space-y-4">
                <div className="p-6 bg-muted rounded-full">
                    <Layout className="w-12 h-12" />
                </div>
                <div>
                    <h3 className="text-xl font-semibold">No slides detected</h3>
                    <p>Add some # or ## headers to your document to create slides.</p>
                </div>
            </div>
        )}
      </div>
    </ScrollArea>
  );
}
