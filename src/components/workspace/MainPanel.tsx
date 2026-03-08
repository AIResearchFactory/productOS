import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, PanelRight, ChevronDown, Check } from 'lucide-react';
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
import ProjectSettingsPage from '../../pages/ProjectSettings';
import GlobalSettingsPage from '../../pages/GlobalSettings';
import WelcomePage from '../../pages/Welcome';
import WorkflowCanvas from '../workflow/WorkflowCanvas';
import { Workflow } from '@/api/tauri';

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
  // Workflow props
  activeWorkflow?: Workflow | null;
  workflows?: Workflow[]; // Added workflows prop
  projects?: { id: string; name: string }[]; // Added projects prop
  skills?: any[]; // Added skills prop
  onWorkflowSave?: (workflow: Workflow) => void;
  onWorkflowRun?: (workflow: Workflow) => void;
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
  onInstallPandoc
}: MainPanelProps) {
  const [chatWidth, setChatWidth] = useState(40); // Percentage
  const isResizing = useRef(false);
  const [isResizingState, setIsResizingState] = useState(false);

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
  const shouldShowChat = (!isDocOpen || showChat || isChatDoc) && !isGlobalSettings;

  // Show editor when a non-chat doc is open and no workflow is active
  const shouldShowEditor = isDocOpen && !isChatDoc && !activeWorkflow;

  // Content area exists when showing a workflow canvas or an editor doc
  const hasContentArea = !!activeWorkflow || shouldShowEditor;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent font-sans relative">
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">

        {/* Content Area — Workflow Canvas OR Editor (only when needed) */}
        {hasContentArea && (
          <div
            className={`flex flex-col min-w-0 overflow-hidden ${isResizingState ? '' : 'transition-all duration-300 ease-in-out'} ${!activeWorkflow ? 'bg-background/40 backdrop-blur-sm border-r border-border' : ''}`}
            style={{ width: shouldShowChat ? `${100 - chatWidth}%` : '100%' }}
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
                <div className="h-10 border-b border-white/5 bg-background/20 backdrop-blur-md flex items-center px-2 shrink-0">
                  <div ref={tabsContainerRef} className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
                    {openDocuments.map((doc) => {
                      const isSpecialDoc = ['welcome', 'project-settings', 'global-settings', 'skill'].includes(doc.type) || doc.type === 'skill';
                      const belongsToProject = isSpecialDoc || doc.id.startsWith('artifact-') || (activeProject?.documents?.some(d => d.id === doc.id));

                      return (
                        <ContextMenu key={doc.id}>
                          <ContextMenuTrigger>
                            <div
                              id={`tab-${doc.id}`}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-t text-xs font-medium cursor-pointer transition-all border-t border-x min-w-fit ${activeDocument?.id === doc.id
                                ? 'bg-background text-foreground border-border border-b-background -mb-px shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-10'
                                : 'bg-transparent text-muted-foreground border-transparent hover:bg-accent/50 hover:text-foreground'
                                } ${!belongsToProject ? 'opacity-50 italic' : ''}`}
                              onClick={() => onDocumentSelect(doc)}
                            >
                              <span className="truncate max-w-[150px]">{doc.name}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDocumentClose(doc.id);
                                }}
                                className="hover:bg-accent rounded p-0.5 transition-colors"
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
                      <span className="text-xs text-muted-foreground ml-2">Select a file...</span>
                    )}
                  </div>

                  {/* Tab Overflow Menu */}
                  {openDocuments.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full ml-1 shrink-0 hover:bg-white/10">
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
                    <div className="ml-2 pl-2 border-l border-white/10">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleChat}
                        className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider gap-1.5 text-primary hover:bg-primary/10 transition-all border border-primary/20"
                      >
                        <PanelRight className="w-3.5 h-3.5" />
                        Show Chat
                      </Button>
                    </div>
                  )}
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
                    <GlobalSettingsPage initialSection={activeDocument.content as any} />
                  ) : activeDocument && activeDocument.type === 'welcome' ? (
                    <div data-testid="view-welcome" className="h-full">
                      <WelcomePage onCreateProject={onCreateProject} onTabChange={onTabChange} />
                    </div>
                  ) : activeDocument && activeDocument.type === 'skill' ? (
                    <SkillEditor
                      skill={JSON.parse(activeDocument.content)}
                      workflows={workflows}
                      onSave={onSkillSave || (() => { })}
                    />
                  ) : activeDocument ? (
                    (() => {
                      const isSpecialDoc = ['welcome', 'project-settings', 'global-settings', 'skill'].includes(activeDocument.type) || activeDocument.type === 'skill';
                      const belongsToProject = isSpecialDoc || activeDocument.id.startsWith('artifact-') || (activeProject?.documents?.some(d => d.id === activeDocument.id));

                      if (!belongsToProject && activeProject) {
                        return (
                          <div className="h-full flex flex-col items-center justify-center bg-secondary/20 text-center p-8">
                            <div className="max-w-md space-y-4 opacity-70">
                              <div className="text-4xl">🔒</div>
                              <h3 className="text-xl font-semibold text-foreground">
                                File Unavailable
                              </h3>
                              <p className="text-muted-foreground">
                                This file belongs to a different project. Please switch to the project containing this file to view or edit it.
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

                      return <MarkdownEditor document={activeDocument} projectId={activeProject?.id} />;
                    })()
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}

        {/* Resizer Handle (only when content area and chat are both visible) */}
        {hasContentArea && shouldShowChat && (
          <div
            className="w-1 shrink-0 bg-white/5 hover:bg-primary/50 cursor-col-resize transition-colors z-20"
            onMouseDown={startResizing}
          />
        )}

        {/* Chat Panel — ALWAYS MOUNTED to preserve conversation state across navigation.
            Visibility is controlled via width/flex, never by unmounting. */}
        <div
          className={`flex flex-col overflow-hidden ${isResizingState ? '' : 'transition-all duration-300 ease-in-out'} ${hasContentArea ? 'shrink-0 bg-background/20 backdrop-blur-md' : 'flex-1 bg-transparent'}`}
          style={shouldShowChat
            ? (hasContentArea ? { width: `${chatWidth}%` } : {})
            : { width: 0, overflow: 'hidden' }}
        >
          <ChatPanel
            activeProject={activeProject}
            skills={skills}
            workflows={workflows}
            onToggleChat={onToggleChat}
            onRunWorkflow={onWorkflowRun}
            onInstallPandoc={onInstallPandoc}
          />
        </div>

        {/* FAB to restore chat when hidden (workflow view or doc view with chat toggled off) */}
        {!shouldShowChat && !isGlobalSettings && (
          <div className="absolute right-4 bottom-4 z-30">
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleChat}
              className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider gap-1.5 text-primary hover:bg-primary/10 transition-all border border-primary/30 shadow-lg bg-background/80 backdrop-blur-sm"
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