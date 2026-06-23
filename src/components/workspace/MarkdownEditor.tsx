import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Code, Save, ShieldCheck, Wand2, Download, PencilLine, X, Layout, FileText, Sparkles, MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { appApi } from '@/api/app';
import { telemetryApi, filesApi } from '@/api/server';
import type { Comment } from '@/api/contracts';
import { useToast } from '@/hooks/use-toast';
import { detectArtifactKind, validateArtifactQuality } from '@/lib/artifactQuality';
import { exportToPptx, parseMarkdownToSlides } from '@/lib/pptxExport';
import { useAiCompletion } from '@/hooks/useAiCompletion';
import RichMarkdownEditor from './RichMarkdownEditor';
import CsvViewer from './CsvViewer';
import SlideLayoutEditor from './SlideLayoutEditor';
import { ConfidenceBars } from './ConfidenceBars';

const scrollPositions = new Map<string, number>();

function AIProgressToast() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const duration = 22000; // Estimated duration for AI optimization
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      let nextProgress;
      if (elapsed < duration) {
        nextProgress = Math.round((elapsed / duration) * 88);
      } else if (elapsed < duration * 2) {
        const extraTime = elapsed - duration;
        nextProgress = 88 + Math.round((extraTime / duration) * 8);
      } else {
        nextProgress = 96 + Math.min(2, Math.floor((elapsed - duration * 2) / 6000));
      }
      setProgress(Math.min(98, nextProgress));
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-2.5 w-full min-w-[280px] mt-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Optimizing layouts & pacing...
        </span>
        <span className="font-mono font-bold text-primary">{progress}%</span>
      </div>
      <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden p-[1px] border border-border/10 shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(var(--primary),0.4)]" 
          style={{ width: `${progress}%` }} 
        />
      </div>
    </div>
  );
}

interface MarkdownEditorProps {
  activeDoc: {
    id: string;
    name: string;
    type: string;
    content?: string;
  };
  projectId?: string;
  aiAutocompleteEnabled?: boolean;
  onArtifactUpdate?: () => void;
  artifactKind?: string;
}

type EditorMode = 'rich' | 'raw' | 'layout';

