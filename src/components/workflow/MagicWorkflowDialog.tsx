import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Wand2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skill, WorkflowStep } from '@/api/tauri';
import { useWorkflowGenerator } from '@/hooks/useWorkflowGenerator';

interface MagicWorkflowDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onWorkflowGenerated: (name: string, steps: WorkflowStep[]) => void;
    installedSkills: Skill[];
}

export default function MagicWorkflowDialog({
    open,
    onOpenChange,
    onWorkflowGenerated,
    installedSkills
}: MagicWorkflowDialogProps) {
    const { generateWorkflow, isLoading, status, error: hookError } = useWorkflowGenerator();
    const [prompt, setPrompt] = useState('');
    const [outputTarget, setOutputTarget] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setError(null);

        try {
            const result = await generateWorkflow(prompt, outputTarget, installedSkills);
            if (result) {
                onWorkflowGenerated(result.name, result.steps);
                onOpenChange(false);
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to generate workflow');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl rounded-2xl">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Sparkles className="w-5 h-5" />
                        <DialogTitle>Magic Workflow Builder</DialogTitle>
                    </div>
                    <DialogDescription>
                        Describe your goal in plain English. The AI will find the right skills and build the workflow for you.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-primary/70">What would you like to build?</label>
                        <Textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., I want to research AI tools, find which is strongest in understanding, then execute a performance test..."
                            className="min-h-[120px] font-medium resize-none bg-muted/20 border-white/10 text-base"
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-primary/70">Target Output Filename (Optional)</label>
                        <Input
                            value={outputTarget}
                            onChange={(e) => setOutputTarget(e.target.value)}
                            placeholder="e.g. final_report.md (Leave empty for auto-generated)"
                            className="bg-muted/20 border-white/10"
                            disabled={isLoading}
                        />
                    </div>

                    {isLoading && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm font-medium">{status || 'Processing...'}</span>
                        </div>
                    )}

                    {(error || hookError) && (
                        <Alert variant="destructive">
                            <AlertCircle className="w-4 h-4" />
                            <AlertDescription>{error || hookError}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleGenerate}
                        disabled={!prompt.trim() || isLoading}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    >
                        <Wand2 className="w-4 h-4" />
                        Generate Workflow
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
