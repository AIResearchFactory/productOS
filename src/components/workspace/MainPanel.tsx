import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, PanelRight, ChevronDown, Check, FileText, Sparkles } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ChatPanel from './ChatPanel';
import MarkdownEditor from './MarkdownEditor';
import ProjectSettingsPage from '@/pages/ProjectSettings';
import GlobalSettingsPage from '@/pages/GlobalSettings';
import WelcomePage from '@/pages/Welcome';
import ProductHome from '@/pages/ProductHome';
import WorkflowCanvas from '../workflow/WorkflowCanvas';
import { Workflow, Artifact } from '@/api/types';

import SkillEditor from './SkillEditor';

interface Document {
  id: string;
  name: string;
  type: string;
  content: string;
}

interface MainPanelProps {
  activeProject: { id: string; name: string; description?: string; documents?: Document[] } | null;
  openDocuments: Document[];
  activeDocument: Document | null;
  showChat: boolean;
  onDocumentSelect: (doc: Document) => void;
  onDocumentClose: (docId: string) => void;
  onCloseOthers?: (docId: string) => void;
  onCloseRight?: (docId: string) => void;
  onCloseAll?: () => void;
  onToggleChat: () => void;
  onTabChange?: (tab: string) => void;

  onCreateProject: () => void;
  onOpenProductSettings?: () => void;
  // Workflow props
  activeWorkflow?: Workflow | null;
  workflows?: Workflow[]; // Added workflows prop
  artifacts?: Artifact[]; // Added artifacts prop
  projects?: { id: string; name: string }[]; // Added projects prop
  skills?: any[]; // Added skills prop
  onWorkflowSave?: (workflow: Workflow) => void;
  onWorkflowRun?: (workflow: Workflow, parameters?: Record<string, string>) => void;
  onNewSkill?: () => void;
  onEditWorkflowDetails?: (workflow: Workflow) => void;
  openScheduleNonce?: number;
  // Skill props
  onSkillSave?: (skill: any) => void;
  // Project props
  onProjectCreated?: (project: any) => void;
  onProjectUpdated?: (project: any) => void;
  theme?: string;
  onInstallPandoc?: () => Promise<void>;
  enableAiAutocomplete?: boolean;
  onArtifactUpdate?: () => void;
  onSendPrompt?: (prompt: string) => void;
}

