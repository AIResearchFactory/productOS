import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { WorkflowProgress } from '@/api/tauri';

interface WorkflowProgressOverlayProps {
    isRunning: boolean;
    progress: WorkflowProgress | null;
}

export default function WorkflowProgressOverlay({ isRunning, progress }: WorkflowProgressOverlayProps) {
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
                                <span className="text-xs font-mono font-bold text-primary tabular-nums">
                                    {progress?.progress_percent ?? 0}%
                                </span>
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
