import { Plus, Activity, Play, Clock3, Pencil, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';
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
    const [workflowPendingDelete, setWorkflowPendingDelete] = useState<WorkflowType | null>(null);

    useEffect(() => {
        const pollRuns = async () => {
            try {
                const runs = await appApi.getActiveRuns();
                setActiveRuns(runs);
            } catch (e) {
                console.error("Failed to poll active runs", e);
            }
        };

        const interval = setInterval(pollRuns, 1000); // Poll every 1s in dev/test
        pollRuns();
        return () => clearInterval(interval);
    }, []); // Empty dependency array is better for setInterval
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Loading workflows...
            </div>
        );
    }

    return (
        <>
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
                        Create and open builder
                    </Button>
                    <div className="mt-2 px-1 text-2xs text-muted-foreground">Details → steps → test → schedule</div>
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
                        <p className="text-sm font-medium text-foreground">No workflows yet</p>
                        <p className="text-xs mt-1">Create a repeatable product task, then test and schedule it.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {workflows.map((workflow) => {
                            const isRunning = Object.values(activeRuns).some(r => r.workflow_id === workflow.id);
                            if (isRunning) console.log(`[WorkflowList] Workflow ${workflow.id} is RUNNING`);
                            
                            return (
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
                                                {isRunning && (
                                                    <Zap className="w-3 h-3 text-blue-500 animate-pulse shrink-0" />
                                                )}
                                                {workflow.last_run && !isRunning && (
                                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                                        workflow.status === 'Completed' ? 'bg-emerald-500' : 
                                                        workflow.status === 'Failed' ? 'bg-red-500' : 'bg-muted-foreground/30'
                                                    }`} />
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1 w-full text-left">
                                                <span className="text-2xs text-muted-foreground truncate">
                                                    {workflow.steps.length} steps • {
                                                        isRunning
                                                            ? 'Running now...'
                                                            : (workflow.status || 'Draft')
                                                    }
                                                </span>
                                                {workflow.last_run && (
                                                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                                                        <Clock3 className="w-2.5 h-2.5" /> 
                                                        Last run: {new Date(workflow.last_run).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                            {workflow.schedule?.enabled && (
                                                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                                                    <Clock3 className="w-2 h-2" /> Scheduled
                                                </span>
                                            )}
                                        </div>
                                    </Button>

                                    <div className="mt-1 flex flex-wrap items-center justify-end gap-1 px-1 pb-0.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-white/10"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Assuming there's a way to view history, maybe by selecting and switching tab
                                                onSelect(workflow);
                                            }}
                                            title="View Execution History"
                                        >
                                            <Activity className="w-3.5 h-3.5" />
                                        </Button>
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
                                            data-testid="btn-run-workflow-list"
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
                                                setWorkflowPendingDelete(workflow);
                                            }}
                                            title="Delete Workflow"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </ScrollArea>
        <ConfirmationDialog
            open={!!workflowPendingDelete}
            onOpenChange={(open: boolean) => !open && setWorkflowPendingDelete(null)}
            title="Delete workflow?"
            description={`This will delete the automation "${workflowPendingDelete?.name || ''}" and its associated settings. This action is irreversible.`}
            confirmText="Delete workflow"
            requireTypeConfirm={workflowPendingDelete?.name}
            scopeSummary={[
                'Automation steps and logic',
                'Execution history (summary)',
                'Saved schedule and notifications',
                'Custom step parameters'
            ]}
            isDestructive
            onConfirm={() => {
                if (workflowPendingDelete) {
                    onDelete(workflowPendingDelete);
                }
                setWorkflowPendingDelete(null);
            }}
        />
        </>
    );
}
