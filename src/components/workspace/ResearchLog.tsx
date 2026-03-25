import { useState, useEffect } from 'react';
import { 
    Search,
    Trash2, 
    Download, 
    ChevronDown, 
    ChevronRight, 
    Clock, 
    Terminal,
    History as HistoryIcon,
    Bot,
    Sparkles
} from 'lucide-react';
import { tauriApi, ResearchLogEntry } from '../../api/tauri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ResearchLogProps {
    projectId: string;
    projectName: string;
}

export default function ResearchLog({ projectId, projectName }: ResearchLogProps) {
    const [logs, setLogs] = useState<ResearchLogEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const data = await tauriApi.getResearchLog(projectId);
            // Filter out empty calls like "()" or empty strings
            const validLogs = data.filter(log => {
                const content = log.content.trim();
                return content !== '' && content !== '()' && content !== '<thinking></thinking>';
            });
            setLogs(validLogs.reverse()); // Show newest first
        } catch (err) {
            console.error('Failed to load logs', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
        
        // Setup listener for file changes to refresh logs
        let unlisten: (() => void) | undefined;
        tauriApi.listen('file-changed', (event: any) => {
            const [pId, fileName] = event.payload;
            if (pId === projectId && fileName === 'research_log.md') {
                loadLogs();
            }
        }).then(cleanup => unlisten = cleanup);

        return () => {
            if (unlisten) unlisten();
        };
    }, [projectId]);

    const handleClear = async () => {
        if (confirm('Are you sure you want to clear the research log? This cannot be undone.')) {
            try {
                await tauriApi.clearResearchLog(projectId);
                setLogs([]);
            } catch (err) {
                console.error('Failed to clear log', err);
            }
        }
    };

    const handleExport = () => {
        const content = logs.map(log => {
            let entry = `---
### Interaction: ${log.timestamp}
**Provider**: ${log.provider}
`;
            if (log.command) entry += `**Command**: \`${log.command}\`\n`;
            entry += `\n#### Agent Output:\n\n${log.content}\n`;
            return entry;
        }).join('\n');

        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `research_log_${projectId}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const toggleExpand = (index: number) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedIds(newExpanded);
    };

    const filteredLogs = logs.filter(log => 
        log.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.command && log.command.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-950 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl">
                        <HistoryIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">
                            {projectName} project log timeline
                        </h2>
                    </div>
                </div>
                <div className="flex items-center gap-4 pr-10">
                    <Button variant="ghost" size="icon" onClick={handleExport} title="Export Log" className="hover:bg-gray-200 dark:hover:bg-gray-800">
                        <Download className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleClear} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" title="Clear Log">
                        <Trash2 className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-900">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                        placeholder="Filter log entries..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 bg-gray-50 dark:bg-gray-900 border-none focus-visible:ring-1 focus-visible:ring-primary/50 text-sm"
                    />
                </div>
            </div>

            {/* Timeline */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6 relative">
                    {/* Vertical Line */}
                    {/* Vertical Line */}
                    <div className="absolute left-[9.625rem] top-6 bottom-6 w-0.5 bg-gray-100 dark:bg-gray-800 pointer-none" />

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Clock className="w-10 h-10 animate-spin mb-4 opacity-20" />
                            <p className="text-sm">Loading research history...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <HistoryIcon className="w-12 h-12 mb-4 opacity-10" />
                            <p className="text-base font-medium">No log entries found.</p>
                        </div>
                    ) : (
                        filteredLogs.map((log, idx) => {
                            const isExpanded = expandedIds.has(idx);
                            const interactionDate = new Date(log.timestamp);
                            
                            // Format: Mar 16 on left, 17:08:43 under name
                            const dateLabel = interactionDate.getTime() ? format(interactionDate, 'MMM d') : '';
                            const timeLabel = interactionDate.getTime() ? format(interactionDate, 'HH:mm:ss') : log.timestamp;

                            const isClaude = log.provider.toLowerCase().includes('claude');
                            const isGemini = log.provider.toLowerCase().includes('gemini');

                            return (
                                <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="relative flex gap-10 group"
                                >
                                    {/* Date Column (Left side) */}
                                    <div className="w-24 shrink-0 text-right pt-2">
                                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                            {dateLabel}
                                        </span>
                                    </div>

                                    {/* Icon Column (Center) */}
                                    <div className="relative z-10 flex flex-col items-center pt-1.5">
                                        <div className={`
                                            w-9 h-9 rounded-xl flex items-center justify-center shadow-md border-2 transition-transform group-hover:scale-110
                                            ${isClaude ? 'bg-orange-500/10 border-orange-500/30 text-orange-500' : 
                                              isGemini ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 
                                              'bg-primary/10 border-primary/30 text-primary'}
                                        `}>
                                            {isClaude || isGemini ? <Sparkles className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                                        </div>
                                    </div>

                                    {/* Content Column (Right side) */}
                                    <div className="flex-1 pb-4">
                                        <div className="mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-extrabold text-foreground uppercase tracking-tight">
                                                    {log.provider}
                                                </span>
                                                {log.command && (
                                                    <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-500">
                                                        {log.command.split(' ')[0]}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">
                                                {timeLabel}
                                            </div>
                                        </div>

                                        <div 
                                            className={`
                                                relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm 
                                                hover:border-primary/30 hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer
                                                ${isExpanded ? 'ring-1 ring-primary/20' : ''}
                                            `}
                                            onClick={() => toggleExpand(idx)}
                                        >
                                            <div className="p-4 flex items-start justify-between gap-4">
                                                <div className="flex-1 overflow-hidden">
                                                    {log.command && (
                                                        <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 font-mono mb-2">
                                                            <Terminal className="w-3.5 h-3.5 text-primary/60" />
                                                            <span className="truncate">{log.command}</span>
                                                        </div>
                                                    )}
                                                    <p className={`text-sm leading-relaxed text-gray-600 dark:text-gray-400 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                                        {log.content}
                                                    </p>
                                                </div>
                                                <div className="px-1 pt-1 shrink-0">
                                                    {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                    >
                                                        <Separator className="opacity-50" />
                                                        <div className="p-4 bg-gray-50/50 dark:bg-gray-950/50">
                                                            <pre className="text-sm font-mono leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words selection:bg-primary/20">
                                                                {log.content}
                                                            </pre>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
