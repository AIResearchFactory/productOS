import { useEffect, useState } from 'react';
import { tauriApi, WorkflowRunRecord, ExecutionStatus, StepResult } from '@/api/tauri';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { 
    Clock, 
    CheckCircle2, 
    XCircle, 
    AlertCircle, 
    ChevronRight, 
    ChevronDown,
    Zap,
    History
} from 'lucide-react';

interface WorkflowHistoryPanelProps {
    projectId: string;
    workflowId: string;
    onClose: () => void;
}

const formatDate = (dateString: string, pattern: 'short' | 'time' = 'short') => {
    try {
        const date = new Date(dateString);
        if (pattern === 'time') {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateString;
    }
};

export default function WorkflowHistoryPanel({ projectId, workflowId, onClose }: WorkflowHistoryPanelProps) {
    const [history, setHistory] = useState<WorkflowRunRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

    useEffect(() => {
        loadHistory();

        let unlisten: (() => void) | undefined;
        const setupListener = async () => {
            unlisten = await tauriApi.listen('workflow-changed', (event) => {
                if (event.payload === projectId) {
                    loadHistory();
                }
            });
        };
        setupListener();

        return () => {
            if (unlisten) unlisten();
        };
    }, [projectId, workflowId]);

    const loadHistory = async () => {
        setIsLoading(true);
        try {
            const result = await tauriApi.getWorkflowHistory(projectId, workflowId);
            setHistory(result);
        } catch (error) {
            console.error('Failed to load workflow history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusIcon = (status: ExecutionStatus) => {
        switch (status) {
            case 'Completed':
                return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'Failed':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'PartialSuccess':
                return <AlertCircle className="w-4 h-4 text-amber-500" />;
            case 'Running':
                return <Zap className="w-4 h-4 text-blue-500 animate-pulse" />;
            default:
                return <Clock className="w-4 h-4 text-gray-400" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 w-80 shadow-xl">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-gray-500" />
                    <h3 className="font-semibold text-sm">Run History</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
            </div>

            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="p-8 text-center text-sm text-gray-500">Loading history...</div>
                ) : history.length === 0 ? (
                    <div className="p-8 text-center text-sm text-gray-500">No runs found for this workflow.</div>
                ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {history.map((run) => (
                            <div key={run.id} className="flex flex-col">
                                <button
                                    className="p-3 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-start gap-3"
                                    onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                                >
                                    <div className="mt-0.5">{getStatusIcon(run.status)}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                                {formatDate(run.started)}
                                            </span>
                                            <span className="text-[10px] text-gray-500 uppercase">{run.trigger}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-0.5 truncate uppercase">
                                            {run.status} {run.completed && `• ${formatDate(run.completed, 'time')}`}
                                        </div>
                                    </div>
                                    {expandedRunId === run.id ? (
                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                    ) : (
                                        <ChevronRight className="w-4 h-4 text-gray-400" />
                                    )}
                                </button>

                                {expandedRunId === run.id && (
                                    <div className="px-3 pb-3 space-y-2 bg-gray-50/50 dark:bg-gray-800/20">
                                        <div className="text-[10px] uppercase text-gray-400 font-semibold tracking-wider pt-2">Step Details</div>
                                        {Object.entries(run.step_results).map(([stepId, result]) => {
                                            const stepResult = result as StepResult;
                                            return (
                                                <div key={stepId} className="pl-2 border-l-2 border-gray-200 dark:border-gray-700 py-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{stepId}</span>
                                                        <span className={`text-[9px] px-1 rounded ${
                                                            stepResult.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                            stepResult.status === 'Failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                                        }`}>
                                                            {stepResult.status}
                                                        </span>
                                                    </div>
                                                    {stepResult.detailed_error && (
                                                        <div className="mt-1 p-1.5 bg-red-50 dark:bg-red-950/20 text-[10px] text-red-600 dark:text-red-400 rounded border border-red-100 dark:border-red-900/30 whitespace-pre-wrap">
                                                            {stepResult.detailed_error}
                                                        </div>
                                                    )}
                                                    {stepResult.output_files.length > 0 && (
                                                        <div className="mt-1 text-[9px] text-gray-500 truncate">
                                                            Out: {stepResult.output_files.join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
