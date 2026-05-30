import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';
import { Textarea } from './textarea';
import { MessageSquarePlus } from 'lucide-react';

interface CommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorText?: string;
  onConfirm: (comment: string) => void;
  title?: string;
}

export function CommentDialog({
  open,
  onOpenChange,
  anchorText,
  onConfirm,
  title = "Add Comment",
}: CommentDialogProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) {
      setValue('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="comment-dialog" className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-500">
              <MessageSquarePlus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="pt-1">
                {anchorText ? (
                  <>Add a comment on: <span className="italic">"{anchorText.length > 50 ? anchorText.substring(0, 50) + '...' : anchorText}"</span></>
                ) : (
                  "Write your comment below."
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Type your comment here..."
            className="w-full min-h-[100px] rounded-xl border-border bg-muted/30 focus-visible:ring-amber-500/30"
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl border-border bg-background" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white" disabled={!value.trim()}>
              Add Comment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
