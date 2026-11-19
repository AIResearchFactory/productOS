import React, { useState, useEffect, useMemo } from 'react';
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
import { ScrollArea } from './scroll-area';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  FolderInput,
  Home,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';

interface MoveFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  projectName?: string;
  existingFolders: string[];
  onMove: (newFilePath: string) => void | Promise<void>;
  onCreateFolder: (folderPath: string) => Promise<void>;
}

export function MoveFileDialog({
  open,
  onOpenChange,
  fileName,
  projectName = 'Product Root',
  existingFolders,
  onMove,
  onCreateFolder,
}: MoveFileDialogProps) {
  const { baseName, currentFolder } = useMemo(() => {
    const clean = fileName.replace(/\/+$/, '');
    const parts = clean.split('/');
    const base = parts[parts.length - 1] || clean;
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    return { baseName: base, currentFolder: folder };
  }, [fileName]);

  const [selectedFolder, setSelectedFolder] = useState<string>(currentFolder);
  const [localFolders, setLocalFolders] = useState<string[]>(existingFolders);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedFolder(currentFolder);
      setLocalFolders(existingFolders);
      setIsCreatingFolder(false);
      setNewFolderName('');
      setIsSubmitting(false);
    }
    // Only reset dialog state when opened or targeting a different file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentFolder, baseName]);

  useEffect(() => {
    if (open) {
      setLocalFolders((prev) => Array.from(new Set([...prev, ...existingFolders])));
    }
  }, [open, existingFolders]);

  const sortedFolders = useMemo(() => {
    return Array.from(new Set(localFolders)).sort((a, b) => a.localeCompare(b));
  }, [localFolders]);

  const handleCreateNewFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = newFolderName.trim().replace(/^\/+|\/+$/g, '');
    if (!cleanInput) return;

    // If a folder is currently selected and the user didn't type a path with '/',
    // allow creating a subfolder inside the selected folder or at root if root is selected
    const fullFolderPath =
      selectedFolder && !cleanInput.includes('/')
        ? `${selectedFolder}/${cleanInput}`
        : cleanInput;

    try {
      setIsSubmitting(true);
      await onCreateFolder(fullFolderPath);
      setLocalFolders((prev) => Array.from(new Set([...prev, fullFolderPath])));
      setSelectedFolder(fullFolderPath);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } catch (err) {
      console.error('Failed to create folder from Move dialog:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMove = async () => {
    if (selectedFolder === currentFolder) return;
    const destinationPath = selectedFolder ? `${selectedFolder}/${baseName}` : baseName;
    try {
      setIsSubmitting(true);
      await onMove(destinationPath);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSameLocation = selectedFolder === currentFolder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="move-file-dialog" className="sm:max-w-[480px] flex flex-col gap-0 overflow-hidden rounded-3xl border-border bg-background/95 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-indigo-500/5 pointer-events-none" />

        <DialogHeader className="p-6 pb-3 pr-14 relative z-10 border-b border-border/40 min-w-0 text-left">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <FolderInput className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-lg font-bold tracking-tight" title={`Move "${baseName}"`}>
                Move &ldquo;{baseName}&rdquo;
              </DialogTitle>
              <DialogDescription className="pt-0.5 text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
                <span className="shrink-0">Current location:</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground min-w-0">
                  {currentFolder ? (
                    <>
                      <Folder className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="truncate">{currentFolder}</span>
                    </>
                  ) : (
                    <>
                      <Home className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{projectName} (Root)</span>
                    </>
                  )}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 py-4 space-y-3 relative z-10 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Select Destination Folder
            </span>
            {!isCreatingFolder && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-testid="move-dialog-new-folder-btn"
                onClick={() => setIsCreatingFolder(true)}
                className="h-7 gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                New Folder
              </Button>
            )}
          </div>

          {/* Inline New Folder Creator (Google Drive style) */}
          {isCreatingFolder && (
            <form
              onSubmit={handleCreateNewFolder}
              className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2 animate-in fade-in duration-150"
            >
              <FolderPlus className="h-4 w-4 text-primary shrink-0 ml-1" />
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={
                  selectedFolder
                    ? `New folder in "${selectedFolder}" (or use / for path)`
                    : 'New folder name...'
                }
                className="h-8 flex-1 rounded-lg border-border bg-background text-xs"
                autoFocus
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newFolderName.trim() || isSubmitting}
                className="h-8 rounded-lg px-3 text-xs font-semibold"
              >
                Create
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                title="Cancel new folder"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </form>
          )}

          {/* Folder List */}
          <ScrollArea className="h-[220px] rounded-2xl border border-border bg-muted/20 p-2">
            <div className="space-y-1">
              {/* Root Option */}
              <button
                type="button"
                data-testid="move-target-root"
                onClick={() => setSelectedFolder('')}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
                  selectedFolder === ''
                    ? 'bg-primary/15 text-primary font-bold ring-1 ring-primary/30 shadow-sm'
                    : 'text-foreground hover:bg-muted/70'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Home className={`h-4 w-4 shrink-0 ${selectedFolder === '' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="truncate">{projectName} (Root)</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {currentFolder === '' && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Current
                    </span>
                  )}
                  {selectedFolder === '' && <Check className="h-4 w-4 text-primary" />}
                </div>
              </button>

              {/* Existing Subfolders */}
              {sortedFolders.map((folderPath) => {
                const isSelected = selectedFolder === folderPath;
                const isCurrent = currentFolder === folderPath;
                const depth = folderPath.split('/').length - 1;
                const displayName = folderPath.split('/').pop() || folderPath;

                return (
                  <button
                    key={folderPath}
                    type="button"
                    data-testid={`move-target-folder-${folderPath}`}
                    onClick={() => setSelectedFolder(folderPath)}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                    className={`w-full flex items-center justify-between rounded-xl pr-3 py-2 text-xs transition-all ${
                      isSelected
                        ? 'bg-primary/15 text-primary font-bold ring-1 ring-primary/30 shadow-sm'
                        : 'text-foreground hover:bg-muted/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isSelected ? (
                        <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <Folder className="h-4 w-4 shrink-0 text-amber-500/80" />
                      )}
                      <span className="truncate">{displayName}</span>
                      {depth > 0 && (
                        <span className="truncate text-[10px] text-muted-foreground/60 font-normal">
                          ({folderPath})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isCurrent && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Current
                        </span>
                      )}
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </button>
                );
              })}

              {sortedFolders.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground/60 italic">
                  No subfolders yet. Click &ldquo;New Folder&rdquo; above to create one.
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Preview Destination Path */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground min-w-0">
            <span className="font-medium shrink-0">Destination path:</span>
            <span
              className="font-mono font-semibold text-foreground min-w-0 flex items-center gap-1"
              title={selectedFolder ? `${selectedFolder}/${baseName}` : baseName}
            >
              <ArrowRight className="h-3 w-3 text-primary shrink-0" />
              <span className="truncate">
                {selectedFolder ? `${selectedFolder}/${baseName}` : baseName}
              </span>
            </span>
          </div>
        </div>

        <DialogFooter className="p-6 pt-3 border-t border-border/40 flex flex-row items-center justify-end gap-2 relative z-10 min-w-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-border bg-background hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="confirm-move-file-btn"
            disabled={isSameLocation || isSubmitting}
            onClick={handleConfirmMove}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground px-6 font-bold shadow-lg shadow-primary/20"
          >
            {isSubmitting ? 'Moving...' : 'Move Here'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
