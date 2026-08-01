import { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ThinkingBlockProps {
    content: string;
}

export default function ThinkingBlock({ content }: ThinkingBlockProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Extract title: look for **text**
    const titleMatch = content.match(/\*\*(.*?)\*\*/);
    const title = titleMatch ? titleMatch[1] : 'Thinking Process';

    // The rest of the content after the title if we want to hide the title from the body?
    // Actually, usually it's better to show the whole thing when expanded.

    return (
        <div className="my-4 rounded border border-border bg-muted/30 overflow-hidden transition-all duration-200">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors text-left"
            >
                <div className="p-1 rounded-md bg-amber-500/10 text-amber-500">
                    <Brain className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 flex items-center gap-2 overflow-hidden">
                    <span className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider shrink-0">Thought Process:</span>
                    <span className="text-xs font-semibold text-foreground/80 truncate">{title}</span>
                </div>
                {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/10 w-full min-w-0 max-w-full overflow-hidden">
                    <div className="prose dark:prose-invert prose-xs max-w-none w-full min-w-0 break-words [overflow-wrap:anywhere] [word-break:break-word] text-muted-foreground font-normal">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed break-words [overflow-wrap:anywhere] max-w-full">{children}</p>,
                                ul: ({ children }: any) => <ul className="list-disc pl-5 my-2 space-y-1 max-w-full break-words [overflow-wrap:anywhere]">{children}</ul>,
                                ol: ({ children }: any) => <ol className="list-decimal pl-5 my-2 space-y-1 max-w-full break-words [overflow-wrap:anywhere]">{children}</ol>,
                                li: ({ children }: any) => <li className="leading-relaxed break-words [overflow-wrap:anywhere] max-w-full">{children}</li>,
                                pre: ({ children }: any) => (
                                    <div className="my-2 max-w-full overflow-x-auto rounded bg-muted/60 p-2.5 text-xs border border-border/50">
                                        <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{children}</pre>
                                    </div>
                                ),
                                hr: () => <hr className="my-3 border-t border-border/60 max-w-full" />
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
}
