import { useState, useEffect, useRef, useCallback } from 'react';
import { appApi, WorkflowExecution, WorkflowProgress } from '../api/app';


interface UseWorkflowExecutionProps {
    toast: any;
}

export function useWorkflowExecution({ toast }: UseWorkflowExecutionProps) {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState<WorkflowProgress | null>(null);
    const [result, setResult] = useState<WorkflowExecution | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [lastWorkflowName, setLastWorkflowName] = useState('');
    const activeRunIdRef = useRef<string | null>(null);

    const handleRunWorkflow = useCallback(async (projectId: string, workflow: any, parameters?: Record<string, string>) => {
        setIsRunning(true);
        setLastWorkflowName(workflow.name);
        try {
            const runId = await appApi.executeWorkflow(projectId, workflow.id, parameters);
            activeRunIdRef.current = runId;
        } catch (error) {
            setIsRunning(false);
            toast({
                title: 'Error starting workflow',
                description: String(error),
                variant: 'destructive',
            });
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
                
                if (activeRunIdRef.current && run_id !== activeRunIdRef.current) {
                    return;
                }

                setIsRunning(false);
                setProgress(null);
                activeRunIdRef.current = null;

                appApi.getWorkflowHistory(project_id, workflow_id).then(history => {
                    const execution = history.find(h => h.id === run_id);
                    if (execution) {
                        setResult(execution as any);
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
                }).catch(err => {
                    console.error('Failed to fetch results:', err);
                });
            });
        };

        setup();

        return () => {
            if (unlistenProgress) unlistenProgress();
            if (unlistenFinished) unlistenFinished();
        };
    }, [toast]);

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
