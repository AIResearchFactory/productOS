import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Code, Save, ShieldCheck, Wand2, Download, PencilLine, X, Layout, FileText, Sparkles, MessageSquare, ChevronDown, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { appApi } from '@/api/app';
import { telemetryApi, filesApi, presentationApi } from '@/api/server';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Comment } from '@/api/contracts';
import { useToast } from '@/hooks/use-toast';
import { detectArtifactKind, validateArtifactQuality } from '@/lib/artifactQuality';
import { exportToPptx, parseMarkdownToSlides } from '@/lib/pptxExport';
import { extractAndParseJson } from '@/lib/jsonUtils';
import { useAiCompletion } from '@/hooks/useAiCompletion';
import RichMarkdownEditor from './RichMarkdownEditor';
import CsvViewer from './CsvViewer';
import SlideLayoutEditor from './SlideLayoutEditor';
import { ConfidenceBars } from './ConfidenceBars';
import { CriticReviewDrawer } from './CriticReviewDrawer';
import { criticApi } from '@/api/server';
import { trackEvent } from '@/lib/telemetry';
import type { CriticFinding, CriticAuditResult } from '@/types/socratic';


const scrollPositions = new Map<string, number>();

function AIProgressToast() {
  const [progress, setProgress] = useState(0);
  const [spinnerFrame, setSpinnerFrame] = useState(0);

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

  useEffect(() => {
    const spinInterval = setInterval(() => {
      setSpinnerFrame(f => (f + 1) % 10);
    }, 150);
    return () => clearInterval(spinInterval);
  }, []);

  const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const spinner = spinnerChars[spinnerFrame];

  // Adding funny PM steps for the progress
  const PM_STEPS = [
    { label: "Aligning on 'North Star' vision", minProgress: 0 },
    { label: "Prioritizing via random RICE scoring", minProgress: 15 },
    { label: "Maximizing AI buzzword density", minProgress: 35 },
    { label: "Optimizing layouts for the HIPPO", minProgress: 55 },
    { label: "Reframing bugs as 'future roadmap'", minProgress: 75 },
    { label: "Adding decorative upward growth arrows", minProgress: 90 },
    { label: "Renaming to Presentation_FINAL_v2.pptx", minProgress: 96 }
  ];

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
          className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_hsl(var(--primary)/0.4)]" 
          style={{ width: `${progress}%` }} 
        />
      </div>

      {/* Claude Code style thinking terminal */}
      <div className="mt-1 p-2.5 rounded border border-border/40 bg-zinc-950/90 dark:bg-black/60 font-mono text-[10px] text-zinc-300 leading-normal shadow-inner flex flex-col gap-1">
        {PM_STEPS.map((step, idx) => {
          const isDone = progress >= (PM_STEPS[idx + 1]?.minProgress ?? 101);
          const isActive = progress >= step.minProgress && !isDone;

          if (isDone) {
            return (
              <div key={idx} className="flex items-center gap-2 text-emerald-500/80 dark:text-emerald-400/80">
                <span className="text-[9px] font-bold">✔</span>
                <span className="line-through opacity-70">{step.label}</span>
              </div>
            );
          } else if (isActive) {
            return (
              <div key={idx} className="flex items-center gap-2 text-amber-500 dark:text-amber-400 font-semibold">
                <span className="text-[9px]">{spinner}</span>
                <span>{step.label}...</span>
              </div>
            );
          } else {
            return (
              <div key={idx} className="flex items-center gap-2 text-muted-foreground/50">
                <span className="text-[9px] font-bold">◦</span>
                <span>{step.label}</span>
              </div>
            );
          }
        })}
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
  const [isCriticDrawerOpen, setIsCriticDrawerOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [criticAuditResult, setCriticAuditResult] = useState<CriticAuditResult | null>(null);
  const [localConfidence, setLocalConfidence] = useState<number>((activeDoc as any).confidence || 0);

  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [hasCustomTemplate, setHasCustomTemplate] = useState<boolean>(false);
  const lastActiveDocIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setHasCustomTemplate(false);
      return;
    }
    presentationApi.getBrandConfig(projectId)
      .then(res => setHasCustomTemplate(res.hasCustomTemplate))
      .catch(() => setHasCustomTemplate(false));
  }, [projectId]);

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

  const getAiEnhancedSlides = async (contentStr: string) => {
    let slidesDataToExport: any = contentStr;
    const isJsonFile = activeDoc.name?.toLowerCase().endsWith('.json');

    if (isJsonFile) {
      try {
        const parsed = JSON.parse(contentStr);
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
      return slidesDataToExport;
    }

    if (contentStr.trim().length <= 100) return slidesDataToExport;

    const parsedSections = parseMarkdownToSlides(contentStr);
    const slideCount = parsedSections.length;

    if (slideCount === 0) return slidesDataToExport;

    slidesDataToExport = parsedSections.map(s => ({
      title: s.title,
      layoutHint: s.layoutHint,
      speakerNotes: s.speakerNotes || '',
      fullText: s.speakerNotes || '',
      bullets: s.bullets,
      subBullets: s.subBullets,
      bodyText: s.bodyText,
      items: s.items || [],
      elements: s.elements || [],
      startLine: s.startLine
    }));

    if (!projectId) return slidesDataToExport;

    try {
      const sectionsForAI = parsedSections.map((s, i) => ({
        slideIndex: i,
        title: s.title,
        content: s.speakerNotes || ''
      }));

      const titleText = (activeDoc.name || activeDoc.id || "").toLowerCase();
      const firstSlideTitle = parsedSections[0]?.title?.toLowerCase() || "";
      const fullContentLower = contentStr.toLowerCase();

      let styleInstruction = "Style: Professional business style. Clean layouts, structured bullets, clear hierarchy.";

      if (titleText.includes("executive") || firstSlideTitle.includes("executive") || fullContentLower.includes("executive summary")) {
        styleInstruction = "Style: Executive summary deck - minimalist style, large visuals, max 3 bullets per slide, story-driven narrative, McKinsey-level polish.";
      } else if (titleText.includes("pitch") || titleText.includes("vc") || titleText.includes("investor") || titleText.includes("funding") || firstSlideTitle.includes("pitch") || fullContentLower.includes("venture capital") || fullContentLower.includes("investor pitch")) {
        styleInstruction = "Style: Create a venture capital pitch style deck - very clean, high-contrast, big numbers, memorable visuals, strong problem-solution-investment ask arc.";
      } else if (titleText.includes("technical") || titleText.includes("r&d") || titleText.includes("developer") || titleText.includes("architecture") || titleText.includes("engineering") || titleText.includes("code") || fullContentLower.includes("technical architecture") || fullContentLower.includes("engineering roadmap")) {
        styleInstruction = "Style: Technical / R&D / Dev style - elegant, data-heavy but readable, with structured layouts suitable for architectural diagrams/flows.";
      } else if (titleText.includes("conference") || titleText.includes("keynote") || titleText.includes("customer") || titleText.includes("external") || titleText.includes("client") || titleText.includes("public") || firstSlideTitle.includes("conference") || fullContentLower.includes("external presentation")) {
        styleInstruction = "Style: Conference or customer-facing (external) style - high visual impact, bold headers, clear statements, story-driven narrative.";
      }

      const promptContext = `Act as a senior presentation designer who has worked at McKinsey / Apple / top VC pitch deck creators.
You are given ${slideCount} slides extracted from a presentation document.

DESIGN DIRECTIVE:
${styleInstruction}

Follow modern best practices:
- 10/20/30 rule awareness (but adapt to content)
- Slide slogan technique: Title = main message/takeaway, not just a generic label.
- Visual metaphor when appropriate
- High signal-to-noise ratio
- Eliminate bullet-point crime: use punchy, impact-driven sentences, never generic walls of text.

TASK: For each slide, choose the best visual layout, write a SHORT on-slide summary, and define visual layout attributes.
The full content will always be preserved in speaker notes separately — do NOT include it in your response.

RULES (non-negotiable):
1. Return EXACTLY ${slideCount} JSON objects in the same order as input.
2. Do NOT add, split, merge, or reorder slides.
3. Do NOT return speakerNotes, fullText, or any original content — those are handled separately.
4. For each slide output these fields only:
   - "slideIndex": The integer index from the input. REQUIRED.
   - "title": Keep as-is or trim to <=8 words, applying the "slide slogan technique". REQUIRED.
   - "layoutHint": Choose the BEST layout from: 'title', 'section', 'split', 'columns', 'comparison', 'timeline', 'image', 'spotlight'. REQUIRED.
      • Use 'title' only for the first/cover slide.
      • Use 'section' for transition/divider slides.
      • Use 'columns' when there are 3-4 independent parallel items (features, options, pillars).
      • Use 'comparison' when exactly two things/lists are being compared side-by-side.
      • Use 'timeline' when content contains chronological milestones or dated events.
      • Use 'spotlight' when the slide focuses on a single massive metric, number, or key statement.
      • Use 'split' (default) for most content slides with a clear title + supporting points.
   - "bullets": Array of 2-5 concise summary strings (each <=10 words). Capture the KEY takeaways only. Limit to 3 bullets if target style is minimalist. Use [] for 'section' or 'title' slides.
   - "bodyText": Array with at most 1 kicker sentence (<=15 words) — the single most important idea. Use [] for 'section', 'title', 'columns', 'comparison', or 'timeline' slides.
   - "items": ONLY for 'columns' layout: array of {title, summaryBullets[]} objects.
     ONLY for 'timeline' layout: array of {year, title, summary} objects.
     Omit this field for all other layouts.
   - "dominantVisualElement": A short description (<=8 words) of the primary visual element.
   - "primaryColorEmphasis": Suggest background color contrast mode for the slide ('light', 'dark', 'accent').
   - "emotionalTone": Emotional tone of the slide.
5. Every slide in the input is distinct and MUST be processed. Do not skip, drop, or merge slides.
6. For the "items" field in 'columns' layout: group parallel bullet points under their respective header or category. Do not list bullets as separate column titles; group them.
7. For the "items" field in 'timeline' layout: extract all milestones/events from the content.
8. For 'comparison' layout: use when comparing exactly two categories/lists.
9. Do NOT omit any distinct header, section, or category present in the slide content.

Input:
${JSON.stringify(sectionsForAI, null, 2)}

Respond ONLY with a raw JSON array of exactly ${slideCount} objects. No markdown fences, no explanation.`;

      const response = await appApi.sendMessage([{ role: 'user', content: promptContext }], projectId);

      if (response?.content) {
        let jsonSlides: any[] | null = null;
        try {
          const parsed = extractAndParseJson(response.content);
          if (Array.isArray(parsed) && parsed.length > 0) jsonSlides = parsed;
        } catch (parseErr) {
          console.warn('AI pipeline: JSON parsing failed, using fallback', parseErr);
        }

        if (jsonSlides && jsonSlides.length > 0) {
          slidesDataToExport = parsedSections.map((originalSection, idx) => {
            const aiSlide = jsonSlides!.find((s: any) => s && Number.isInteger(Number(s.slideIndex)) && Number(s.slideIndex) === idx) ||
              (jsonSlides![idx] && (jsonSlides![idx].slideIndex === undefined || jsonSlides![idx].slideIndex === null) ? jsonSlides![idx] : null);

            if (!aiSlide) return slidesDataToExport[idx];

            const subBullets = new Map<number, string[]>();
            const aiItems = Array.isArray(aiSlide.items) ? aiSlide.items : [];
            aiItems.forEach((item: any, i: number) => {
              const bulletList = item.summaryBullets || item.bullets || item.summary || [];
              if (Array.isArray(bulletList)) subBullets.set(i, bulletList);
              else if (typeof bulletList === 'string') subBullets.set(i, [bulletList]);
            });

            const orderedNotes = originalSection.speakerNotes || '';
            const aiElements: any[] = [];
            (aiSlide.bodyText || []).forEach((t: string) => aiElements.push({ type: 'paragraph', text: t, isLabel: t.includes(':') && t.length < 60, isGoal: t.toLowerCase().startsWith('goal:') }));
            
            const parsedBullets = aiItems.length > 0 ? aiItems.map((item: any) => item.year ? `${item.year} - ${item.title || ''}` : (item.title || '')) : (Array.isArray(aiSlide.bullets) ? aiSlide.bullets : []);
            parsedBullets.forEach((b: string, idx: number) => {
              const subs = subBullets.get(idx) || [];
              aiElements.push({ type: 'bullet', text: b, indentLevel: 0, subBullets: subs });
            });

            return {
              title: aiSlide.title || originalSection.title,
              layoutHint: aiSlide.layoutHint || 'split',
              speakerNotes: orderedNotes,
              fullText: orderedNotes,
              bullets: parsedBullets,
              subBullets,
              bodyText: aiSlide.bodyText || [],
              items: aiSlide.items || [],
              elements: aiElements,
              startLine: originalSection.startLine,
              dominantVisualElement: aiSlide.dominantVisualElement || '',
              primaryColorEmphasis: aiSlide.primaryColorEmphasis || 'light',
              emotionalTone: aiSlide.emotionalTone || ''
            };
          });
        } else {
          toast({ title: 'AI Optimization Skipped', description: `Exported ${slideCount} slides with original structure. AI returned unexpected format.` });
        }
      }
    } catch (err) {
      console.error('LLM Reduction Pipeline failed, using truncated fallback', err);
      toast({ title: 'AI Optimization Skipped', description: `Exported ${slideCount} slides with original structure.` });
    }
    return slidesDataToExport;
  };

  // ────────────────────────────────────────────────────────────────
  // Keyboard Shortcut: Cmd+Shift+Q / Ctrl+Shift+Q for Quality Check
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        handleQualityCheck('shortcut');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, resolvedArtifactKind, projectId, activeDoc]);

  const handleQualityCheck = async (source = 'toolbar_button') => {
    const kind = resolvedArtifactKind;
    const issues = validateArtifactQuality(content, kind as any);
    setQualityIssues(issues);

    setIsCriticDrawerOpen(true);
    setIsAuditing(true);
    trackEvent('critic.audit_triggered', {
      artifactType: kind || 'spec',
      source,
      criticsCount: 3,
    });

    try {
      const result = await criticApi.auditArtifact({
        projectId,
        artifactPath: activeDoc.name,
        content,
        artifactType: kind || 'spec',
        source,
      });
      setCriticAuditResult(result);
      const criticalCount = (result.findings || []).filter((f: CriticFinding) => f.severity === 'critical').length;
      trackEvent('critic.audit_completed', {
        artifactType: kind || 'spec',
        overallScore: result.overallScore,
        findingsCount: (result.findings || []).length,
        criticalCount,
        durationMs: result.durationMs || 0,
      });
    } catch (err: any) {
      console.error('Adversarial audit failed, relying on local rules:', err);
      // Fallback: create findings from local structural issues
      const fallbackFindings: CriticFinding[] = issues.map((iss, idx) => ({
        id: `local-gap-${idx}`,
        critic: 'devils_pm',
        severity: 'critical',
        title: `Missing Section: ${iss.key}`,
        description: iss.message + (iss.reason ? ` - ${iss.reason}` : ''),
        suggestedFix: iss.suggestion ? `## ${iss.key}\n${iss.suggestion}` : `## ${iss.key}\n`,
        targetSection: iss.key,
      }));
      setCriticAuditResult({
        summary: `Audited with local rules. ${fallbackFindings.length} issue(s) identified.`,
        overallScore: Math.max(0, 100 - fallbackFindings.length * 15),
        findings: fallbackFindings,
      });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleApplyCriticFix = async (finding: CriticFinding) => {
    let updated = content;
    if (finding.quote && content.includes(finding.quote)) {
      updated = content.replace(finding.quote, finding.suggestedFix);
    } else if (finding.targetSection && content.includes(finding.targetSection)) {
      const sectionIndex = content.indexOf(finding.targetSection);
      const endOfHeader = content.indexOf('\n', sectionIndex);
      if (endOfHeader !== -1) {
        updated = content.slice(0, endOfHeader + 1) + `\n${finding.suggestedFix}\n` + content.slice(endOfHeader + 1);
      } else {
        updated = content + `\n\n${finding.suggestedFix}\n`;
      }
    } else {
      updated = content + `\n\n${finding.suggestedFix}\n`;
    }

    setContent(updated);
    setHasChanges(true);
    if (projectId && activeDoc.name) {
      await appApi.writeMarkdownFile(projectId, activeDoc.name, updated).catch(console.error);
      setHasChanges(false);
    }

    if (projectId) {
      await criticApi.sendFeedback({
        projectId,
        feedbackType: 'critic_resolution',
        data: {
          findingId: finding.id,
          action: 'applied',
          critic: finding.critic,
          severity: finding.severity,
          finding,
        }
      }).catch(console.error);
    }

    trackEvent('critic.fix_applied', {
      critic: finding.critic,
      severity: finding.severity,
    });

    toast({
      title: 'Fix Applied',
      description: 'Document updated and saved to project memory.',
    });
  };

  const handleDismissCriticFinding = (findingId: string, finding: CriticFinding) => {
    if (projectId) {
      criticApi.sendFeedback({
        projectId,
        feedbackType: 'critic_resolution',
        data: {
          findingId,
          action: 'dismissed',
          critic: finding.critic,
          severity: finding.severity,
          finding,
        }
      }).catch(console.error);
    }

    trackEvent('critic.finding_dismissed', {
      critic: finding.critic,
      severity: finding.severity,
    });
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
                    onClick={() => handleQualityCheck('toolbar_button')}
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
                    onClick={() => handleQualityCheck('toolbar_button')}
                    className="h-8 gap-2 rounded border border-border bg-background hover:bg-muted text-foreground whitespace-nowrap"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Quality Check
                  </Button>
                )
              )}

              {/* PPTX Export */}
              {isPresentation && (
                hasCustomTemplate ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded border border-border bg-background hover:bg-muted text-foreground text-xs font-medium whitespace-nowrap">
                        <Download className="w-3.5 h-3.5" />
                        Download PPTX
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-0.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuItem
                        onClick={async () => {
                          const progressToast = toast({
                            title: 'Generating Presentation',
                            description: <AIProgressToast />,
                            duration: 999999,
                          });
                          
                          try {
                            const slidesDataToExport = await getAiEnhancedSlides(content);
                            const title = (activeDoc.name || activeDoc.id).replace('.md', '');
                            const blob = await presentationApi.exportTemplate(projectId || '', slidesDataToExport, title);
                            progressToast.dismiss();

                            const downloadUrl = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = `${title || 'presentation'}.pptx`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(downloadUrl);

                            telemetryApi.track('file.exported', { exportFormat: 'pptx' });
                            toast({ title: 'PPTX Export Successful', description: 'Downloaded presentation with your custom corporate template layouts.' });
                          } catch (error) {
                            progressToast.dismiss();
                            console.error('Corporate template export failed:', error);
                            toast({ title: 'PPTX Export Failed', description: String(error), variant: 'destructive' });
                          }
                        }}
                        className="flex items-center gap-2 cursor-pointer py-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-foreground">Custom Corporate Theme</span>
                          <span className="text-[10px] text-muted-foreground">Uses imported template layouts & theme</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          const progressToast = toast({
                            title: 'Preparing PPTX',
                            description: <AIProgressToast />,
                            duration: 999999,
                          });
                          
                          try {
                            const slidesDataToExport = await getAiEnhancedSlides(content);
                            const result = await exportToPptx(slidesDataToExport, undefined, (activeDoc.name || activeDoc.id).replace('.md', ''));
                            progressToast.dismiss();

                            if (result.success) {
                              telemetryApi.track('file.exported', { exportFormat: 'pptx' });
                              toast({ title: 'PPTX Export Successful', description: 'Downloaded using default modern theme engine.' });
                            } else {
                              toast({ title: 'PPTX Export Failed', description: String(result.error), variant: 'destructive' });
                            }
                          } catch (error) {
                            progressToast.dismiss();
                            toast({ title: 'PPTX Export Failed', description: String(error), variant: 'destructive' });
                          }
                        }}
                        className="flex items-center gap-2 cursor-pointer py-2"
                      >
                        <Download className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-foreground">Standard Theme</span>
                          <span className="text-[10px] text-muted-foreground">Uses built-in presentation theme</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
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
                        const slidesDataToExport = await getAiEnhancedSlides(content);
                        const result = await exportToPptx(slidesDataToExport, brandSettings, (activeDoc.name || activeDoc.id).replace('.md', ''));
                        progressToast.dismiss();

                        if (result.success) {
                          telemetryApi.track('file.exported', { exportFormat: 'pptx' });
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
                )
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
                             await appApi.updateArtifactMetadata(projectId, kind as any, activeDoc.id, undefined, val);
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

      {/* ── Adversarial Critic Review Drawer ───────────────────────── */}
      <CriticReviewDrawer
        isOpen={isCriticDrawerOpen}
        onClose={() => setIsCriticDrawerOpen(false)}
        isLoading={isAuditing}
        overallScore={criticAuditResult?.overallScore ?? 100}
        summary={criticAuditResult?.summary}
        findings={criticAuditResult?.findings || []}
        onApplyFix={handleApplyCriticFix}
        onDismissFinding={handleDismissCriticFinding}
        onReAudit={() => handleQualityCheck('toolbar_button')}
      />
    </div>
  );
}