export default function MarkdownEditor({
  activeDoc,
  projectId,
  aiAutocompleteEnabled = false,
  onArtifactUpdate,
  artifactKind,
}: MarkdownEditorProps) {
  const resolvedArtifactKind = artifactKind || detectArtifactKind(activeDoc.name || activeDoc.id || '');
  const [content, setContent] = useState(activeDoc.content || '');
  const [mode, setMode] = useState<EditorMode>('rich');
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qualityIssues, setQualityIssues] = useState<Array<{ key: string; message: string; reason?: string; suggestion?: string }>>([]);
  const [localConfidence, setLocalConfidence] = useState<number>((activeDoc as any).confidence || 0);
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const lastActiveDocIdRef = useRef<string | null>(null);

  // Load comments
  const loadComments = useCallback(async (shouldDecidePanelVisibility = false) => {
    if (!projectId || !activeDoc.name) return;
    try {
      const data = await filesApi.getComments(projectId, activeDoc.name);
      const fetchedComments = data || [];
      setComments(fetchedComments);
      if (shouldDecidePanelVisibility) {
        const openComments = fetchedComments.filter(c => c.status === 'open');
        setShowCommentsPanel(openComments.length > 0);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  }, [projectId, activeDoc.name]);

  // Auto-open/reset comments on document switch
  useEffect(() => {
    if (activeDoc.id !== lastActiveDocIdRef.current) {
      setComments([]);
      lastActiveDocIdRef.current = activeDoc.id;
      loadComments(true);
    }
  }, [activeDoc.id, loadComments]);

  const saveComments = async (updatedComments: Comment[]) => {
    if (!projectId || !activeDoc.name) return;
    try {
      setComments(updatedComments);
      await filesApi.saveComments(projectId, activeDoc.name, updatedComments);
    } catch (err) {
      console.error('Failed to save comments:', err);
      toast({ title: 'Error', description: 'Failed to save comments', variant: 'destructive' });
    }
  };

  useEffect(() => {
    loadComments();
    
    // Listen for file changes or comments updates from chat actions
    const handleFileChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ fileName: string }>;
      if (customEvent.detail?.fileName === activeDoc.name && projectId) {
        loadComments();
        appApi.readMarkdownFile(projectId, activeDoc.name)
          .then(fileContent => {
            setContent(fileContent);
            setHasChanges(false);
          })
          .catch(console.error);
      }
    };
    
    window.addEventListener('productos:file-changed', handleFileChanged);
    return () => window.removeEventListener('productos:file-changed', handleFileChanged);
  }, [activeDoc.name, projectId, loadComments]);

  const lastChangeTime = useRef<number>(Date.now());
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevDocRef = useRef({ id: activeDoc.id, name: activeDoc.name });
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // ────────────────────────────────────────────────────────────────
  // AI Autocomplete Hook
  // ────────────────────────────────────────────────────────────────
  const { suggestion, requestCompletion, dismiss } = useAiCompletion(projectId, aiAutocompleteEnabled);

  const handleAiSuggestionAccepted = (text: string) => {
    // Append the suggestion to current content (simplistic approach for now)
    // In a real Tiptap integration, the editor would handle the insertion
    // But we need to update the parent state too
    const newContent = content + text;
    setContent(newContent);
    setHasChanges(true);
    dismiss();
  };

  // ────────────────────────────────────────────────────────────────
  // AI Magic Edit
  // ────────────────────────────────────────────────────────────────
  const handleMagicEdit = async (selectedText: string): Promise<string | null> => {
    if (!projectId) return null;
    toast({ title: 'Magic Edit', description: 'Rewriting selected text with AI...' });
    
    const promptContext = `You are an AI editor assisting the user. Rewrite the following text to make it more professional, clear, and fluent, keeping the same core meaning. Output ONLY the rewritten text, without quotes or conversational filler.
    
Original Text:
${selectedText}`;
    
    try {
      const response = await appApi.sendMessage([{ role: 'user', content: promptContext }], projectId);
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
      if (!projectId || !activeDoc.name) return;
      try {
        setLoading(true);
        const fileContent = await appApi.readMarkdownFile(projectId, activeDoc.name);
        setContent(fileContent);
        setHasChanges(false);
      } catch (error) {
        console.error('Failed to load document:', error);
        setContent(activeDoc.content || '');
      } finally {
        setLoading(false);
      }
    };
    loadContent();
    setLocalConfidence((activeDoc as any).confidence || 0);
    setMode('rich');
    setQualityIssues([]); // Reset quality check on file switch
    dismiss(); // Clear any pending suggestions on doc switch
  }, [activeDoc.id, activeDoc.name, projectId, (activeDoc as any).confidence]); // eslint-disable-line react-hooks/exhaustive-deps

  // ────────────────────────────────────────────────────────────────
  // Scroll position memory (both modes)
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    // Small delay to ensure content is rendered
    const timer = setTimeout(() => {
      const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') || 
                       window.document.querySelector('[data-rich-editor-viewport="true"]');
      if (viewport) {
        const savedPos = scrollPositions.get(activeDoc.id);
        if (savedPos !== undefined) {
          viewport.scrollTop = savedPos;
        }

        const handleScroll = () => {
          scrollPositions.set(activeDoc.id, (viewport as HTMLElement).scrollTop);
        };
        viewport.addEventListener('scroll', handleScroll);
        return () => viewport.removeEventListener('scroll', handleScroll);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeDoc.id, loading, mode]); // removed 'content' to avoid jumping on every keystroke

  // ────────────────────────────────────────────────────────────────
  // Save on Document Switch
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (prevDocRef.current.id !== activeDoc.id) {
      if (hasChanges && projectId && prevDocRef.current.name) {
        console.log('Auto-saving before switch:', prevDocRef.current.name);
        appApi.writeMarkdownFile(projectId, prevDocRef.current.name, contentRef.current)
          .then(() => {
            telemetryApi.track('file.edited');
          })
          .catch(err => {
            console.error('Failed to auto-save on switch:', err);
          });
      }
      prevDocRef.current = { id: activeDoc.id, name: activeDoc.name };
    }
  }, [activeDoc.id, projectId, hasChanges]);

  // Handle manual tab select updates (if MainPanel passes a choice)
  useEffect(() => {
    // Sync refs when id changes successfully
    prevDocRef.current = { id: activeDoc.id, name: activeDoc.name };
  }, [activeDoc.id, activeDoc.name]);

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
    if (!projectId || !activeDoc.name) {
      if (!silent)
        toast({ title: 'Error', description: 'Cannot save: missing project or document name', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await appApi.writeMarkdownFile(projectId, activeDoc.name, content);
      setHasChanges(false);
      telemetryApi.track('file.edited');
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
    if (hasChanges) handleSave(true);
    setMode(newMode);
    if (newMode === 'raw') dismiss();
  };

  // ────────────────────────────────────────────────────────────────
  // Quality check
  // ────────────────────────────────────────────────────────────────
  const handleQualityCheck = () => {
    const kind = resolvedArtifactKind;
    const issues = validateArtifactQuality(content, kind as any);
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
    const kind = resolvedArtifactKind;
    if (!kind || qualityIssues.length === 0) return;
    let prompt = `I ran a quality check on the ${kind} artifact titled '${activeDoc.name || activeDoc.id}'. The following issues were found in the file "${activeDoc.name}":\n\n`;
    qualityIssues.forEach((issue, idx) => {
      prompt += `${idx + 1}. **${issue.key}**: ${issue.message}\n`;
      if (issue.reason) prompt += `   - *Why it matters*: ${issue.reason}\n`;
      if (issue.suggestion) prompt += `   - *Suggestion*: ${issue.suggestion}\n`;
    });
    prompt += `\nPlease help me fix these issues in the file "${activeDoc.name}". Ask me clarifying questions before rewriting everything.`;
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

  const isCsv = activeDoc.name?.toLowerCase().endsWith('.csv');

  if (isCsv) {
    return (
      <div className="flex h-full flex-col bg-background/30">
        <header className="sticky top-0 z-20 flex-none border-b border-white/10 bg-background/45 px-4 py-3 backdrop-blur-xl">
          <div className="flex flex-col items-start gap-1 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <FileText className="h-3 w-3" />
              CSV Viewer
            </div>
          <input
            className="w-full border-none bg-transparent p-0 text-lg font-bold text-foreground outline-none focus:ring-0"
            value={activeDoc.name}
            readOnly
          />
          </div>
        </header>
        <div className="flex-1 overflow-hidden">
          <CsvViewer content={content} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background/20">
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      {(() => {
        const artifactKind = resolvedArtifactKind;
        const isArtifact = !!artifactKind;
        const isPresentation = artifactKind === 'presentation';

        return (
          <div className="shrink-0 h-12 border-b border-border bg-background flex items-center px-6 relative z-10">
            <div className="flex w-full items-center justify-between gap-3">
            {/* Left info - will shrink and truncate if space is tight */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="hidden lg:flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-foreground">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-foreground">{activeDoc.name}</div>
              </div>
            </div>

            {/* Mode toggle switcher - shrink-0 to prevent squishing */}
            <div className="flex items-center gap-1 rounded border border-border bg-muted/30 p-0.5 shrink-0">
              <Button
                variant={mode === 'rich' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleModeChange('rich')}
                className="h-7 gap-1.5 rounded px-2.5 text-2xs whitespace-nowrap"
                title="Rich edit mode — WYSIWYG inline editing"
              >
                <PencilLine className="w-3 h-3" />
                View & Edit
              </Button>

              {/* For presentations, prefer "Edit Layout" (with text) and show "RAW file" as square icon-only */}
              {isPresentation ? (
                <>
                  <Button
                    variant={mode === 'raw' ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={() => handleModeChange('raw')}
                    className="h-7 w-7 rounded"
                    title="Raw markdown mode — edit source directly"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={mode === 'layout' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => handleModeChange('layout')}
                    className="h-7 gap-1.5 rounded px-2.5 text-2xs whitespace-nowrap"
                    title="Visual Layout Editor"
                  >
                    <Layout className="w-3 h-3 text-primary" />
                    Edit Layout
                  </Button>
                </>
              ) : (
                <Button
                  variant={mode === 'raw' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleModeChange('raw')}
                  className="h-7 gap-1.5 rounded px-2.5 text-2xs whitespace-nowrap"
                  title="Raw markdown mode — edit source directly"
                >
                  <Code className="w-3 h-3" />
                  RAW file
                </Button>
              )}
            </div>

            {/* Right-side actions - shrink-0 to prevent wrapping and squishing */}
            <div className="flex items-center gap-2 justify-end shrink-0">
              <Button
                size="sm"
                variant={showCommentsPanel ? 'secondary' : 'outline'}
                onClick={() => setShowCommentsPanel(!showCommentsPanel)}
                className={`h-8 gap-2 rounded border border-border bg-background hover:bg-muted whitespace-nowrap ${showCommentsPanel ? 'text-amber-500 border-amber-500/30 bg-amber-500/5 font-semibold' : 'text-foreground'}`}
                title="Toggle Comments Panel"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Comments ({comments.filter(c => c.status === 'open').length})
              </Button>
              {comments.filter(c => c.status === 'open').length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const openComments = comments.filter(c => c.status === 'open');
                    window.dispatchEvent(new CustomEvent('productos:resolve-all-comments', {
                      detail: { projectId, fileName: activeDoc.name, comments: openComments }
                    }));
                    toast({ title: 'Fix Sent to Chat', description: 'Aggregating feedback and streaming to AI Chat...' });
                  }}
                  className="h-8 gap-2 rounded border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 font-semibold animate-pulse whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Fix All Comments ({comments.filter(c => c.status === 'open').length})
                </Button>
              )}

              {isArtifact && (
                isPresentation ? (
                  <Button
                    data-testid="artifact-quality-check"
                    size="icon"
                    variant="outline"
                    onClick={handleQualityCheck}
                    className="h-8 w-8 rounded border border-border bg-background hover:bg-muted text-foreground"
                    title="Quality Check"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    data-testid="artifact-quality-check"
                    size="sm"
                    variant="outline"
                    onClick={handleQualityCheck}
                    className="h-8 gap-2 rounded border border-border bg-background hover:bg-muted text-foreground whitespace-nowrap"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Quality Check
                  </Button>
                )
              )}

              {/* PPTX Export */}
              {isPresentation && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    let brandSettings = undefined;
                    if (projectId) {
                      try {
                        const settings = await appApi.getProjectSettings(projectId);
                        if (settings?.brand_settings) {
                          brandSettings = JSON.parse(settings.brand_settings);
                        }
                      } catch (e) {
                        console.error('Failed to load project brand settings', e);
                      }
                    }

                    const progressToast = toast({
                      title: 'Preparing PPTX',
                      description: <AIProgressToast />,
                      duration: 999999,
                    });
                    
                    try {
                      let slidesDataToExport: any = content;
                      const isJsonFile = activeDoc.name?.toLowerCase().endsWith('.json');

                      if (isJsonFile) {
                        try {
                          const parsed = JSON.parse(content);
                          if (Array.isArray(parsed)) {
                            slidesDataToExport = parsed;
                          } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.slides)) {
                            slidesDataToExport = parsed.slides;
                          } else if (parsed) {
                            slidesDataToExport = [parsed];
                          }
                        } catch (err) {
                          console.error('Failed to parse JSON presentation content', err);
                        }
                      } else if (content.trim().length > 100) {
 // Step 1: Parse the markdown into its natural sections FIRST.
                      // This is the authoritative slide count — same as "Edit Layout" uses.
                      // parseMarkdownToSlides now builds speakerNotes in document order
                      // (bodyText and bullets interleaved as written, not grouped separately).
                        const parsedSections = parseMarkdownToSlides(content);
                        const slideCount = parsedSections.length;

                        if (slideCount > 0) {
                        // CRITICAL: Set a SAFE FALLBACK immediately before trying the AI.
                        // Display shows first 4 bullets; all original content (in document order)
                        // is already in s.speakerNotes from the parser — no re-assembly needed.
                          slidesDataToExport = parsedSections.map(s => ({
                            title: s.title,
                            layoutHint: s.layoutHint,
                            // speakerNotes already contains full content in document order
                            speakerNotes: s.speakerNotes || '',
                            fullText: s.speakerNotes || '',
                            bullets: s.bullets.slice(0, 4),
                            subBullets: s.subBullets,
                            bodyText: s.bodyText.slice(0, 2),
                            items: [],
                            startLine: s.startLine
                          }));

                         // Step 2: If we have a project context, try AI optimization.
                          // The AI's ONLY job is: pick the best layout + write 3-4 summary bullets.
                          // It NEVER touches speaker notes — those always come from the original text.
                          if (projectId) {
                            try {
                              // Send full ordered content so the AI can make good layout/summary decisions.
                              // We do NOT need to cap per-slide content here because notes are assembled
                              // independently — the AI response cannot overwrite them.
                              const sectionsForAI = parsedSections.map((s, i) => ({
                                slideIndex: i,
                                title: s.title,
                                // Use the ordered notes text (bullets + body interleaved) as the source of truth
                                content: s.speakerNotes || ''
                              }));

                              const promptContext = `You are an expert presentation designer.
You are given ${slideCount} slides extracted from a presentation document.

TASK: For each slide, choose the best visual layout and write a SHORT on-slide summary.
The full content will always be preserved in speaker notes separately — do NOT include it in your response.

RULES (non-negotiable):
1. Return EXACTLY ${slideCount} JSON objects in the same order as input.
2. Do NOT add, split, merge, or reorder slides.
3. Do NOT return speakerNotes, fullText, or any original content — those are handled separately.
4. For each slide output these fields only:
   - "title": Keep as-is or trim to ≤8 words. REQUIRED.
   - "layoutHint": Choose the BEST layout from: 'title', 'section', 'split', 'columns', 'comparison', 'timeline'. REQUIRED.
     • Use 'title' only for the first/cover slide.
     • Use 'section' for transition/divider slides with little content.
     • Use 'columns' when there are 3-4 independent parallel items (features, options, pillars).
     • Use 'comparison' when exactly two things are being compared side-by-side.
     • Use 'timeline' when content contains chronological milestones or dated events.
     • Use 'split' (default) for most content slides with a clear title + supporting points.
   - "bullets": Array of 3-4 concise summary strings (each ≤10 words). Capture the KEY takeaways only.
     Use [] for 'section' or 'title' slides.
   - "bodyText": Array with at most 1 kicker sentence (≤15 words) — the single most important idea.
     Use [] for 'section', 'title', 'columns', 'comparison', or 'timeline' slides.
   - "items": ONLY for 'columns' layout: array of {title, summaryBullets[]} objects.
     ONLY for 'timeline' layout: array of {year, title, summary} objects.
     Omit this field for all other layouts.

Input:
${JSON.stringify(sectionsForAI, null, 2)}

Respond ONLY with a raw JSON array of exactly ${slideCount} objects. No markdown fences, no explanation.`;

                              const response = await appApi.sendMessage(
                                [{ role: 'user', content: promptContext }],
                                projectId
                              );

                              if (response?.content) {
                                let rawText = response.content.trim();
                              // Robust JSON extraction: find outermost [ ... ]
                                const startIdx = rawText.indexOf('[');
                                const endIdx = rawText.lastIndexOf(']');
                                if (startIdx !== -1 && endIdx > startIdx) {
                                  rawText = rawText.substring(startIdx, endIdx + 1);
                                } else if (rawText.startsWith('```')) {
                                  rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                                }

                                let jsonSlides: any[] | null = null;
                                try {
                                  const parsed = JSON.parse(rawText);
                                  if (Array.isArray(parsed) && parsed.length > 0) {
                                    jsonSlides = parsed;
                                  }
                                } catch (parseErr) {
                                  console.warn('AI pipeline: JSON.parse failed, using fallback', parseErr);
                                }

                                if (jsonSlides && jsonSlides.length > 0) {
                                  // Merge AI layout/summary decisions with original ordered notes.
                                  const aiSlides = parsedSections.map((originalSection, idx) => {
                                    const aiSlide = jsonSlides![idx];
                                    if (!aiSlide) {
                                      // Fall back to the safe truncated version already set
                                      return (slidesDataToExport as any[])[idx];
                                    }

                                    const subBullets = new Map<number, string[]>();
                                    (aiSlide.items || []).forEach((item: any, i: number) => {
                                      if (Array.isArray(item.summaryBullets)) {
                                        subBullets.set(i, item.summaryBullets);
                                      }
                                    });

                                    // ALWAYS use the parser-built ordered notes — never the AI output.
                                    // This guarantees full content in document order is preserved.
                                    const orderedNotes = originalSection.speakerNotes || '';

                                    return {
                                      title: aiSlide.title || originalSection.title,
                                      layoutHint: aiSlide.layoutHint || 'split',
                                      // Notes come from the original document, not the AI
                                      speakerNotes: orderedNotes,
                                      fullText: orderedNotes,
                                      bullets: aiSlide.items
                                        ? aiSlide.items.map((item: any) =>
                                            item.year ? `${item.year} - ${item.title || ''}` : (item.title || '')
                                          )
                                        : (aiSlide.bullets || []),
                                      subBullets,
                                      bodyText: aiSlide.bodyText || [],
                                      items: aiSlide.items || [],
                                      startLine: originalSection.startLine
                                    };
                                  });

                                slidesDataToExport = aiSlides;
                              } else {
                                toast({
                                  title: 'AI Optimization Skipped',
                                  description: `Exported ${slideCount} slides with original structure. AI returned unexpected format.`
                                });
                              }
                            }
                          } catch (err) {
                            console.error('LLM Reduction Pipeline failed, using truncated fallback', err);
                            toast({
                              title: 'AI Optimization Skipped',
                              description: `Exported ${slideCount} slides with original structure.`
                            });
                          }
                        }
                      }
                      // (if slideCount === 0, slidesDataToExport stays as content string)
                    }


                      const result = await exportToPptx(slidesDataToExport, brandSettings, (activeDoc.name || activeDoc.id).replace('.md', ''));
                      progressToast.dismiss();

                      if (result.success) {
                        const msg = result.defaultUsed 
                          ? 'Downloaded successfully using default brand settings.' 
                          : 'Downloaded successfully using project brand settings.';
                        toast({ title: 'PPTX Export Successful', description: msg });
                      } else {
                        toast({ title: 'PPTX Export Failed', description: String(result.error), variant: 'destructive' });
                      }
                    } catch (error) {
                      progressToast.dismiss();
                      console.error('PPTX export error:', error);
                      toast({ title: 'PPTX Export Failed', description: String(error), variant: 'destructive' });
                    }
                  }}
                  className="h-8 gap-2 rounded border border-border bg-background hover:bg-muted text-foreground whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PPTX
                </Button>
              )}

              {isArtifact && (
                <div className="flex h-8 shrink-0 items-center gap-2 rounded border border-border bg-background px-2.5">
                  <span className="text-[10px] text-muted-foreground font-medium mr-1 uppercase tracking-tighter">Confidence</span>
                  <ConfidenceBars 
                    value={localConfidence} 
                    onChange={async (val) => {
                      if (projectId && activeDoc.id) {
                        setLocalConfidence(val);
                        try {
                           const kind = resolvedArtifactKind;
                           if (kind) {
                            const baseId = activeDoc.id.split('/').pop()?.replace('.md', '') || activeDoc.id;
                            await appApi.updateArtifactMetadata(projectId, kind as any, baseId, undefined, val);
                            toast({ title: 'Confidence Updated', description: `Level set to ${Math.round(val * 100)}%` });
                            if (onArtifactUpdate) onArtifactUpdate();
                          }
                        } catch (e) {
                          console.error('Failed to update confidence', e);
                        }
                      }
                    }}
                  size="sm"
                />
                </div>
              )}

              {hasChanges && (
                <Button
                  size="sm"
                  onClick={() => handleSave()}
                  disabled={loading}
                  className="h-8 gap-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  {loading ? 'Saving...' : 'Save'}
                </Button>
              )}
            </div>
          </div>
          </div>
        );
      })()}

      {/* ── Quality issues banner ────────────────────────────────── */}
      {qualityIssues.length > 0 && (
        <div className="relative group animate-in fade-in slide-in-from-top-1 duration-200 border-b border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs backdrop-blur-xl">
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-amber-700 dark:text-amber-300">Missing required sections:</div>
            <button 
              onClick={() => setQualityIssues([])}
              className="p-1 hover:bg-amber-500/10 rounded-full transition-colors text-amber-700/50 hover:text-amber-700 dark:text-amber-300/50 dark:hover:text-amber-300"
              title="Close banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="list-disc ml-5 mt-1 text-amber-700/90 dark:text-amber-300/90">
            {qualityIssues.map((issue) => (
              <li key={issue.key}>{issue.message}</li>
            ))}
          </ul>
          <div className="mt-2">
            <Button size="sm" onClick={handleFixIssues} className="h-6 text-[10px] bg-amber-600 hover:bg-amber-700 text-white">
              <Wand2 className="w-3 h-3 mr-1" />
              Fix with AI
            </Button>
          </div>
        </div>
      )}

      {/* ── Editor area ──────────────────────────────────────────── */}
      {mode === 'rich' ? (
        <div className="relative flex-1 overflow-hidden bg-transparent border-0 shadow-none mx-0 my-0">
          <RichMarkdownEditor
            content={content}
            onChange={handleContentChange}
            onMagicEdit={handleMagicEdit}
            aiSuggestion={suggestion}
            onAiSuggestionAccepted={handleAiSuggestionAccepted}
            onAiSuggestionDismissed={dismiss}
            onContextChange={requestCompletion}
            projectId={projectId}
            fileName={activeDoc.name}
            comments={comments}
            onSaveComments={saveComments}
            showCommentsPanel={showCommentsPanel}
            onToggleCommentsPanel={setShowCommentsPanel}
          />
        </div>
      ) : mode === 'layout' ? (
        <div className="relative flex-1 overflow-hidden bg-transparent border-0 shadow-none mx-0 my-0">
          <SlideLayoutEditor
            content={content}
            onChange={handleContentChange}
          />
        </div>
      ) : (
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="mx-auto max-w-3xl px-6 py-8">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <Code className="w-3 h-3" />
              Editing raw markdown
            </div>
            <div className="rounded border border-border bg-background px-5 py-5 shadow-sm">
              <Textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                className="h-[calc(100vh-260px)] min-h-[420px] resize-none border-0 bg-transparent p-0 font-mono text-sm focus-visible:ring-0"
                placeholder="Start writing your markdown here..."
              />
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
