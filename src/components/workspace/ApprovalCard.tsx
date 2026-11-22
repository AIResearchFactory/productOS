import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, AlertCircle, ShieldCheck, Zap, Server, Cpu, FileBox, Info } from 'lucide-react';
import { motion } from 'framer-motion';

export type ConfigAction =
    | { type: 'create_workflow'; payload: { name: string; description?: string; steps: any[] } }
    | { type: 'create_skill'; payload: { name: string; description?: string; template: string; category?: string } }
    | { type: 'install_mcp'; payload: { id: string; name?: string; description?: string; command: string; args: string[]; env?: Record<string, string> } }
    | { type: 'configure_llm'; payload: { provider: string; label: string } }
    | { type: 'install_pandoc' };

export function isValidConfigAction(action: unknown): action is ConfigAction {
    if (!action || typeof action !== 'object') return false;
    const candidate = action as any;
    switch (candidate.type) {
        case 'create_workflow':
            return Boolean(
                candidate.payload &&
                typeof candidate.payload.name === 'string' &&
                Array.isArray(candidate.payload.steps)
            );
        case 'create_skill':
            return Boolean(
                candidate.payload &&
                typeof candidate.payload.name === 'string' &&
                typeof candidate.payload.template === 'string'
            );
        case 'install_mcp':
            return Boolean(
                candidate.payload &&
                typeof candidate.payload.id === 'string' &&
                typeof candidate.payload.command === 'string' &&
                Array.isArray(candidate.payload.args) &&
                candidate.payload.args.every((a: unknown) => typeof a === 'string')
            );
        case 'configure_llm':
            return Boolean(
                candidate.payload &&
                typeof candidate.payload.provider === 'string' &&
                typeof candidate.payload.label === 'string'
            );
        case 'install_pandoc':
            return true;
        default:
            return false;
    }
}

interface ApprovalCardProps {
    action: ConfigAction;
    onApprove: (action: ConfigAction) => Promise<any>;
    onReject: () => void;
    onExecute?: (workflow: any) => void;
}

const actionLabels: Record<ConfigAction['type'], string> = {
    create_workflow: 'Create Automation',
    create_skill: 'Install AI Skill',
    install_mcp: 'Connect Resource',
    configure_llm: 'Switch AI Engine',
    install_pandoc: 'System Dependency',
};

const actionIcons: Record<ConfigAction['type'], any> = {
    create_workflow: Zap,
    create_skill: ShieldCheck,
    install_mcp: Server,
    configure_llm: Cpu,
    install_pandoc: FileBox,
};

const actionColors: Record<ConfigAction['type'], string> = {
    create_workflow: 'text-primary bg-primary/10 border-primary/20',
    create_skill: 'text-primary bg-primary/10 border-primary/20',
    install_mcp: 'text-primary bg-primary/10 border-primary/20',
    configure_llm: 'text-primary bg-primary/10 border-primary/20',
    install_pandoc: 'text-primary bg-primary/10 border-primary/20',
};

