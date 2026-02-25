import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export type ConfigAction =
    | { type: 'create_workflow'; payload: { name: string; description: string; steps: any[] } }
    | { type: 'create_skill'; payload: { name: string; description: string; template: string; category: string } }
    | { type: 'install_mcp'; payload: { id: string; name: string; description?: string; command: string; args: string[] } }
    | { type: 'configure_llm'; payload: { provider: string; label: string } };

interface ApprovalCardProps {
    action: ConfigAction;
    onApprove: (action: ConfigAction) => Promise<void>;
    onReject: () => void;
}

const actionLabels: Record<ConfigAction['type'], string> = {
    create_workflow: 'Create Workflow',
    create_skill: 'Create Skill',
    install_mcp: 'Install MCP Server',
    configure_llm: 'Configure LLM',
};

const actionColors: Record<ConfigAction['type'], string> = {
    create_workflow: 'text-violet-400',
    create_skill: 'text-emerald-400',
    install_mcp: 'text-blue-400',
    configure_llm: 'text-amber-400',
};

export default function ApprovalCard({ action, onApprove, onReject }: ApprovalCardProps) {
    const [status, setStatus] = useState<'pending' | 'approving' | 'approved' | 'rejected'>('pending');

    const handleApprove = async () => {
        setStatus('approving');
        try {
            await onApprove(action);
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
                        <Detail label="Description" value={action.payload.description} />
                        <Detail label="Steps" value={`${action.payload.steps.length} step(s)`} />
                    </div>
                );
            case 'create_skill':
                return (
                    <div className="space-y-1.5">
                        <Detail label="Name" value={action.payload.name} />
                        <Detail label="Category" value={action.payload.category} />
                        <Detail label="Description" value={action.payload.description} />
                    </div>
                );
            case 'install_mcp':
                return (
                    <div className="space-y-1.5">
                        <Detail label="Server" value={action.payload.name} />
                        {action.payload.description && <Detail label="Description" value={action.payload.description} />}
                        <Detail label="Command" value={`${action.payload.command} ${action.payload.args.join(' ')}`} />
                    </div>
                );
            case 'configure_llm':
                return (
                    <div className="space-y-1.5">
                        <Detail label="Provider" value={action.payload.label} />
                    </div>
                );
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-3 rounded-xl border border-border bg-card p-4 space-y-3"
        >
            {/* Header */}
            <div className="flex items-center gap-2">
                <AlertCircle className={`w-4 h-4 ${actionColors[action.type]}`} />
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    {actionLabels[action.type]}
                </span>
            </div>

            {/* Details */}
            <div className="bg-background/50 rounded-lg p-3 border border-border/50 text-xs">
                {renderPayloadDetails()}
            </div>

            {/* Actions */}
            {status === 'pending' && (
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        onClick={handleApprove}
                        className="bg-primary hover:bg-primary/90 text-white text-xs h-8 px-4"
                    >
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                        Approve
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleReject}
                        className="text-muted-foreground text-xs h-8 px-4"
                    >
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        Reject
                    </Button>
                </div>
            )}

            {status === 'approving' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Applying configuration...
                </div>
            )}

            {status === 'approved' && (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                    <Check className="w-3.5 h-3.5" />
                    Configuration applied
                </div>
            )}

            {status === 'rejected' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <X className="w-3.5 h-3.5" />
                    Rejected
                </div>
            )}
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
