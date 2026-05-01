import { Plus, Activity, Play, Clock3, Pencil, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { appApi } from '@/api/app';
import type { Workflow as WorkflowType, WorkflowExecution } from '@/api/app';
import { useEffect, useState } from 'react';

interface WorkflowListProps {
    workflows: WorkflowType[];
    activeWorkflowId?: string;
    onSelect: (workflow: WorkflowType) => void;
    onCreate: () => void;
    onRun: (workflow: WorkflowType) => void;
    onDelete: (workflow: WorkflowType) => void;
    onEdit?: (workflow: WorkflowType) => void;
    onQuickSchedule?: (workflow: WorkflowType) => void;
    onOpenOptimizer?: () => void;
    isLoading?: boolean;
}

export default function WorkflowList({
    workflows,
    activeWorkflowId,
    onSelect,
    onCreate,
    onRun,
    onDelete,
    onEdit,
    onQuickSchedule,
    onOpenOptimizer,
    isLoading
}: WorkflowListProps) {
    const [activeRuns, setActiveRuns] = useState<Record<string, WorkflowExecution>>({});

    useEffect(() => {
        const pollRuns = async () => {
            try {
                const runs = await appApi.getActiveRuns();
                const runCount = Object.keys(runs).length;
                const prevRunCount = Object.keys(activeRuns).length;
                
                setActiveRuns(runs);

                // If a run finished, refresh the workflow list to show the new status
                if (prevRunCount > 0 && runCount < prevRunCount) {
                    // This is a bit hacky since we don't have the refresh function here
                    // but it will trigger a re-fetch if we use an event or callback.
                    // For now, let's just use the appApi directly if we had a way to signal the parent.
                    // Actually, the parent (Workspace) should handle this.
                }
            } catch (e) {
                console.error("Failed to poll active runs", e);
            }
        };

        const interval = setInterval(pollRuns, 5000);
        pollRuns();
        return () => clearInterval(interval);
    }, [activeRuns]); // Depend on activeRuns to track changes
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Loading workflows...
            </div>
        );
    }

    return (
        <ScrollArea className="flex-1">
            <div className="space-y-3 p-3">
                <div className="mb-1 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                    <Button
                        data-testid="workflow-create-button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-full gap-2 rounded-xl border-white/10 bg-white/5"
                        onClick={onCreate}
                    >
                        <Plus className="w-4 h-4" />
                        Create Workflow
                    </Button>
                    <div className="mt-2 px-1 text-2xs text-muted-foreground">Create → select → edit → run</div>
                    {onOpenOptimizer && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-8 w-full rounded-xl text-2xs text-muted-foreground hover:bg-white/10 hover:text-foreground"
                            onClick={onOpenOptimizer}
                            data-testid="workflow-optimizer-button"
                        >
                            Optimize Flow Helper
                        </Button>
                    )}
                </div>

                {workflows.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No workflows found</p>
                        <p className="text-xs mt-1">Create one to automate tasks</p>
                    </div>
                ) : (
                    workflows.map((workflow) => (
                        <div key={workflow.id} className="group rounded-2xl border border-white/10 bg-white/[0.045] p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.10)]">
                            <Button
                                data-testid={`workflow-item-${workflow.id}`}
                                variant="ghost"
                                className={`h-auto w-full justify-start gap-2 rounded-xl px-2 py-2.5 ${activeWorkflowId === workflow.id
                                    ? 'bg-primary/10 text-primary'
                                    : ''
                                    }`}
                                onClick={() => onSelect(workflow)}
                            >
                                <Activity className={`w-4 h-4 shrink-0 ${activeWorkflowId === workflow.id ? 'text-primary' : 'text-muted-foreground'}`} />
                                <div className="flex flex-col items-start min-w-0 flex-1">
                                    <div className="flex items-center gap-2 w-full">
                                        <span className="truncate font-medium flex-1 text-left">{workflow.name}</span>
                                        {Object.values(activeRuns).some(r => r.workflow_id === workflow.id) && (
                                            <Zap className="w-3 h-3 text-blue-500 animate-pulse shrink-0" />
                                        )}
                                    </div>
                                        <span className="w-full break-words whitespace-normal text-left leading-4 text-2xs text-muted-foreground">
                                            {workflow.steps.length} steps • {
                                            Object.values(activeRuns).some(r => r.workflow_id === workflow.id)
                                                ? 'Running...'
                                                : (workflow.status || 'Draft')
                                        }
                                    </span>
                                    {workflow.schedule?.enabled && (
                                        <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-2xs text-primary">
                                            <Clock3 className="w-2.5 h-2.5" /> Scheduled
                                        </span>
                                    )}
                                </div>
                            </Button>

                            <div className="mt-1 flex flex-wrap items-center justify-end gap-1 px-1 pb-0.5">
                                {onQuickSchedule && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onQuickSchedule(workflow);
                                        }}
                                        title="Schedule"
                                    >
                                        <Clock3 className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                                {onEdit && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(workflow);
                                        }}
                                        title="Edit Workflow"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                )}
                                <Button
                                    data-testid={`workflow-run-${workflow.id}`}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-xl hover:bg-success/10 hover:text-success"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRun(workflow);
                                    }}
                                    title="Run Workflow"
                                >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`Delete workflow "${workflow.name}"?`)) {
                                            onDelete(workflow);
                                        }
                                    }}
                                    title="Delete Workflow"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </ScrollArea>
    );
}
