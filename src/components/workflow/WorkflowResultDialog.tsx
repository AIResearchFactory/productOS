import { Check, X, AlertTriangle, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorkflowRunRecord, StepResult } from '@/api/types';

interface WorkflowResultDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    execution: WorkflowRunRecord | null;
    workflowName: string;
    onOpenFile?: (fileName: string) => void;
}

function getStatusConfig(status: string) {
    switch (status) {
        case 'Completed':
            return {
                icon: <Check className="w-6 h-6" />,
                label: 'Completed Successfully',
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
                border: 'border-emerald-500/20',
            };
        case 'Failed':
            return {
                icon: <X className="w-6 h-6" />,
                label: 'Execution Failed',
                color: 'text-red-500',
                bg: 'bg-red-500/10',
                border: 'border-red-500/20',
            };
        case 'PartialSuccess':
            return {
                icon: <AlertTriangle className="w-6 h-6" />,
                label: 'Partially Completed',
                color: 'text-amber-500',
                bg: 'bg-amber-500/10',
                border: 'border-amber-500/20',
            };
        case 'Cancelled':
            return {
                icon: <AlertTriangle className="w-6 h-6" />,
                label: 'Execution Cancelled',
                color: 'text-muted-foreground',
                bg: 'bg-secondary',
                border: 'border-border',
            };
        default:
            return {
                icon: <AlertTriangle className="w-6 h-6" />,
                label: status,
                color: 'text-muted-foreground',
                bg: 'bg-secondary',
                border: 'border-border',
            };
    }
}

function getStepStatusIcon(status: string) {
    switch (status) {
        case 'Completed':
            return <Check className="w-4 h-4 text-emerald-500" />;
        case 'Failed':
            return <X className="w-4 h-4 text-red-500" />;
        case 'Skipped':
            return <AlertTriangle className="w-4 h-4 text-amber-500" />;
        default:
            return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground" />;
    }
}

function StepResultRow({ stepId, result, onOpenFile }: { stepId: string; result: StepResult; onOpenFile?: (f: string) => void }) {
    const [expanded, setExpanded] = useState(result.status === 'Failed');

    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <button
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                {getStepStatusIcon(result.status)}
                <span className="flex-1 text-sm font-medium truncate">{stepId}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${result.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                        result.status === 'Failed' ? 'bg-red-500/10 text-red-500' :
                            'bg-secondary text-muted-foreground'
                    }`}>
                    {result.status}
                </span>
                {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>

            {expanded && (
                <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border bg-secondary/30">
                    {/* Output files */}
                    {result.output_files && result.output_files.length > 0 && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Files Created</div>
                            <div className="space-y-1">
                                {result.output_files.map((file, i) => (
                                    <button
                                        key={i}
                                        className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenFile?.(file);
                                        }}
                                    >
                                        <FileText className="w-3 h-3" />
                                        {file}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {result.error && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-red-500 font-bold mb-1">Error</div>
                            <p className="text-xs text-red-400 bg-red-500/5 rounded px-2 py-1.5 font-mono break-all">{result.error}</p>
                        </div>
                    )}

                    {/* Logs */}
                    {result.logs && result.logs.length > 0 && (
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Logs</div>
                            <div className="text-[11px] text-muted-foreground font-mono bg-background rounded px-2 py-1.5 space-y-0.5 max-h-24 overflow-y-auto">
                                {result.logs.map((log, i) => (
                                    <div key={i}>{log}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function WorkflowResultDialog({ open, onOpenChange, execution, workflowName, onOpenFile }: WorkflowResultDialogProps) {
    if (!execution) return null;

    const statusConfig = getStatusConfig(execution.status);
    const stepEntries = Object.entries(execution.step_results || {});
    const completedSteps = stepEntries.filter(([, r]) => r.status === 'Completed').length;
    const failedSteps = stepEntries.filter(([, r]) => r.status === 'Failed').length;
    const allOutputFiles = stepEntries.flatMap(([, r]) => r.output_files || []);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${statusConfig.bg} ${statusConfig.color}`}>
                            {statusConfig.icon}
                        </div>
                        <div>
                            <div className="text-base">{workflowName}</div>
                            <div className={`text-sm font-normal ${statusConfig.color}`}>{statusConfig.label}</div>
                        </div>
                    </DialogTitle>
                    <DialogDescription>
                        {completedSteps}/{stepEntries.length} steps completed
                        {failedSteps > 0 && ` · ${failedSteps} failed`}
                        {allOutputFiles.length > 0 && ` · ${allOutputFiles.length} file${allOutputFiles.length > 1 ? 's' : ''} created`}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[50vh]">
                    <div className="space-y-2 pr-2">
                        {stepEntries.map(([stepId, result]) => (
                            <StepResultRow
                                key={stepId}
                                stepId={stepId}
                                result={result}
                                onOpenFile={onOpenFile}
                            />
                        ))}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

