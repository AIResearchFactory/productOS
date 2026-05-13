import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { AlertTriangle as TriangleAlert, AlertCircle as CircleAlert, Info } from 'lucide-react';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  requireTypeConfirm?: string;
  scopeSummary?: string[];
}

export default function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = true,
  requireTypeConfirm,
  scopeSummary,
}: ConfirmationDialogProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const isConfirmDisabled = requireTypeConfirm ? confirmInput !== requireTypeConfirm : false;

  // Reset input when dialog opens
  useEffect(() => {
    if (open) {
      setConfirmInput('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="confirmation-dialog" className="sm:max-w-md border-white/10 bg-[#0c0f11]/95 backdrop-blur-2xl">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${isDestructive ? 'border-red-500/20 bg-red-500/10 text-red-400' : 'border-primary/20 bg-primary/10 text-primary'}`}>
              <TriangleAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-foreground">{title}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="pt-2 text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>

        {scopeSummary && scopeSummary.length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Deletion Scope
            </div>
            <ul className="space-y-1.5">
              {scopeSummary.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-zinc-300">
                  <div className="h-1 w-1 rounded-full bg-red-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {requireTypeConfirm && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CircleAlert className="h-3.5 w-3.5 text-amber-400" />
              To confirm, type <span className="font-mono font-bold text-foreground">"{requireTypeConfirm}"</span> below:
            </div>
            <Input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={requireTypeConfirm}
              className="rounded-xl border-white/10 bg-white/5 text-foreground focus-visible:ring-red-500/30"
              autoFocus
            />
          </div>
        )}

        <DialogFooter className="mt-6 gap-2">
          <Button variant="outline" className="rounded-xl border-white/10 bg-white/5 hover:bg-white/10" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            className={`rounded-xl px-6 transition-all ${isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'}`}
            data-testid="confirm-dialog-button"
            disabled={isConfirmDisabled}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
