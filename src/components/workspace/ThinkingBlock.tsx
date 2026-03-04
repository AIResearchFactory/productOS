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
        <div className="my-4 rounded-xl border border-white/10 bg-white/5 overflow-hidden transition-all duration-300 shadow-md">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/5 transition-colors text-left"
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
                <div className="px-4 pb-4 pt-2 border-t border-white/5 bg-black/10">
                    <div className="prose dark:prose-invert prose-xs max-w-none text-muted-foreground font-normal">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                        </ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
}
