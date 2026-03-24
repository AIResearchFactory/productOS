import { Loader2, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkflowProgress, tauriApi } from '@/api/tauri';
import { useState, useEffect } from 'react';

interface WorkflowProgressOverlayProps {
    isRunning: boolean;
    progress: WorkflowProgress | null;
}

export default function WorkflowProgressOverlay({ isRunning, progress }: WorkflowProgressOverlayProps) {
    const [isStopping, setIsStopping] = useState(false);

    const handleStop = async () => {
        if (!progress || isStopping) return;
        
        setIsStopping(true);
        try {
            await tauriApi.stopWorkflowExecution(progress.project_id, progress.workflow_id);
        } catch (error) {
            console.error('Failed to stop workflow:', error);
            setIsStopping(false);
        }
    };

    // Reset isStopping when isRunning becomes false
    useEffect(() => {
        if (!isRunning && isStopping) {
            setIsStopping(false);
        }
    }, [isRunning, isStopping]);

    return (
        <AnimatePresence>
            {isRunning && (
                <motion.div
                    initial={{ y: -60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -60, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="absolute top-0 left-0 right-0 z-30 pointer-events-none"
                >
                    <div className="mx-auto max-w-2xl mt-3 pointer-events-auto">
                        <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-xl px-5 py-3.5">
                            {/* Header row */}
                            <div className="flex items-center gap-3 mb-2.5">
                                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-foreground truncate">
                                        {progress?.step_name
                                            ? `Running: ${progress.step_name}`
                                            : 'Starting workflow...'}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {progress?.status === 'running'
                                            ? 'Executing step...'
                                            : progress?.status === 'completed'
                                                ? 'Step completed'
                                                : progress?.status === 'failed'
                                                    ? 'Step failed'
                                                    : 'Preparing...'}
                                    </div>
                                </div>
                                <span className="text-xs font-mono font-bold text-primary tabular-nums mr-2">
                                    {progress?.progress_percent ?? 0}%
                                </span>
                                <button
                                    onClick={handleStop}
                                    disabled={isStopping || !progress}
                                    className={`p-1.5 rounded-full transition-all duration-200 ${
                                        isStopping 
                                            ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50' 
                                            : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive group'
                                    }`}
                                    title="Stop workflow execution"
                                >
                                    <Square className={`w-3.5 h-3.5 fill-current ${isStopping ? '' : 'group-hover:fill-destructive'}`} />
                                </button>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-primary via-blue-500 to-cyan-500"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress?.progress_percent ?? 0}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
