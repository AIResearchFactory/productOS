import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { type ArtifactType } from '@/api/tauri';

interface CreateArtifactDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    artifactType: ArtifactType;
    onSubmit: (title: string) => void;
}

const TYPE_LABELS: Record<ArtifactType, string> = {
    insight: 'Insight',
    evidence: 'Evidence',
    decision: 'Decision',
    requirement: 'Requirement',
    metric_definition: 'Metric Definition',
    experiment: 'Experiment',
    poc_brief: 'POC Brief',
};

export default function CreateArtifactDialog({
    open,
    onOpenChange,
    artifactType,
    onSubmit,
}: CreateArtifactDialogProps) {
    const [title, setTitle] = useState('');

    // Reset form when opened
    useEffect(() => {
        if (open) {
            setTitle('');
        }
    }, [open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSubmit(title.trim());
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New {TYPE_LABELS[artifactType] || 'Artifact'}</DialogTitle>
                    <DialogDescription>
                        Give your artifact a title. You can fill out the details in the editor.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="artifact-title">Title</Label>
                        <Input
                            id="artifact-title"
                            placeholder="e.g. Findings from Q3 Data"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={!title.trim()}>
                            Create Artifact
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
