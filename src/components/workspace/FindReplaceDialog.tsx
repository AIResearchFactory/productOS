import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search, Replace, X, ChevronDown, ChevronUp } from 'lucide-react';

interface FindReplaceDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'find' | 'replace';
  onFind: (searchText: string, options: FindOptions) => void;
  onReplace: (searchText: string, replaceText: string, replaceAll: boolean) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  matchCount?: number;
  currentMatch?: number;
}

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

// Helper Components

interface SearchOptionsProps {
  options: FindOptions;
  onOptionChange: (key: keyof FindOptions, value: boolean) => void;
}

function SearchOptions({ options, onOptionChange }: SearchOptionsProps) {
  return (
    <div className="flex flex-wrap gap-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={options.caseSensitive}
          onChange={(e) => onOptionChange('caseSensitive', e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-foreground">Match case</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={options.wholeWord}
          onChange={(e) => onOptionChange('wholeWord', e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-foreground">Whole word</span>
      </label>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={options.useRegex}
          onChange={(e) => onOptionChange('useRegex', e.target.checked)}
          className="rounded"
        />
        <span className="text-sm text-foreground">Use regex</span>
      </label>
    </div>
  );
}

interface NavigationButtonsProps {
  onNext?: () => void;
  onPrevious?: () => void;
  matchCount: number;
}

function NavigationButtons({ onNext, onPrevious, matchCount }: NavigationButtonsProps) {
  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={onPrevious}
        disabled={matchCount === 0}
        title="Previous match (Shift+Enter)"
      >
        <ChevronUp className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onNext}
        disabled={matchCount === 0}
        title="Next match (Enter)"
      >
        <ChevronDown className="w-4 h-4" />
      </Button>
    </>
  );
}

interface ActionButtonsProps {
  mode: 'find' | 'replace';
  onClose: () => void;
  onFind: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  disabled: boolean;
}

function ActionButtons({ mode, onClose, onFind, onReplace, onReplaceAll, disabled }: ActionButtonsProps) {
  return (
    <div className="flex justify-end gap-2 pt-4">
      <Button variant="outline" onClick={onClose}>
        <X className="w-4 h-4 mr-2" />
        Close
      </Button>
      {mode === 'replace' && (
        <>
          <Button onClick={onReplace} disabled={disabled}>
            Replace
          </Button>
          <Button onClick={onReplaceAll} disabled={disabled}>
            Replace All
          </Button>
        </>
      )}
      {mode === 'find' && (
        <Button onClick={onFind} disabled={disabled}>
          <Search className="w-4 h-4 mr-2" />
          Find
        </Button>
      )}
    </div>
  );
}

// Main Component

export default function FindReplaceDialog({
  open,
  onClose,
  mode,
  onFind,
  onReplace,
  onNext,
  onPrevious,
  matchCount = 0,
  currentMatch = 0
}: FindReplaceDialogProps) {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [options, setOptions] = useState<FindOptions>({
    caseSensitive: false,
    wholeWord: false,
    useRegex: false
  });

  // Validation logic
  const isSearchValid = useMemo(() => searchText.trim().length > 0, [searchText]);

  // Memoized event handlers
  const handleFind = useCallback(() => {
    if (isSearchValid) {
      onFind(searchText, options);
    }
  }, [searchText, options, onFind, isSearchValid]);

  const handleReplace = useCallback(() => {
    if (isSearchValid) {
      onReplace(searchText, replaceText, false);
    }
  }, [searchText, replaceText, onReplace, isSearchValid]);

  const handleReplaceAll = useCallback(() => {
    if (isSearchValid) {
      onReplace(searchText, replaceText, true);
    }
  }, [searchText, replaceText, onReplace, isSearchValid]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrevious?.();
      } else {
        handleFind();
        onNext?.();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [onPrevious, handleFind, onNext, onClose]);

  const updateOption = useCallback((key: keyof FindOptions, value: boolean) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  // Dialog configuration
  const dialogConfig = useMemo(() => ({
    find: { icon: Search, title: 'Find' },
    replace: { icon: Replace, title: 'Find and Replace' }
  }), []);

  const { icon: DialogIcon, title: dialogTitle } = dialogConfig[mode];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DialogIcon className="w-5 h-5" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>
            {mode === 'find'
              ? 'Search for text in the current document'
              : 'Search and replace text in the current document'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="search">Find</Label>
            <div className="flex gap-2">
              <Input
                id="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter search text..."
                className="flex-1"
                autoFocus
              />
              <NavigationButtons
                onNext={onNext}
                onPrevious={onPrevious}
                matchCount={matchCount}
              />
            </div>
            {matchCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {currentMatch} of {matchCount} matches
              </p>
            )}
          </div>

          {/* Replace Input (only in replace mode) */}
          {mode === 'replace' && (
            <div className="space-y-2">
              <Label htmlFor="replace">Replace with</Label>
              <Input
                id="replace"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter replacement text..."
              />
            </div>
          )}

          {/* Options */}
          <SearchOptions options={options} onOptionChange={updateOption} />

          {/* Action Buttons */}
          <ActionButtons
            mode={mode}
            onClose={onClose}
            onFind={handleFind}
            onReplace={handleReplace}
            onReplaceAll={handleReplaceAll}
            disabled={!isSearchValid}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
