import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Copy, Check, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { appApi } from '@/api/app';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FilePeekPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string | null;
  projectId: string | null;
}

export default function FilePeekPanel({ isOpen, onClose, filePath, projectId }: FilePeekPanelProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !filePath || !projectId) return;

    const loadFileContent = async () => {
      setLoading(true);
      try {
        const fileContent = await appApi.readMarkdownFile(projectId, filePath);
        setContent(fileContent);
      } catch (err) {
        console.error('Failed to read peek file:', err);
        setContent('_Error: Could not load file content._');
      } finally {
        setLoading(false);
      }
    };

    loadFileContent();
  }, [isOpen, filePath, projectId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !filePath) return null;

  return (
    <div
      className="absolute top-0 right-0 z-50 h-full w-[460px] max-w-full flex flex-col border-l border-border bg-background/85 backdrop-blur-xl shadow-[0_24px_48px_rgba(0,0,0,0.16)] transition-all duration-300 ease-in-out animate-in slide-in-from-right duration-200"
      role="dialog"
      aria-modal="false"
      aria-label={`Peek Panel for ${filePath}`}
    >
      {/* Header */}
      <div className="shrink-0 h-14 border-b border-border bg-muted/40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate select-all">{filePath.split('/').pop()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={handleCopy}
            title="Copy File Contents"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
            title="Close Peek Panel"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-2 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-2xs uppercase tracking-widest font-bold">Loading...</span>
          </div>
        ) : (
          <ScrollArea className="h-full px-5 py-4">
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed select-text">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '_Empty document_'}</ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
