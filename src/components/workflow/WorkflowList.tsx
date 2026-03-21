import { Plus, Activity, Play, Clock3, Pencil, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { tauriApi, Workflow as WorkflowType, WorkflowExecution } from '@/api/tauri';
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
    isLoading
}: WorkflowListProps) {
    const [activeRuns, setActiveRuns] = useState<Record<string, WorkflowExecution>>({});

    useEffect(() => {
        const pollRuns = async () => {
            try {
                const runs = await (tauriApi as any).get_active_runs();
                setActiveRuns(runs);
            } catch (e) {
                console.error("Failed to poll active runs", e);
            }
        };

        const interval = setInterval(pollRuns, 5000);
        pollRuns();
        return () => clearInterval(interval);
    }, []);
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Loading workflows...
            </div>
        );
    }

    return (
        <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
                <div className="mb-3">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={onCreate}
                    >
                        <Plus className="w-4 h-4" />
                        Create Workflow
                    </Button>
                    <div className="mt-1 text-[10px] text-muted-foreground px-1">Create → select → edit → run</div>
                </div>

                {workflows.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No workflows found</p>
                        <p className="text-xs mt-1">Create one to automate tasks</p>
                    </div>
                ) : (
                    workflows.map((workflow) => (
                        <div key={workflow.id} className="group rounded-lg border border-border/50 bg-background/40 p-1.5">
                            <Button
                                variant="ghost"
                                className={`w-full justify-start gap-2 h-auto py-2 px-2 ${activeWorkflowId === workflow.id
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
                                    <span className="text-[10px] text-muted-foreground w-full text-left break-words whitespace-normal leading-4">
                                        {workflow.steps.length} steps • {
                                            Object.values(activeRuns).some(r => r.workflow_id === workflow.id)
                                                ? 'Running...'
                                                : (workflow.status || 'Draft')
                                        }
                                    </span>
                                    {workflow.schedule?.enabled && (
                                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
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
                                        className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
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
                                        className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
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
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 hover:bg-success/10 hover:text-success"
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
                                    className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
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
