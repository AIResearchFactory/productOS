import { useState, useEffect } from 'react';
import { 
    Activity, 
    Search, 
    Trash2, 
    Download, 
    ChevronDown, 
    ChevronRight, 
    Clock, 
    Box, 
    Terminal,
    History
} from 'lucide-react';
import { tauriApi, ResearchLogEntry } from '../../api/tauri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ResearchLogProps {
    projectId: string;
}

export default function ResearchLog({ projectId }: ResearchLogProps) {
    const [logs, setLogs] = useState<ResearchLogEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    const loadLogs = async () => {
        setIsLoading(true);
        try {
            const data = await tauriApi.getResearchLog(projectId);
            setLogs(data.reverse()); // Show newest first
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
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tighter">Research Log Timeline</h2>
                        <p className="text-[10px] text-gray-500 font-mono tracking-tight">Project: {projectId}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleExport} title="Export Log">
                        <Download className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleClear} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" title="Clear Log">
                        <Trash2 className="w-4 h-4" />
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
                        className="pl-9 h-9 bg-gray-50 dark:bg-gray-900 border-none focus-visible:ring-1 focus-visible:ring-primary/50 text-xs"
                    />
                </div>
            </div>

            {/* Timeline */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6 relative">
                    {/* Vertical Line */}
                    <div className="absolute left-[2.25rem] top-6 bottom-6 w-0.5 bg-gradient-to-b from-primary/50 via-gray-200 dark:via-gray-800 to-transparent pointer-none" />

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <Clock className="w-8 h-8 animate-spin mb-2 opacity-20" />
                            <p className="text-xs">Loading research history...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <History className="w-10 h-10 mb-2 opacity-10" />
                            <p className="text-sm">No log entries found.</p>
                        </div>
                    ) : (
                        filteredLogs.map((log, idx) => {
                            const isExpanded = expandedIds.has(idx);
                            const interactionDate = new Date(log.timestamp);
                            const formattedDate = interactionDate.getTime() ? format(interactionDate, 'MMM d, HH:mm:ss') : log.timestamp;

                            return (
                                <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="relative flex gap-6"
                                >
                                    {/* Icon Column */}
                                    <div className="relative z-10 flex flex-col items-center">
                                        <div className={`
                                            w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2
                                            ${log.provider.includes('claude') ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 
                                              log.provider.includes('gemini') ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' : 
                                              'bg-primary/10 border-primary/20 text-primary'}
                                        `}>
                                            <Box className="w-4 h-4" />
                                        </div>
                                    </div>

                                    {/* Content Column */}
                                    <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                                        <div 
                                            className="p-3 cursor-pointer select-none flex items-center justify-between gap-3 group"
                                            onClick={() => toggleExpand(idx)}
                                        >
                                            <div className="flex flex-col gap-1 overflow-hidden">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider py-0 h-4 bg-gray-50/50 dark:bg-gray-800/50">
                                                        {log.provider}
                                                    </Badge>
                                                    <span className="text-[10px] text-gray-500 font-mono italic">
                                                        {formattedDate}
                                                    </span>
                                                </div>
                                                {log.command && (
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
                                                        <Terminal className="w-3 h-3 text-gray-400 group-hover:text-primary transition-colors" />
                                                        <span className="truncate">{log.command}</span>
                                                    </div>
                                                )}
                                                {!log.command && (
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                                                        {log.content}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
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
                                                    <div className="p-3 bg-gray-50/30 dark:bg-gray-950/30">
                                                        <pre className="text-[11px] font-mono leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words selection:bg-primary/20">
                                                            {log.content}
                                                        </pre>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
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