export default function ApprovalCard({ action, onApprove, onReject, onExecute }: ApprovalCardProps) {
    const [status, setStatus] = useState<'pending' | 'approving' | 'approved' | 'rejected'>('pending');
    const [result, setResult] = useState<any>(null);

    if (!isValidConfigAction(action)) {
        return (
            <div className="my-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Invalid or malformed configuration proposal blocked for safety.</span>
            </div>
        );
    }

    const Icon = actionIcons[action.type];
    const colorClass = actionColors[action.type];

    const handleApprove = async () => {
        setStatus('approving');
        try {
            const res = await onApprove(action);
            setResult(res);
            setStatus('approved');
        } catch {
            setStatus('pending');
        }
    };

    const handleReject = () => {
        setStatus('rejected');
        onReject();
    };

    const renderPayloadDetails = () => {
        switch (action.type) {
            case 'create_workflow':
                return (
                    <div className="space-y-1.5">
                        <Detail label="Name" value={action.payload.name} />
                        {action.payload.description && (
                            <Detail label="Description" value={action.payload.description} />
                        )}
                        <Detail
                            label="Steps"
                            value={`${action.payload.steps.length} steps (${action.payload.steps.map((s: any, idx: number) => s?.name || s?.step_type || `Step ${idx + 1}`).join(', ')})`}
                        />
                        <p className="mt-2 text-2xs text-muted-foreground/70 italic">Copilot has drafted this automation based on your conversation. Review the steps in the builder after creation.</p>
                    </div>
                );
            case 'create_skill':
                return (
                    <div className="space-y-1.5">
                        <Detail label="Skill" value={action.payload.name} />
                        <Detail label="Type" value={action.payload.category || 'General'} />
                        {action.payload.description && (
                            <Detail label="Description" value={action.payload.description} />
                        )}
                        <div className="mt-1.5 space-y-1">
                            <span className="text-muted-foreground font-medium block">Template:</span>
                            <pre className="rounded bg-black/30 p-2 text-[11px] font-mono text-zinc-200 whitespace-pre-wrap max-h-36 overflow-y-auto border border-white/10">
                                {action.payload.template}
                            </pre>
                        </div>
                    </div>
                );
            case 'install_mcp': {
                const fullCommand = [action.payload.command, ...(action.payload.args || [])].join(' ');
                const envKeys = action.payload.env && typeof action.payload.env === 'object'
                    ? Object.keys(action.payload.env)
                    : [];
                return (
                    <div className="space-y-1.5">
                        <Detail label="Resource" value={action.payload.name || action.payload.id} />
                        <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground font-medium">Command & Arguments:</span>
                            <code className="rounded bg-black/40 px-2 py-1.5 text-[11px] font-mono text-amber-200 break-all border border-white/10">
                                {fullCommand}
                            </code>
                        </div>
                        {envKeys.length > 0 && (
                            <Detail label="Env Keys" value={envKeys.join(', ')} />
                        )}
                        <p className="mt-2 text-2xs text-amber-400/80">⚠️ This grants the AI permission to execute local commands via this server.</p>
                    </div>
                );
            }
            case 'configure_llm':
                return (
                    <div className="space-y-1.5">
                        <Detail label="AI Engine" value={action.payload.label} />
                        <p className="mt-2 text-2xs text-muted-foreground/70 italic">This will update your default provider for all future requests.</p>
                    </div>
                );
            case 'install_pandoc':
                return (
                    <div className="space-y-1.5">
                        <p className="text-zinc-300">System requirement for document processing.</p>
                        <Detail label="Method" value="Homebrew (brew install pandoc)" />
                    </div>
                );
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="my-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f11]/60 shadow-[0_12px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl"
        >
            {/* Header / Trust Boundary */}
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-lg border ${colorClass}`}>
                        <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        {actionLabels[action.type]}
                    </span>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary/80 ring-1 ring-primary/20">
                    <AlertCircle className="h-3 w-3" />
                    Approval Required
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Details Card */}
                <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-xs leading-relaxed">
                    {renderPayloadDetails()}
                </div>

                {/* Status / Actions */}
                <div className="flex items-center justify-between gap-4">
                    {status === 'pending' && (
                        <>
                            <div className="flex flex-1 items-center gap-2 text-[10px] text-muted-foreground">
                                <Info className="h-3.5 w-3.5" />
                                Review carefully before approving.
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleReject}
                                    className="h-8 rounded-lg px-3 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                >
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleApprove}
                                    className="h-8 rounded-lg bg-white text-black px-4 text-xs font-bold shadow-lg hover:bg-zinc-200 transition-all active:scale-95"
                                >
                                    Approve & Run
                                </Button>
                            </div>
                        </>
                    )}

                    {status === 'approving' && (
                        <div className="flex w-full items-center justify-center gap-3 py-1 text-xs text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            Executing privileged action...
                        </div>
                    )}

                    {status === 'approved' && (
                        <div className="flex w-full flex-col gap-3">
                            <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary ring-1 ring-primary/20">
                                <Check className="h-4 w-4" />
                                {action.type === 'install_pandoc' ? 'System dependency installed' : 'Action completed successfully'}
                            </div>

                            {action.type === 'create_workflow' && result && onExecute && (
                                <Button
                                    size="sm"
                                    onClick={() => onExecute(result)}
                                    className="h-9 w-full rounded-xl bg-primary text-xs font-bold text-white shadow-lg hover:bg-primary/90 transition-all"
                                >
                                    <Zap className="mr-2 h-3.5 w-3.5 fill-current" />
                                    Open Builder & Run
                                </Button>
                            )}
                        </div>
                    )}

                    {status === 'rejected' && (
                        <div className="flex w-full items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-muted-foreground">
                            <X className="h-4 w-4" />
                            Action declined by user
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex gap-2">
            <span className="text-muted-foreground font-medium shrink-0">{label}:</span>
            <span className="text-foreground break-all">{value}</span>
        </div>
    );
}
