import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Code, Save, ShieldCheck, Wand2, Download, PencilLine } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { tauriApi } from '../../api/tauri';
import { useToast } from '@/hooks/use-toast';
import { detectArtifactKind, validateArtifactQuality } from '@/lib/artifactQuality';
import { exportToPptx } from '@/lib/pptxExport';
import RichMarkdownEditor from './RichMarkdownEditor';

const scrollPositions = new Map<string, number>();

interface MarkdownEditorProps {
  document: {
    id: string;
    name: string;
    type: string;
    content?: string;
  };
  projectId?: string;
  aiAutocompleteEnabled?: boolean;
}

type EditorMode = 'rich' | 'raw';

export default function MarkdownEditor({
  document,
  projectId,
}: MarkdownEditorProps) {
  const [content, setContent] = useState(document.content || '');
  const [mode, setMode] = useState<EditorMode>('rich'); // default to rich edit
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qualityIssues, setQualityIssues] = useState<
    Array<{ key: string; message: string; reason?: string; suggestion?: string }>
  >([]);
  const { toast } = useToast();
  const lastChangeTime = useRef<number>(Date.now());
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ────────────────────────────────────────────────────────────────
  // AI Magic Edit
  // ────────────────────────────────────────────────────────────────
  const handleMagicEdit = async (selectedText: string): Promise<string | null> => {
    if (!projectId) return null;
    toast({ title: 'Magic Edit', description: 'Rewriting selected text with AI...' });
    
    // Create a completion request
    const promptContext = `You are an AI editor assisting the user. Rewrite the following text to make it more professional, clear, and fluent, keeping the same core meaning. Output ONLY the rewritten text, without quotes or conversational filler.
    
Original Text:
${selectedText}`;
    
    try {
      const response = await tauriApi.getCompletion([{ role: 'user', content: promptContext }], projectId);
      if (response && response.content) {
        return response.content.trim();
      }
    } catch (e) {
      console.error('Magic Edit API error', e);
      toast({ title: 'Magic Edit Failed', description: String(e), variant: 'destructive' });
    }
    return null;
  };

  // ────────────────────────────────────────────────────────────────
  // Load document
  // ────────────────────────────────────────────────────────────────
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
        setContent(document.content || '');
      } finally {
        setLoading(false);
      }
    };
    loadContent();
    setMode('rich'); // always reset to rich on document switch
  }, [document.id, document.name, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ────────────────────────────────────────────────────────────────
  // Scroll position memory (raw mode only)
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && content && scrollRef.current && mode === 'raw') {
      const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const savedPos = scrollPositions.get(document.id);
        if (savedPos !== undefined) viewport.scrollTop = savedPos;
      }
    }
  }, [document.id, loading, content, mode]);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport || mode !== 'raw') return;
    const handleScroll = () => scrollPositions.set(document.id, viewport.scrollTop);
    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [document.id, mode]);

  // ────────────────────────────────────────────────────────────────
  // Content change handlers
  // ────────────────────────────────────────────────────────────────
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
    lastChangeTime.current = Date.now();
  }, []);

  // ────────────────────────────────────────────────────────────────
  // Auto-save: 25s of idle
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasChanges && !loading) {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        const idleTime = Date.now() - lastChangeTime.current;
        if (idleTime >= 24000) handleSave(true);
      }, 25000);
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [content, hasChanges, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ────────────────────────────────────────────────────────────────
  // Save
  // ────────────────────────────────────────────────────────────────
  const handleSave = async (silent = false) => {
    if (!projectId || !document.name) {
      if (!silent)
        toast({ title: 'Error', description: 'Cannot save: missing project or document name', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await tauriApi.writeMarkdownFile(projectId, document.name, content);
      setHasChanges(false);
      if (!silent) toast({ title: 'Success', description: 'Document saved successfully' });
    } catch (error) {
      console.error('Failed to save document:', error);
      if (!silent) toast({ title: 'Error', description: 'Failed to save document', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // Mode toggle
  // ────────────────────────────────────────────────────────────────
  const handleModeChange = (newMode: EditorMode) => {
    if (newMode === mode) return;
    setMode(newMode);
  };

  // ────────────────────────────────────────────────────────────────
  // Quality check
  // ────────────────────────────────────────────────────────────────
  const handleQualityCheck = () => {
    const kind = detectArtifactKind(document.name || document.id || '');
    const issues = validateArtifactQuality(content, kind);
    setQualityIssues(issues);

    if (!kind) {
      toast({ title: 'Quality Check', description: 'No artifact guardrails for this document type yet.' });
      return;
    }
    if (issues.length === 0) {
      toast({ title: 'Quality Check Passed', description: 'All required sections are present.' });
    } else {
      toast({ title: 'Quality Check Found Gaps', description: `${issues.length} required section(s) missing.`, variant: 'destructive' });
    }
  };

  const handleFixIssues = () => {
    const kind = detectArtifactKind(document.name || document.id || '');
    if (!kind || qualityIssues.length === 0) return;
    let prompt = `I ran a quality check on the ${kind} artifact titled '${document.name || document.id}'. The following issues were found:\n`;
    qualityIssues.forEach((issue, idx) => {
      prompt += `${idx + 1}. **${issue.key}**: ${issue.message}\n`;
      if (issue.reason) prompt += `   - *Why it matters*: ${issue.reason}\n`;
      if (issue.suggestion) prompt += `   - *Suggestion*: ${issue.suggestion}\n`;
    });
    prompt += `\nPlease help me fix these issues. Ask me clarifying questions before rewriting everything.`;
    window.dispatchEvent(new CustomEvent('productos:chat-send-prompt', { detail: { prompt } }));
    toast({ title: 'Fix Sent to Chat', description: 'Opening AI Chat to help you resolve these quality gaps.' });
  };

  // ────────────────────────────────────────────────────────────────
  // Loading skeleton
  // ────────────────────────────────────────────────────────────────
  if (loading && !content) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading document...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="h-10 border-b border-white/5 bg-background/20 backdrop-blur-sm flex items-center justify-between px-3 shrink-0">
        {/* Mode toggle — 2-way: Rich ✎ / Raw MD */}
        <div className="flex items-center gap-1 bg-background/30 rounded-md p-0.5">
          <Button
            variant={mode === 'rich' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('rich')}
            className="gap-1.5 h-7 text-xs"
            title="Rich edit mode — WYSIWYG inline editing"
          >
            <PencilLine className="w-3.5 h-3.5" />
            View & Edit
          </Button>
          <Button
            variant={mode === 'raw' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => handleModeChange('raw')}
            className="gap-1.5 h-7 text-xs"
            title="Raw markdown mode — edit source directly"
          >
            <Code className="w-3.5 h-3.5" />
            RAW file
          </Button>
        </div>

        {/* Right-side actions */}
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

          {/* PPTX Export: shown when the document name or type suggests it's a presentation */}
          {(document.type === 'presentation' || (document.name || '').toLowerCase().includes('presentation')) && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                let brandSettings = undefined;
                if (projectId) {
                  try {
                    const settings = await tauriApi.getProjectSettings(projectId);
                    if (settings?.brand_settings) brandSettings = JSON.parse(settings.brand_settings);
                  } catch (e) {
                    console.error('Failed to load project brand settings', e);
                  }
                }
                const result = await exportToPptx(content, brandSettings, (document.name || document.id).replace('.md', ''));
                if (result.success) {
                  const msg = result.defaultUsed
                    ? 'Downloaded successfully using default brand settings.'
                    : 'Downloaded successfully using project brand settings.';
                  toast({ title: 'PPTX Export Successful', description: msg });
                } else {
                  toast({ title: 'PPTX Export Failed', description: String(result.error), variant: 'destructive' });
                }
              }}
              className="gap-2 h-7"
            >
              <Download className="w-3.5 h-3.5" />
              Download PPTX
            </Button>
          )}

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

      {/* ── Quality issues banner ────────────────────────────────── */}
      {qualityIssues.length > 0 && (
        <div className="px-4 py-2 border-b border-amber-500/20 bg-amber-500/5 text-xs" data-testid="artifact-quality-issues">
          <div className="font-semibold text-amber-700 dark:text-amber-300">Missing required sections:</div>
          <ul className="list-disc ml-5 mt-1 text-amber-700/90 dark:text-amber-300/90">
            {qualityIssues.map((issue) => (
              <li key={issue.key}>
                <div>{issue.message}</div>
                {issue.reason && <div className="opacity-80">Why it matters: {issue.reason}</div>}
                {issue.suggestion && <div className="opacity-80">How to improve: {issue.suggestion}</div>}
              </li>
            ))}
          </ul>
          <div className="mt-3 mb-1">
            <Button
              size="sm"
              onClick={handleFixIssues}
              className="gap-2 h-7 bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm transition-all"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Fix issues with AI
            </Button>
          </div>
        </div>
      )}

      {/* ── Editor area ──────────────────────────────────────────── */}
      {mode === 'rich' ? (
        <div className="flex-1 overflow-hidden relative">
          <RichMarkdownEditor
            content={content}
            onChange={handleContentChange}
            onMagicEdit={handleMagicEdit}
          />
        </div>
      ) : (
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="mx-auto max-w-3xl px-8 py-6">
            <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5 border border-border/50 rounded px-2 py-1 bg-muted/30 w-fit">
              <Code className="w-3 h-3" />
              Editing raw markdown — switch to View & Edit to see formatting
            </div>
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="h-[calc(100vh-220px)] min-h-[400px] border-0 rounded-none resize-none focus-visible:ring-0 p-0 font-mono text-sm bg-transparent"
              placeholder="Start writing your markdown here..."
            />
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
