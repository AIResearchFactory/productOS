import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Eye, Edit3, Save, ShieldCheck, Wand2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import { tauriApi } from '../../api/tauri';
import { useToast } from '@/hooks/use-toast';
import remarkGfm from 'remark-gfm';
import { detectArtifactKind, validateArtifactQuality } from '@/lib/artifactQuality';

const scrollPositions = new Map<string, number>();

interface MarkdownEditorProps {
  document: {
    id: string;
    name: string;
    type: string;
    content?: string;
  };
  projectId?: string;
}

export default function MarkdownEditor({ document, projectId }: MarkdownEditorProps) {
  const [content, setContent] = useState(document.content || '');
  const [mode, setMode] = useState('view'); // 'view' or 'edit'
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qualityIssues, setQualityIssues] = useState<Array<{ key: string; message: string; reason?: string; suggestion?: string }>>([]);
  const [qualityLastCheckedAt, setQualityLastCheckedAt] = useState<string | null>(null);
  const { toast } = useToast();
  const lastChangeTime = useRef<number>(Date.now());
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load document content when document changes
  useEffect(() => {
    const loadContent = async () => {
      if (!projectId || !document.name) return;

      try {
        setLoading(true);
        const fileContent = await tauriApi.readMarkdownFile(projectId, document.name);
        setContent(fileContent);
        setHasChanges(false);
      } catch (error) {
        console.error('Failed to load document:', error);
        // If file doesn't exist yet, it's a new document
        setContent(document.content || '');
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [document.id, document.name, projectId]);

  // Restore scroll position when content is loaded or document changes
  useEffect(() => {
    if (!loading && content && scrollRef.current) {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const savedPos = scrollPositions.get(document.id);
        if (savedPos !== undefined) {
          viewport.scrollTop = savedPos;
        }
      }
    }
  }, [document.id, loading, content]);

  // Handle scroll events to save position
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const handleScroll = () => {
      scrollPositions.set(document.id, viewport.scrollTop);
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [document.id]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
    lastChangeTime.current = Date.now();
  };

  // Auto-save logic: 25 seconds of idle
  useEffect(() => {
    if (hasChanges && !loading) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

      autoSaveTimerRef.current = setTimeout(() => {
        const idleTime = Date.now() - lastChangeTime.current;
        if (idleTime >= 24000) { // Slightly less than 25s to be safe
          handleSave(true); // silent save
        }
      }, 25000);
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [content, hasChanges, loading]);

  const handleSave = async (silent = false) => {
    if (!projectId || !document.name) {
      if (!silent) {
        toast({
          title: 'Error',
          description: 'Cannot save: missing project or document name',
          variant: 'destructive'
        });
      }
      return;
    }

    setLoading(true);
    try {
      await tauriApi.writeMarkdownFile(projectId, document.name, content);
      setHasChanges(false);
      if (!silent) {
        toast({
          title: 'Success',
          description: 'Document saved successfully'
        });
      }
    } catch (error) {
      console.error('Failed to save document:', error);
      if (!silent) {
        toast({
          title: 'Error',
          description: 'Failed to save document',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: string) => {
    if (mode === 'edit' && newMode === 'view' && hasChanges) {
      handleSave();
    }
    setMode(newMode);
  };

  const handleQualityCheck = () => {
    const kind = detectArtifactKind(document.name || document.id || '');
    const issues = validateArtifactQuality(content, kind);
    setQualityIssues(issues);
    setQualityLastCheckedAt(new Date().toLocaleString());

    if (!kind) {
      toast({
        title: 'Quality Check',
        description: 'No artifact guardrails for this document type yet.',
      });
      return;
    }

    if (issues.length === 0) {
      toast({
        title: 'Quality Check Passed',
        description: 'All required sections are present.',
      });
    } else {
      toast({
        title: 'Quality Check Found Gaps',
        description: `${issues.length} required section(s) missing.`,
        variant: 'destructive',
      });
    }
  };

  const handleFixIssues = () => {
    const kind = detectArtifactKind(document.name || document.id || '');
    if (!kind || qualityIssues.length === 0) return;
    
    // Construct prompt for AI
    let prompt = `I ran a quality check on the ${kind} artifact titled '${document.name || document.id}'. The following issues were found:\n`;
    qualityIssues.forEach((issue, idx) => {
      prompt += `${idx + 1}. **${issue.key}**: ${issue.message}\n`;
      if (issue.reason) prompt += `   - *Why it matters*: ${issue.reason}\n`;
      if (issue.suggestion) prompt += `   - *Suggestion*: ${issue.suggestion}\n`;
    });
    prompt += `\nPlease help me fix these issues based on the content of the artifact and best practices for this artifact type. Ask me clarifying questions before rewriting everything.`;
    
    // Dispatch custom event to tell ChatPanel to handle this prompt
    window.dispatchEvent(new CustomEvent('productos:chat-send-prompt', { detail: { prompt } }));
    
    toast({
      title: 'Fix Sent to Chat',
      description: 'Opening AI Chat to help you resolve these quality gaps.',
    });
  };

  if (loading && !content) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading document...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 border-b border-white/5 bg-background/20 backdrop-blur-sm flex items-center justify-between px-3">
        <div className="flex gap-2">
          <Button
            variant={mode === 'view' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('view')}
            className="gap-2 h-7"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </Button>
          <Button
            variant={mode === 'edit' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('edit')}
            className="gap-2 h-7"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            data-testid="artifact-quality-check"
            size="sm"
            variant="outline"
            onClick={handleQualityCheck}
            className="gap-2 h-7"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Quality Check
          </Button>

          {hasChanges && (
            <Button
              size="sm"
              onClick={() => handleSave()}
              disabled={loading}
              className="gap-2 bg-green-600 hover:bg-green-700 h-7"
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {(qualityIssues.length > 0 || qualityLastCheckedAt) && (
        <div className={`px-4 py-3 border-b text-xs space-y-3 ${qualityIssues.length > 0 ? 'border-amber-500/20 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/5'}`} data-testid="artifact-quality-issues">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold text-amber-700 dark:text-amber-300">
              {qualityIssues.length > 0 ? 'Missing required sections:' : 'Quality Check Passed'}
            </div>
            {qualityLastCheckedAt && (
              <div className="text-[10px] opacity-70">Last checked: {qualityLastCheckedAt}</div>
            )}
          </div>

          {qualityIssues.length > 0 ? (
            <>
              <ul className="list-disc ml-5 text-amber-700/90 dark:text-amber-300/90 space-y-2">
                {qualityIssues.map((issue) => (
                  <li key={issue.key}>
                    <div className="font-medium">{issue.message}</div>
                    {issue.reason && <div className="text-[11px] opacity-80 italic mt-0.5 ml-1">Why it matters: {issue.reason}</div>}
                    {issue.suggestion && <div className="text-[11px] opacity-80 mt-0.5 ml-1">How to improve: {issue.suggestion}</div>}
                  </li>
                ))}
              </ul>
              
              <div className="mt-3 pt-2 border-t border-amber-500/10">
                <Button 
                  size="sm" 
                  onClick={handleFixIssues}
                  className="gap-2 h-8 bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm transition-all"
                >
                  <Wand2 className="w-4 h-4" />
                  Fix issues with AI Copilot
                </Button>
              </div>
            </>
          ) : (
            <div className="text-emerald-700 dark:text-emerald-300">All required sections are present for this artifact type.</div>
          )}
        </div>
      )}

      <ScrollArea className="flex-1" ref={scrollRef}>
        {mode === 'view' ? (
          <div className="p-8 prose dark:prose-invert max-w-3xl mx-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto h-full min-h-full px-8 py-6">
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="h-full min-h-full border-0 rounded-none resize-none focus-visible:ring-0 p-0 font-mono text-sm bg-transparent"
              placeholder="Start writing your markdown here..."
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
