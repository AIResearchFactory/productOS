import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FilePlus, Sparkles } from 'lucide-react';

interface FileFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (fileName: string) => void;
  projectName?: string;
}

export default function FileFormDialog({
  open,
  onOpenChange,
  onSubmit,
  projectName,
}: FileFormDialogProps) {
  const [fileName, setFileName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fileName.trim()) return;

    const fullFileName = fileName.trim().endsWith('.md')
      ? fileName.trim()
      : `${fileName.trim()}.md`;

    onSubmit(fullFileName);
    setFileName('');
  };

  const handleCancel = () => {
    setFileName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] overflow-hidden rounded-3xl border-white/10 bg-background/75 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-indigo-500/5 pointer-events-none" />

        <DialogHeader className="p-8 pb-4 relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2.5 text-primary">
              <FilePlus className="w-5 h-5" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">New Document</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground/80 font-medium">
            {projectName
              ? `Creating entry in "${projectName}"`
              : 'Create a new research artifact.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-8 pt-2 space-y-6 relative z-10">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fileName" className="text-xs font-bold uppercase tracking-widest text-primary/70 ml-1">
                File Name
              </Label>
              <div className="relative group">
                <Input
                  id="fileName"
                  placeholder="e.g., hypothesis-alpha"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  required
                  className="h-12 rounded-2xl border-white/10 bg-white/5 pr-12 font-medium transition-all focus:bg-white/10 focus:ring-1 focus:ring-primary/40"
                  autoFocus
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground/40 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                  .md
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/60 font-medium ml-1 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> System will automatically apply Markdown encoding.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-3 border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="rounded-xl border border-white/10 bg-white/5 font-bold text-muted-foreground hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!fileName.trim()}
              className="rounded-xl bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 px-8 font-bold"
            >
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
