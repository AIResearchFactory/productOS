import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FolderOpen, HardDrive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { appApi, isTauriRuntime } from '@/api/app';

interface DirectorySelectorProps {
  selectedPath: string;
  onPathChange: (path: string) => void;
  defaultPath: string;
  title?: string;
  description?: string;
  hideRecommended?: boolean;
  pathTitle?: string;
  subdirectories?: string[];
}

export default function DirectorySelector({
  selectedPath,
  onPathChange,
  defaultPath,
  title = 'Select Directory',
  description,
  hideRecommended = false,
  pathTitle = 'Installation Path',
  subdirectories = []
}: DirectorySelectorProps) {
  const { toast } = useToast();
  const handleBrowse = async () => {
    // Browser mode: Use File System Access API if supported
    if ('showDirectoryPicker' in window && !isTauriRuntime()) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        if (handle) {
          onPathChange(`/browser-runtime/${handle.name}`);
        }
      } catch (err) {
        console.log('User cancelled or browser does not support directory picker', err);
      }
    } else {
      try {
        const selected = await appApi.open({
          directory: true,
          multiple: false,
          defaultPath: selectedPath || defaultPath,
          title: 'Select Directory'
        });

        if (selected && typeof selected === 'string') {
          onPathChange(selected);
        }
      } catch (error) {
        toast({
          title: 'Not supported',
          description: 'Your browser does not support directory picking. Please type the path manually.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleUseDefault = () => {
    onPathChange(defaultPath);
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>

        {/* Default Path Suggestion */}
        {!hideRecommended && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Recommended Location
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 font-mono truncate">
                  {defaultPath}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleUseDefault}
                  className="mt-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Use Default
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Path Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {pathTitle}
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              value={selectedPath}
              onChange={(e) => onPathChange(e.target.value)}
              placeholder="Select directory..."
              className="flex-1 font-mono text-sm"
            />
            <Button
              onClick={handleBrowse}
              variant="outline"
              className="flex-shrink-0"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Browse
            </Button>
          </div>
        </div>

        {/* Path Validation & Subdirectories */}
        {selectedPath && (
          <div className="text-xs space-y-2">
            <div className="text-gray-500 dark:text-gray-400">
              <p>Selected: <span className="font-mono">{selectedPath}</span></p>
            </div>
            {subdirectories.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded border border-dashed">
                <p className="text-muted-foreground mb-1 font-medium">The following locations will be created:</p>
                <ul className="space-y-1 font-mono text-primary/70">
                  {subdirectories.map(sub => (
                    <li key={sub}>
                      {selectedPath}{selectedPath.endsWith('/') || selectedPath.endsWith('\\') ? '' : (selectedPath.includes('\\') ? '\\' : '/')}{sub}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
