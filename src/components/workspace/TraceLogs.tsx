import { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { tauriApi } from '../../api/tauri';
import { Terminal, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogEntry {
    timestamp: Date;
    message: string;
}

export default function TraceLogs({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let unlisten: (() => void) | undefined;
        let isMounted = true;

        const setupListener = async () => {
            const cleanup = await tauriApi.onTraceLog((msg) => {
                if (isMounted) {
                    setLogs(prev => [...prev, { timestamp: new Date(), message: msg }]);
                }
            });

            if (isMounted) {
                unlisten = cleanup;
            } else {
                cleanup(); // Unlisten immediately if component unmounted while waiting
            }
        };

        setupListener();

        return () => {
            isMounted = false;
            if (unlisten) unlisten();
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [logs]);

    if (!isOpen) return null;

    return (
        <div className="h-64 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <Terminal className="w-3.5 h-3.5" />
                    Research Trace Logs
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setLogs([])}>
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
            <ScrollArea className="flex-1 p-2 font-mono text-[11px]" ref={scrollRef}>
                <div className="space-y-1">
                    {logs.length === 0 && (
                        <div className="text-gray-400 italic text-center py-4">No logs yet. Start a conversation to see trace data.</div>
                    )}
                    {logs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                            <span className="text-gray-400 shrink-0">[{log.timestamp.toLocaleTimeString()}]</span>
                            <span className="text-gray-700 dark:text-gray-300 break-words">{log.message}</span>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
