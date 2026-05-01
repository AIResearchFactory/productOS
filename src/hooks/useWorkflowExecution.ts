import { useState, useEffect, useRef, useCallback } from 'react';
import { appApi, WorkflowProgress, WorkflowRunRecord } from '../api/app';


interface UseWorkflowExecutionProps {
    toast: any;
}

export function useWorkflowExecution({ toast }: UseWorkflowExecutionProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<WorkflowProgress | null>(null);
    const [result, setResult] = useState<WorkflowRunRecord | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [lastWorkflowName, setLastWorkflowName] = useState('');
    const activeRunIdRef = useRef<string | null>(null);
    const activeRunMetaRef = useRef<{ projectId: string, workflowId: string } | null>(null);

    const handleRunWorkflow = useCallback(async (projectId: string, workflow: any, parameters?: Record<string, string>) => {
        setIsRunning(true);
        setLastWorkflowName(workflow.name);
        try {
            const runId = await appApi.executeWorkflow(projectId, workflow.id, parameters);
            activeRunIdRef.current = runId;
            activeRunMetaRef.current = { projectId, workflowId: workflow.id };
        } catch (error) {
            setIsRunning(false);
            toast({
                title: 'Error starting workflow',
                description: String(error),
                variant: 'destructive',
            });
        }
    }, [toast]);

    const handleFinished = useCallback(async (projectId: string, workflowId: string, runId: string, status: string, error?: string) => {
        if (activeRunIdRef.current && runId !== activeRunIdRef.current) {
            return;
        }

        setIsRunning(false);
        setProgress(null);
        activeRunIdRef.current = null;

        try {
            const history = await appApi.getWorkflowHistory(projectId, workflowId);
            const execution = history.find(h => h.id === runId);
            if (execution) {
                setResult(execution);
                setShowResult(true);

                const stepEntries = Object.entries(execution.step_results || {});
                const completedSteps = stepEntries.filter(([, r]: [string, any]) => r.status === 'Completed').length;
                const allOutputFiles = stepEntries.flatMap(([, r]: [string, any]) => r.output_files || []);

                if (status === 'Completed') {
                    toast({
                        title: '✓ Workflow Completed',
                        description: `${completedSteps}/${stepEntries.length} steps completed${allOutputFiles.length > 0 ? `, ${allOutputFiles.length} files created` : ''}`
                    });
                } else {
                    toast({
                        title: status === 'PartialSuccess' ? '⚠ Partially Completed' : '✗ Workflow Failed',
                        description: error || 'Execution finished with issues.',
                        variant: 'destructive'
                    });
                }
            }
        } catch (err) {
            console.error('Failed to fetch results:', err);
        }
    }, [toast]);

    useEffect(() => {
        let unlistenProgress: (() => void) | undefined;
        let unlistenFinished: (() => void) | undefined;

        const setup = async () => {
            unlistenProgress = await appApi.onWorkflowProgress((p) => {
                setProgress(p);
            });

            unlistenFinished = await appApi.listen('workflow-finished', (event: any) => {
                const { project_id, workflow_id, run_id, status, error } = event.payload;
                handleFinished(project_id, workflow_id, run_id, status, error);
            });
        };

        setup();

        return () => {
            if (unlistenProgress) unlistenProgress();
            if (unlistenFinished) unlistenFinished();
        };
    }, [handleFinished]);

    // Polling fallback for status updates (in case SSE fails in CI)
    useEffect(() => {
        if (!isRunning || !activeRunIdRef.current) return;

        const interval = setInterval(async () => {
            try {
                const activeRuns = await appApi.getActiveRuns();
                const runId = activeRunIdRef.current;
                const meta = activeRunMetaRef.current;
                if (!runId || !meta) return;

                const run = Object.values(activeRuns).find(r => r.id === runId);
                
                if (!run) {
                    // Run disappeared from active runs, it must have finished
                    console.log('[WorkflowExecution] Run no longer active in poll, checking history...');
                    const history = await appApi.getWorkflowHistory(meta.projectId, meta.workflowId);
                    const execution = history.find(h => h.id === runId);
                    
                    if (execution) {
                        handleFinished(meta.projectId, meta.workflowId, runId, execution.status, execution.error);
                    } else {
                        // Not in history yet either? maybe still finishing
                    }
                }
            } catch (e) {
                // Ignore polling errors
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [isRunning, handleFinished]);

    return {
        isRunning,
        progress,
        result,
        showResult,
        setShowResult,
        lastWorkflowName,
        handleRunWorkflow
    };
}
