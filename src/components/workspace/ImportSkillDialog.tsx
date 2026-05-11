import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ImportSkillDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (skillName: string) => Promise<void>;
}

export default function ImportSkillDialog({ open, onOpenChange, onImport }: ImportSkillDialogProps) {
    const [npxCommand, setNpxCommand] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Clear state when dialog is closed
    useEffect(() => {
        if (!open) {
            setNpxCommand('');
            setError(null);
            setIsLoading(false);
        }
    }, [open]);

    const handleImport = async () => {
        if (!npxCommand.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            await onImport(npxCommand.trim());
            setNpxCommand('');
            onOpenChange(false);
        } catch (err) {
            console.error('Import failed:', err);
            if (typeof err === 'string') {
                setError(err);
            } else if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Failed to import skill. Please check the command and try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Import Skill</DialogTitle>
                    <DialogDescription>
                        Find and import skills from the official registry. ProductOS installs them non-interactively for OpenClaw.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-4">
                        <div className="text-sm space-y-2">
                            <p>To import a skill:</p>
                            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                <li>
                                    Go to <a href="https://skills.sh" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 font-medium">
                                        skills.sh
                                    </a> and search for a skill.
                                </li>
                                <li>Copy the <b>npx skills add</b> command from the skill page.</li>
                                <li>Paste the command below. If needed, ProductOS adds <code>--yes --agent openclaw --copy</code> so the import does not stop at an interactive prompt.</li>
                            </ol>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="npx-command">NPX Command</Label>
                            <Input
                                id="npx-command"
                                value={npxCommand}
                                onChange={(e) => setNpxCommand(e.target.value)}
                                placeholder="npx skills add https://github.com/anthropics/skills --skill frontend-design"
                                disabled={isLoading}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isLoading && npxCommand.trim()) {
                                        handleImport();
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={!npxCommand.trim() || isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Importing...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                Import Skill
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