export default function MainPanel({
  activeProject,
  openDocuments,
  activeDocument,
  showChat,
  onDocumentSelect,
  onDocumentClose,
  onToggleChat,
  onTabChange,
  onCreateProject,
  onOpenProductSettings,

  activeWorkflow,
  workflows = [],
  projects = [],
  skills = [],
  onWorkflowSave,
  onWorkflowRun,
  onNewSkill,
  onEditWorkflowDetails,
  openScheduleNonce,
  onSkillSave,
  onCloseOthers,
  onCloseRight,
  onCloseAll,
  onProjectCreated,
  onProjectUpdated,
  theme,
  onInstallPandoc,
  enableAiAutocomplete,
  onArtifactUpdate,
  onSendPrompt,
  artifacts = []
}: MainPanelProps) {
  const [layoutMode, setLayoutMode] = useState<'split' | 'full' | 'hidden'>(showChat ? 'split' : 'hidden');
  const [chatWidth, setChatWidth] = useState(40); // Percentage
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const isResizing = useRef(false);
  const [isResizingState, setIsResizingState] = useState(false);

  useEffect(() => {
    if (showChat && layoutMode === 'hidden') {
      setLayoutMode('split');
    } else if (!showChat && layoutMode !== 'hidden') {
      setLayoutMode('hidden');
    }
  }, [showChat]);

  const containerRef = useRef<HTMLDivElement>(null);

  const startResizing = () => {
    isResizing.current = true;
    setIsResizingState(true);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
  };

  const stopResizing = () => {
    isResizing.current = false;
    setIsResizingState(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current || !containerRef.current) return;

    // Calculate percentage from right relative to container
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseXRelative = e.clientX - containerRect.left;

    // Distance from right edge
    const offsetFromRight = containerWidth - mouseXRelative;

    const percentage = (offsetFromRight / containerWidth) * 100;

    // Constrain between 20% and 80%
    if (percentage > 20 && percentage < 80) {
      setChatWidth(percentage);
    }
  };

  const tabsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll to active tab
  useEffect(() => {
    if (activeDocument && tabsContainerRef.current) {
      // We need to escape the ID because it might contain characters that are not valid in CSS selectors without escaping
      // safely formatting the selector
      try {
        const tabElement = document.getElementById(`tab-${activeDocument.id}`);
        if (tabElement && tabsContainerRef.current.contains(tabElement)) {
          tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      } catch (e) {
        console.error("Failed to scroll to tab", e);
      }
    }
  }, [activeDocument]);

  // Determine layout mode
  const isDocOpen = !!activeDocument;
  const isChatDoc = activeDocument?.type === 'chat';
  const isGlobalSettings = activeDocument?.type === 'global-settings';

  // Chat is visible unless: user toggled it off while a doc is open, or global-settings is active
  const shouldShowChat = layoutMode !== 'hidden' && !isGlobalSettings;

  // Show editor/content when a non-chat doc is open and no workflow is active.
  // Global settings is rendered through this content area; hiding it here leaves
  // the settings document active but invisible.
  const shouldShowEditor = isDocOpen && !isChatDoc && !activeWorkflow;

  // Content area exists when showing a workflow canvas, an editor doc, or an empty state (no docs)
  const hasContentArea = (!!activeWorkflow || shouldShowEditor || (openDocuments.length === 0 && !isChatDoc)) && layoutMode !== 'full';
  
  const useStackedContent = viewportWidth < 1100 && hasContentArea && shouldShowChat;
  
  const contentStyle = useStackedContent
    ? { width: '100%', height: '58%' }
    : { width: shouldShowChat && hasContentArea ? `${100 - chatWidth}%` : (hasContentArea ? '100%' : '0%'), display: hasContentArea ? 'flex' : 'none' };
    
  const chatStyle = shouldShowChat
    ? (hasContentArea
      ? useStackedContent
        ? { width: '100%', height: '42%' }
        : { width: `${chatWidth}%` }
      : { width: '100%', flex: 1 })
    : { width: 0, overflow: 'hidden' };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent font-sans relative">
      <div ref={containerRef} className={`flex-1 ${useStackedContent ? 'flex flex-col' : 'flex'} overflow-hidden relative`}>

        {/* Content Area — Workflow Canvas OR Editor (only when needed) */}
        {hasContentArea && (
          <div
            className={`flex min-w-0 flex-col overflow-hidden ${isResizingState ? '' : 'transition-all duration-300 ease-in-out'} ${!activeWorkflow ? `${useStackedContent ? 'border-b' : 'border-r'} border-border bg-background/35 backdrop-blur-xl` : ''}`}
            style={contentStyle}
          >
            {activeWorkflow ? (
              /* Workflow Canvas */
              <WorkflowCanvas
                workflow={activeWorkflow}
                projectName={activeProject?.name || ''}
                projects={projects}
                skills={skills}
                onSave={onWorkflowSave || (() => { })}
                onRun={() => onWorkflowRun && onWorkflowRun(activeWorkflow)}
                onNewSkill={onNewSkill}
                onEditDetails={onEditWorkflowDetails}
                openScheduleNonce={openScheduleNonce}
                theme={theme}
              />
            ) : (
              /* Editor with Tabs */
              <>
                {/* Document Tabs */}
                <div className="shrink-0 border-b border-border bg-background/25 px-3 py-2 backdrop-blur-xl">
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/45 px-2 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                    <div className="hidden items-center gap-2 rounded-xl border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:flex">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      Workspace
                    </div>
                    <div ref={tabsContainerRef} className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
                    {openDocuments.map((doc) => {
                      const isSpecialDoc = ['welcome', 'product-home', 'project-settings', 'global-settings', 'skill'].includes(doc.type) || doc.type === 'skill';
                      const isArtifactPath = ['roadmaps/', 'product-visions/', 'one-pagers/', 'prds/', 'initiatives/', 'competitive-research/', 'user-stories/', 'insights/', 'presentations/', 'artifacts/', 'pr-faqs/'].some(prefix => doc.id.startsWith(prefix));
                      const belongsToProject = isSpecialDoc || doc.id.startsWith('artifact-') || isArtifactPath || (activeProject?.documents?.some(d => d.id === doc.id));

                      return (
                        <ContextMenu key={doc.id}>
                          <ContextMenuTrigger>
                            <div
                              id={`tab-${doc.id}`}
                              className={`group flex min-w-fit items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer transition-all ${activeDocument?.id === doc.id
                                ? 'border-primary/20 bg-primary/10 text-foreground shadow-[0_8px_20px_rgba(59,130,246,0.12)]'
                                : 'border-transparent bg-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground'
                                } ${!belongsToProject ? 'opacity-50 italic' : ''}`}
                              onClick={() => onDocumentSelect(doc)}
                            >
                              <FileText className={`h-3.5 w-3.5 shrink-0 ${activeDocument?.id === doc.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                              <span className="truncate max-w-[150px]">
                                {doc.type === 'product-home' && activeProject ? `${activeProject.name} Home` : doc.name}
                              </span>
                              <button
                                aria-label={`Close ${doc.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDocumentClose(doc.id);
                                }}
                                className="-mr-1 ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => onDocumentClose(doc.id)}>
                              Close
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => onCloseOthers && onCloseOthers(doc.id)}>
                              Close Others
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => onCloseRight && onCloseRight(doc.id)}>
                              Close to the Right
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onClick={() => onCloseAll && onCloseAll()}>
                              Close All
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                    {openDocuments.length === 0 && (
                      <span className="ml-2 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Open a product file, create an artifact, or ask Copilot to make it happen.
                      </span>
                    )}
                    </div>

                    {openDocuments.length > 0 && (
                      <div className="hidden rounded-xl border border-border bg-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:block">
                        {openDocuments.length} open
                      </div>
                    )}

                  {/* Tab Overflow Menu */}
                  {openDocuments.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Open tab menu" className="ml-1 h-8 w-8 shrink-0 rounded-xl border border-border bg-muted/40 hover:bg-muted">
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[200px] max-h-[300px] overflow-y-auto">
                        {openDocuments.map((doc) => (
                          <DropdownMenuItem key={doc.id} onClick={() => onDocumentSelect(doc)} className="flex items-center justify-between">
                            <span className={`truncate ${activeDocument?.id === doc.id ? 'font-medium text-primary' : ''}`}>
                              {doc.name}
                            </span>
                            {activeDocument?.id === doc.id && <Check className="h-3 w-3 ml-2" />}
                          </DropdownMenuItem>
                        ))}
                        {openDocuments.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onCloseAll && onCloseAll()} className="text-red-500 hover:text-red-600">
                              Close All Tabs
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* Toggle Chat Button in tabs area when doc is open and chat is hidden */}
                  {isDocOpen && !showChat && !isGlobalSettings && (
                    <div className="ml-2 border-l border-border pl-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Show Chat"
                        data-testid="show-chat-button"
                        onClick={onToggleChat}
                        className="h-8 gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-primary transition-all hover:bg-primary/15"
                      >
                        <PanelRight className="w-3.5 h-3.5" />
                        Show Chat
                      </Button>
                    </div>
                  )}
                  </div>
                </div>

                {/* Editor Content */}
                <div className="flex-1 overflow-hidden relative">
                  {activeDocument && activeDocument.type === 'project-settings' ? (
                    <div data-testid="view-project-settings" className="h-full">
                      <ProjectSettingsPage
                        activeProject={activeProject}
                        onProjectCreated={onProjectCreated}
                        onProjectUpdated={onProjectUpdated}
                      />
                    </div>
                  ) : activeDocument && activeDocument.type === 'global-settings' ? (
                    <GlobalSettingsPage initialSection={activeDocument.content as any} initialProjectId={activeProject?.id} />
                  ) : activeDocument && activeDocument.type === 'welcome' ? (
                    <div data-testid="view-welcome" className="h-full">
                      <WelcomePage onCreateProject={onCreateProject} onTabChange={onTabChange} />
                    </div>
                  ) : activeDocument && activeDocument.type === 'product-home' ? (
                    <ProductHome
                      product={activeProject}
                      workflows={workflows}
                      onOpenFile={onDocumentSelect}
                      onOpenChat={onToggleChat}
                      onCreateProduct={onCreateProject}
                      onOpenProductSettings={onOpenProductSettings}
                      onTabChange={onTabChange}
                      onSendPrompt={onSendPrompt}
                      artifacts={artifacts}
                    />
                  ) : activeDocument && activeDocument.type === 'skill' ? (
                    <SkillEditor
                      skill={JSON.parse(activeDocument.content)}
                      workflows={workflows}
                      onSave={onSkillSave || (() => { })}
                    />
                  ) : activeDocument ? (
                    (() => {
                      const isSpecialDoc = ['welcome', 'product-home', 'project-settings', 'global-settings', 'skill'].includes(activeDocument.type) || activeDocument.type === 'skill';
                      const isArtifactPath = ['roadmaps/', 'product-visions/', 'one-pagers/', 'prds/', 'initiatives/', 'competitive-research/', 'user-stories/', 'insights/', 'presentations/', 'artifacts/', 'pr-faqs/'].some(prefix => activeDocument.id.startsWith(prefix));
                      const belongsToProject = isSpecialDoc || activeDocument.id.startsWith('artifact-') || isArtifactPath || (activeProject?.documents?.some(d => d.id === activeDocument.id));

                      if (!belongsToProject && activeProject) {
                        return (
                          <div className="h-full flex flex-col items-center justify-center bg-secondary/20 text-center p-8">
                            <div className="max-w-md space-y-4 opacity-70">
                              <div className="text-4xl">🔒</div>
                              <h3 className="text-xl font-semibold text-foreground">
                                File Unavailable
                              </h3>
                              <p className="text-muted-foreground">
                                This file belongs to a different product. Please switch to the product containing this file to view or edit it.
                              </p>
                              <div className="pt-4">
                                <Button variant="outline" onClick={() => onDocumentClose(activeDocument.id)}>
                                  Close File
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return <MarkdownEditor activeDoc={activeDocument} projectId={activeProject?.id} aiAutocompleteEnabled={enableAiAutocomplete} onArtifactUpdate={onArtifactUpdate} />;
                    })()
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}

        {/* Resizer Handle (only when content area and chat are both visible) */}
        {hasContentArea && shouldShowChat && !useStackedContent && (
          <div
            className="z-20 w-2 shrink-0 cursor-col-resize bg-muted transition-colors hover:bg-primary/40"
            onMouseDown={startResizing}
          />
        )}

        {/* Chat Panel — ALWAYS MOUNTED to preserve conversation state across navigation.
            Visibility is controlled via width/flex, never by unmounting. */}
        <div
          className={`flex flex-col overflow-hidden ${isResizingState ? '' : 'transition-all duration-300 ease-in-out'} ${hasContentArea ? 'shrink-0 bg-background/30 backdrop-blur-xl' : 'flex-1 bg-transparent'}`}
          style={chatStyle}
        >
          <ChatPanel
            activeProject={activeProject}
            skills={skills}
            workflows={workflows}
            onToggleChat={onToggleChat}
            onRunWorkflow={onWorkflowRun}
            onInstallPandoc={onInstallPandoc}
            layoutMode={layoutMode}
            onLayoutModeChange={setLayoutMode}
          />
        </div>

        {/* FAB to restore chat when hidden (workflow view or doc view with chat toggled off) */}
        {!shouldShowChat && !isGlobalSettings && (
          <div className="absolute right-4 bottom-4 z-30">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleChat}
              data-testid="show-chat-button"
            className="h-9 gap-1.5 rounded-xl border border-primary/30 bg-background/80 px-3 text-[10px] font-bold uppercase tracking-wider text-primary shadow-lg transition-all hover:bg-primary/10 backdrop-blur-sm"
          >
              <PanelRight className="w-3.5 h-3.5" />
              Show Chat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
