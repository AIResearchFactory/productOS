import { useState, useEffect } from 'react';
import { Folder, FileStack, Repeat, Cpu, Settings, Plus, ChevronRight, Zap, FileText, MessageSquare, X, FolderPlus, Compass, Eye, LayoutTemplate, Rocket, Swords, Users, MonitorPlay, ClipboardList, Lightbulb, LogOut, Download, Sparkles, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import WorkflowList from '../workflow/WorkflowList';
import ArtifactList from './ArtifactList';
import Logo from '@/components/ui/Logo';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { RenameDialog } from '@/components/ui/RenameDialog';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

import { appApi } from '@/api/app';
import type { Project, Skill, Workflow, Artifact, ArtifactType } from '@/api/app';

interface Document {
  id: string;
  name: string;
  type: string;
  content: string;
}

const ARTIFACT_TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  roadmap: { icon: Compass, label: 'Roadmap', color: 'text-primary bg-primary/10 border-primary/10' },
  product_vision: { icon: Eye, label: 'Product Vision', color: 'text-primary bg-primary/10 border-primary/10' },
  one_pager: { icon: LayoutTemplate, label: 'One Pager', color: 'text-primary bg-primary/10 border-primary/10' },
  prd: { icon: ClipboardList, label: 'PRD', color: 'text-primary bg-primary/10 border-primary/10' },
  initiative: { icon: Rocket, label: 'Initiative', color: 'text-primary bg-primary/10 border-primary/10' },
  competitive_research: { icon: Swords, label: 'Competitive Research', color: 'text-primary bg-primary/10 border-primary/10' },
  user_story: { icon: Users, label: 'User Story', color: 'text-primary bg-primary/10 border-primary/10' },
  insight: { icon: Lightbulb, label: 'Insight', color: 'text-primary bg-primary/10 border-primary/10' },
  presentation: { icon: MonitorPlay, label: 'Presentation', color: 'text-primary bg-primary/10 border-primary/10' },
  pr_faq: { icon: ClipboardList, label: 'PR-FAQ', color: 'text-primary bg-primary/10 border-primary/10' },
};

interface SidebarProps {
  projects: (Project & { documents?: Document[]; description?: string; created?: string })[];
  skills: Skill[];
  activeProject: (Project & { documents?: Document[] }) | null;
  activeDocument?: Document | null;
  activeTab: string;
  onProjectSelect: (project: Project) => void | Promise<void>;
  onTabChange: (tab: string) => void;
  onDocumentOpen: (doc: Document) => void;
  onNewProject: () => void;
  onNewSkill: () => void;
  onSkillSelect?: (skill: Skill) => void;
  workflows?: Workflow[];
  activeWorkflowId?: string;
  onWorkflowSelect?: (workflow: any) => void;
  onNewWorkflow?: () => void;
  onRunWorkflow?: (workflow: any) => void;
  onDeleteWorkflow?: (workflow: any) => void;
  onDeleteSkill?: (skill: Skill) => void;
  onEditWorkflow?: (workflow: any) => void;
  onQuickScheduleWorkflow?: (workflow: any) => void;
  onOpenWorkflowOptimizer?: () => void;

  onDeleteProject?: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onAddFileToProject?: (projectId: string) => void;
  onDeleteFile?: (projectId: string, fileId: string) => void;
  onDeleteArtifact: (artifact: Artifact) => void;
  onArtifactUpdate: () => void;
  onRenameFile?: (projectId: string, fileId: string, newName: string) => void;
  onImportSkill?: () => void;
  artifacts?: Artifact[];
  activeArtifactId?: string;
  onArtifactSelect?: (artifact: Artifact) => void;
  onArtifactCategorySelect?: (type: ArtifactType) => void;
  onCreateArtifact?: (type: ArtifactType) => void;
  onImportArtifact?: (type: ArtifactType) => void;
  onOpenSettings?: () => void;
  onOpenModelsCost?: () => void;
  onOpenSettingsUsage?: () => void;
  recentlyChangedFiles?: Set<string>;
  onImportDocument?: (projectId: string) => void;
  onExportDocument: (projectId: string, doc: { id: string; name: string; type: string; content: string }) => void;
  onCreatePresentationFromFile?: (projectId: string, doc: { id: string; name: string; type: string; content: string }) => void;
  onConvertFileToArtifact?: (projectId: string, doc: { id: string; name: string; type: string; content: string }, type: ArtifactType) => void;
  isFlyoutOpen?: boolean;
  onFlyoutOpenChange?: (open: boolean) => void;
  onShutdown?: () => void;
  isInstallable?: boolean;
  onInstall?: () => void;
  flyoutWidth?: number;
  isResizing?: boolean;
  showProductPanel?: boolean;
  onToggleProductPanel?: (show: boolean) => void;
}

const navItems = [
  { id: 'products', icon: Folder, label: 'Products' },
  { id: 'skills', icon: Zap, label: 'Skills' },
  { id: 'workflows', icon: Repeat, label: 'Workflows' },
  { id: 'models', icon: Cpu, label: 'Models' },
] as const;

export default function Sidebar({
  projects,
  skills,
  activeProject,
  activeTab,
  onProjectSelect,
  onTabChange,
  onDocumentOpen,
  onNewProject,
  onNewSkill,
  onSkillSelect,
  workflows = [],
  activeWorkflowId,
  onWorkflowSelect,
  onNewWorkflow,
  onRunWorkflow,
  onDeleteWorkflow,
  onDeleteSkill,
  onEditWorkflow,
  onQuickScheduleWorkflow,
  onOpenWorkflowOptimizer,
  onDeleteProject,
  onAddFileToProject,
  onDeleteFile,
  onRenameFile,
  onImportSkill,
  artifacts = [],
  activeArtifactId,
  onArtifactSelect,
  onArtifactCategorySelect,
  onCreateArtifact,
  onImportArtifact,
  onDeleteArtifact,
  onArtifactUpdate,
  onOpenSettings,
  onOpenModelsCost,
  onOpenSettingsUsage,
  recentlyChangedFiles = new Set(),
  onImportDocument,
  onExportDocument,
  onCreatePresentationFromFile,
  onConvertFileToArtifact,
  activeDocument,
  isFlyoutOpen: controlledFlyoutOpen,
  onFlyoutOpenChange,
  onShutdown,
  isInstallable,
  onInstall,
  flyoutWidth = 240,
  isResizing = false,
  showProductPanel = false,
  onToggleProductPanel = () => {},
}: SidebarProps) {
  const [projectSearchQuery, setProjectSearchQuery] = useState('');

  useEffect(() => {
    if (!showProductPanel) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onToggleProductPanel(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showProductPanel, onToggleProductPanel]);
  const [internalFlyoutOpen, setInternalFlyoutOpen] = useState(false);
  const [isChatFocused, setIsChatFocused] = useState(false);
  useEffect(() => {
    const handleLayoutChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: string }>;
      const isFocused = customEvent.detail?.mode === 'chat-focused';
      setIsChatFocused(isFocused);
      if (isFocused) {
        if (onFlyoutOpenChange) {
          onFlyoutOpenChange(false);
        } else {
          setInternalFlyoutOpen(false);
        }
      }
    };
    window.addEventListener('productos:layout-mode-changed', handleLayoutChange);
    return () => window.removeEventListener('productos:layout-mode-changed', handleLayoutChange);
  }, [onFlyoutOpenChange]);

  const flyoutOpen = controlledFlyoutOpen !== undefined ? controlledFlyoutOpen : internalFlyoutOpen;

  const setFlyoutOpen = (open: boolean) => {
    if (onFlyoutOpenChange) {
      onFlyoutOpenChange(open);
    } else {
      setInternalFlyoutOpen(open);
    }
  };

  const [projectCost, setProjectCost] = useState<number>(0);
  const [activeArtifactCategory, setActiveArtifactCategory] = useState<ArtifactType | undefined>(undefined);

  const [renameDialog, setRenameDialog] = useState<{ open: boolean; projectId: string; fileId: string; currentName: string; } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'project' | 'file' | 'artifact' | 'skill' | 'shutdown'; projectId?: string; fileId?: string; itemName: string; artifact?: Artifact; skill?: Skill; requireTypeConfirm?: string; scopeSummary?: string[]; } | null>(null);

  // Fetch project cost dynamically
  useEffect(() => {
    if (activeTab === 'models' && activeProject?.id && activeProject.id !== 'new-project') {
      appApi.getProjectCost(activeProject.id)
        .then(cost => setProjectCost(cost))
        .catch(err => console.error("Failed to fetch project cost:", err));
    }
  }, [activeTab, activeProject?.id]);

  const handleNavClick = (tabId: string) => {
    if (tabId === activeTab && flyoutOpen) {
      setFlyoutOpen(false);
    } else {
      onTabChange(tabId);
      setFlyoutOpen(true);
    }
  };

  const groupedArtifacts = artifacts.reduce((acc, artifact) => {
    if (!acc[artifact.artifactType]) acc[artifact.artifactType] = [];
    acc[artifact.artifactType].push(artifact);
    return acc;
  }, {} as Record<string, Artifact[]>);

  const activeNav = navItems.find(n => n.id === activeTab);

  return (
    <div className="shrink-0 flex h-full border-r border-border relative z-20 bg-secondary">
      {/* ─── Icon Rail ─── */}
      <nav data-testid="sidebar-navigation" aria-label="Main navigation" className={`${flyoutOpen ? 'w-[72px] sm:w-[140px]' : 'w-[72px]'} flex shrink-0 flex-col overflow-hidden border-r border-border bg-secondary/95 py-4 transition-all duration-200`}>
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded border border-border bg-background shadow-sm">
            <Logo size="sm" />
          </div>
          {flyoutOpen && (
            <div className="hidden rounded bg-muted/50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground sm:block">
              Control
            </div>
          )}
        </div>

        {/* Nav Icons */}
        <div className="flex flex-1 flex-col gap-1 w-full px-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => handleNavClick(item.id)}
                title={item.label}
                aria-label={item.label}
                className={`
                  relative flex items-center rounded border transition-all duration-150
                  ${flyoutOpen ? 'h-9 w-full gap-2.5 px-2' : 'mx-auto h-9 w-9 justify-center'}
                  ${isActive
                    ? 'border-border bg-background text-primary font-semibold shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                  }
                `}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'}`}>
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                </div>
                {flyoutOpen && (
                  <div className="min-w-0 text-left">
                    <span className="hidden truncate text-xs font-semibold sm:block">{item.label}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom: Settings */}
        <div className="mt-auto flex w-full flex-col gap-1 border-t border-border pt-3 px-2">
          <button
            onClick={() => {
              onOpenSettings?.();
              setFlyoutOpen(false);
            }}
            data-testid="nav-settings"
            title="App settings"
            aria-label="App settings"
            className={`
              flex items-center rounded border transition-all duration-150
              ${flyoutOpen ? 'h-9 w-full gap-2.5 px-2' : 'mx-auto h-9 w-9 justify-center'}
              ${activeTab === 'settings'
                ? 'border-border bg-background text-primary font-semibold shadow-sm'
                : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
          >
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${activeTab === 'settings' ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-muted-foreground'}`}>
              <Settings className="h-3.5 w-3.5 shrink-0" />
            </div>
            {flyoutOpen && (
              <span className="hidden truncate text-xs font-semibold sm:block">Settings</span>
            )}
          </button>

          {isInstallable && (
            <button
              onClick={onInstall}
              title="Install App"
              className={`
                mt-1 flex items-center rounded border border-border bg-background text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground
                ${flyoutOpen ? 'h-9 w-full gap-2.5 px-2' : 'mx-auto h-9 w-9 justify-center'}
              `}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted/50 text-muted-foreground">
                <Download className="h-3.5 w-3.5 shrink-0" />
              </div>
              {flyoutOpen && (
                <span className="hidden truncate text-xs font-semibold sm:block">Install App</span>
              )}
            </button>
          )}

          <button
            onClick={() => {
              setDeleteDialog({
                open: true,
                type: 'shutdown',
                itemName: 'QUIT',
                scopeSummary: [
                  'Terminate ProductOS and the companion server',
                  'Clear all secrets and API keys from memory',
                  'Save any unsaved changes to artifacts'
                ]
              });
              setFlyoutOpen(false);
            }}
            data-testid="nav-quit"
            title="Quit ProductOS"
            aria-label="Quit ProductOS"
            className={`
              mt-1 flex items-center rounded border transition-all duration-150
              ${flyoutOpen ? 'h-9 w-full gap-2.5 px-2' : 'mx-auto h-9 w-9 justify-center'}
              border-transparent text-muted-foreground hover:bg-red-500/10 hover:text-red-500
            `}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-red-500/10 text-red-500">
              <LogOut className="h-3.5 w-3.5 shrink-0" />
            </div>
            {flyoutOpen && (
              <span className="hidden truncate text-xs font-semibold sm:block">Quit</span>
            )}
          </button>
        </div>
      </nav>


      {/* ─── Flyout Panel ─── */}
      <AnimatePresence>
        {flyoutOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: `${flyoutWidth}px`, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={isResizing ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
            className={`h-full overflow-hidden bg-secondary shrink-0 border-l border-border relative rounded-none shadow-none z-30 ${isResizing ? 'transition-none' : 'transition-all duration-200'}`}
            style={{ width: `${flyoutWidth}px` }}
          >
            <div className="flex h-full w-full flex-col">
              {/* Flyout Header */}
              <div className="shrink-0 px-3 pb-2 pt-3">
                <div className="flex items-start justify-between gap-2.5 rounded border border-border bg-muted/30 px-2.5 py-2.5 shadow-sm">
                  <div className="min-w-0">
                    <div className="mb-0.5 inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-primary">
                      <Sparkles className="h-2.5 w-2.5" />
                      Workspace
                    </div>
                    <h3 data-testid="sidebar-flyout-header" className="truncate text-xs font-bold text-foreground">
                      {activeNav?.label || 'Settings'}
                    </h3>
                    <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                      {activeTab === 'products' && 'Browse products, files, and outputs.'}
                      {activeTab === 'skills' && 'Manage reusable skills.'}
                      {activeTab === 'artifacts' && 'Jump to structured docs.'}
                      {activeTab === 'workflows' && 'Run automated workflows.'}
                      {activeTab === 'models' && 'Review models and costs.'}
                    </p>
                  </div>
                <button
                  onClick={() => setFlyoutOpen(false)}
                  data-testid="flyout-close-button"
                  aria-label={`Close ${activeNav?.label || 'Settings'} panel`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
                </div>
              </div>

              {/* ── Projects Panel ── */}
              {activeTab === 'products' && (
                <div className="flex-1 overflow-hidden flex flex-col relative animate-fade-in" data-testid="panel-projects">
                  
                  {/* OneNote-style Switcher overlay panel */}
                  {showProductPanel && (
                    <div className="absolute inset-0 bg-secondary flex flex-col z-30 border-t border-border animate-slide-in">
                      {/* Switcher Header/Search Area */}
                      <div className="p-3 shrink-0 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Select Product</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onToggleProductPanel(false)}
                            className="h-5 w-5 rounded-md hover:bg-muted text-muted-foreground"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        <input
                          type="text"
                          placeholder="Search products..."
                          value={projectSearchQuery}
                          onChange={(e) => setProjectSearchQuery(e.target.value)}
                          className="w-full h-8 px-2.5 text-xs rounded border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                          autoFocus
                        />
                      </div>

                      {/* Switcher List Area */}
                      <ScrollArea className="flex-1">
                        <div className="px-3 pb-3 space-y-2">
                          {projects.filter(p =>
                            p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                            (p.description || '').toLowerCase().includes(projectSearchQuery.toLowerCase())
                          ).length > 0 ? (
                            projects.filter(p =>
                              p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                              (p.description || '').toLowerCase().includes(projectSearchQuery.toLowerCase())
                            ).map((project) => {
                              const fileCount = project.documents?.length || 0;
                              const projectArtifacts = artifacts.filter(a => a.projectId === project.id);
                              const artifactCount = projectArtifacts.length;
                              const isActive = activeProject?.id === project.id;
                              
                              return (
                                <div
                                  key={project.id}
                                  onClick={() => {
                                    onProjectSelect(project);
                                    onToggleProductPanel(false);
                                    setProjectSearchQuery('');
                                  }}
                                  className={`flex flex-col gap-1 p-3 rounded-lg border cursor-pointer text-left transition-all ${
                                    isActive
                                      ? 'border-primary bg-primary/5 shadow-sm font-semibold'
                                      : 'border-border bg-background/50 hover:bg-muted hover:border-muted-foreground/30 hover:text-foreground'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Folder className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                                      <span className="text-xs font-bold truncate max-w-[140px]">{project.name}</span>
                                    </div>
                                    {isActive && (
                                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    )}
                                  </div>
                                  
                                  {project.description && (
                                    <p className="text-[10px] text-muted-foreground line-clamp-1 truncate font-normal">
                                      {project.description}
                                    </p>
                                  )}
                                  
                                  <div className="flex gap-2 text-[9px] text-muted-foreground/75 font-normal mt-1">
                                    <span>{fileCount} file{fileCount === 1 ? '' : 's'}</span>
                                    <span>•</span>
                                    <span>{artifactCount} output{artifactCount === 1 ? '' : 's'}</span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="py-6 text-center text-xs italic text-muted-foreground">
                              No products match search
                            </div>
                          )}
                        </div>
                      </ScrollArea>

                      {/* Switcher Footer: Add New Product */}
                      <div className="p-3 border-t border-border bg-secondary/80 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onNewProject();
                            onToggleProductPanel(false);
                            setProjectSearchQuery('');
                          }}
                          className="w-full text-xs font-semibold gap-1.5"
                        >
                          <FolderPlus className="w-3.5 h-3.5 text-primary" />
                          New Product
                        </Button>
                      </div>
                    </div>
                  )}

                  {activeProject ? (
                    <>
                      {/* Header Controls for Active Project */}
                      <div className="px-3 pb-2 pt-1 shrink-0 flex flex-col gap-1.5 border-b border-border bg-secondary/50">
                        {/* Home button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 w-full justify-start gap-2 rounded border transition-all ${
                            activeDocument?.type === 'product-home' && activeDocument?.id === `product-home-${activeProject.id}`
                              ? 'border-border bg-background text-primary font-semibold shadow-sm'
                              : 'border-transparent bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                          onClick={() => {
                            const homeDoc: Document = {
                              id: `product-home-${activeProject.id}`,
                              name: 'Product Home',
                              type: 'product-home',
                              content: ''
                            };
                            onDocumentOpen(homeDoc);
                          }}
                        >
                          <Compass className="w-3.5 h-3.5 text-primary" />
                          Product Home
                        </Button>
                        
                        {/* Create Split-Button & Import Button */}
                        <div className="flex gap-1.5 w-full">
                          {/* Create Split-Button */}
                          <div className="flex-1 flex rounded border border-border bg-background divide-x divide-border overflow-hidden">
                            <button
                              onClick={() => onAddFileToProject && onAddFileToProject(activeProject.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 h-8 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5 text-primary" />
                              Create
                            </button>
                            
                            {/* Dropdown Chevron Trigger */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="px-2 flex items-center justify-center h-8 text-muted-foreground hover:bg-muted transition-colors">
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 max-h-[300px] overflow-y-auto z-50">
                                <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                  Create Output
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {Object.entries(ARTIFACT_TYPE_CONFIG).map(([type, config]) => (
                                  <DropdownMenuItem
                                    key={type}
                                    onClick={() => onCreateArtifact && onCreateArtifact(type as ArtifactType)}
                                    className="flex items-center gap-2 cursor-pointer text-xs"
                                  >
                                    <config.icon className="w-3.5 h-3.5 text-primary" />
                                    <span>{config.label}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          {/* Import Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onImportDocument && onImportDocument(activeProject.id)}
                            className="h-8 shrink-0 rounded border border-border bg-background text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground gap-1"
                          >
                            <FolderPlus className="w-3.5 h-3.5 text-primary" />
                            Import
                          </Button>
                        </div>
                      </div>

                      {/* Scroll area for active project files/artifacts */}
                      <ScrollArea className="flex-1">
                        <div className="px-3 py-2 space-y-1.5">
                          {/* Artifact Categories / Tree */}
                          {Object.entries(groupedArtifacts).map(([type, items]) => {
                            const config = ARTIFACT_TYPE_CONFIG[type] || { label: type, icon: FileText, color: 'text-primary' };
                            const TypeIcon = config.icon;
                            return (
                              <div key={type} className="mb-1.5 mt-1 text-xs">
                                <button
                                  className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                  onClick={() => {
                                    setActiveArtifactCategory(type as ArtifactType);
                                    if (onArtifactCategorySelect) onArtifactCategorySelect(type as ArtifactType);
                                    onTabChange('artifacts');
                                  }}
                                >
                                  <TypeIcon className="w-3.5 h-3.5" />
                                  <span className="truncate font-medium text-[11px]">{config.label}</span>
                                </button>
                                <div className="ml-3 mt-1 space-y-1 border-l border-border pl-2.5">
                                  {items.map(artifact => {
                                    const getArtifactDirectory = (type: string): string => {
                                      switch (type) {
                                        case 'roadmap': return 'roadmaps';
                                        case 'product_vision': return 'product-visions';
                                        case 'one_pager': return 'one-pagers';
                                        case 'prd': return 'prds';
                                        case 'initiative': return 'initiatives';
                                        case 'competitive_research': return 'competitive-research';
                                        case 'user_story': return 'user-stories';
                                        case 'insight': return 'insights';
                                        case 'presentation': return 'presentations';
                                        case 'pr_faq': return 'pr-faqs';
                                        default: return 'artifacts';
                                      }
                                    };
                                    const fileName = artifact.id.includes('/') && artifact.id.endsWith('.md')
                                      ? artifact.id
                                      : `${getArtifactDirectory(artifact.artifactType)}/${artifact.id}.md`;
                                    const artifactDoc = {
                                      id: fileName,
                                      name: fileName,
                                      type: 'document',
                                      content: artifact.content,
                                    };
                                    const isActive = activeDocument?.id === artifactDoc.id;

                                    return (
                                      <ContextMenu key={artifact.id}>
                                        <ContextMenuTrigger asChild>
                                          <button
                                            className={`w-full flex items-center gap-2 rounded px-2 py-1 text-left transition-colors ${isActive
                                                ? 'bg-primary/10 text-primary font-semibold'
                                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                              }`}
                                            onClick={() => {
                                              if (isChatFocused) {
                                                window.dispatchEvent(new CustomEvent('productos:chat-peek-file', {
                                                  detail: { fileName: fileName }
                                                }));
                                              } else {
                                                if (onArtifactSelect) onArtifactSelect(artifact);
                                                onTabChange('artifacts');
                                              }
                                            }}
                                          >
                                            <span className={`truncate text-[11px] ${isActive ? 'font-semibold' : ''}`}>{artifact.title}</span>
                                          </button>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent>
                                          <ContextMenuItem
                                            onClick={() => {
                                              window.dispatchEvent(new CustomEvent('productos:chat-peek-file', {
                                                detail: { fileName: fileName }
                                              }));
                                            }}
                                          >
                                            Peek Artifact
                                          </ContextMenuItem>
                                          <ContextMenuSeparator />
                                          <ContextMenuItem onClick={async () => {
                                            const currentTitle = artifact.title;
                                            const newTitle = window.prompt('Enter new title for this artifact:', currentTitle);
                                            if (newTitle && newTitle !== currentTitle) {
                                              await appApi.updateArtifactMetadata(activeProject.id, artifact.artifactType, artifact.id, newTitle);
                                              onProjectSelect(activeProject);
                                            }
                                          }}>
                                            Rename
                                          </ContextMenuItem>
                                          <ContextMenuSub>
                                            <ContextMenuSubTrigger>
                                              Export as...
                                            </ContextMenuSubTrigger>
                                            <ContextMenuSubContent className="w-48">
                                              <ContextMenuItem onClick={() => onExportDocument && onExportDocument(activeProject.id, { ...artifactDoc, name: artifactDoc.name + '.pdf' })}>
                                                As PDF (.pdf)
                                              </ContextMenuItem>
                                              <ContextMenuItem onClick={() => onExportDocument && onExportDocument(activeProject.id, { ...artifactDoc, name: artifactDoc.name + '.docx' })}>
                                                As Word (.docx)
                                              </ContextMenuItem>
                                            </ContextMenuSubContent>
                                          </ContextMenuSub>
                                          <ContextMenuSeparator />
                                          <ContextMenuItem onClick={() => onCreatePresentationFromFile && onCreatePresentationFromFile(activeProject.id, artifactDoc)}>
                                            Create Presentation from this File
                                          </ContextMenuItem>
                                          <ContextMenuSeparator />
                                            <ContextMenuItem
                                              onClick={() => setDeleteDialog({ open: true, type: 'artifact', itemName: artifact.title, artifact })}
                                              className="text-red-500 focus:text-red-500"
                                            >
                                              Delete Artifact
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                      </ContextMenu>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}

                          {/* Standard Documents */}
                          {activeProject.documents && activeProject.documents.length > 0 ? activeProject.documents.map((doc) => {
                            const isActive = activeDocument?.id === doc.id;
                            return (
                              <ContextMenu key={doc.id}>
                                <ContextMenuTrigger asChild>
                                  <button
                                    className={`w-full flex items-center gap-2 rounded px-2 py-1 text-xs transition-colors ${isActive
                                        ? 'bg-primary/10 text-primary font-semibold shadow-sm'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                      }`}
                                    onClick={() => {
                                      if (isChatFocused && doc.type !== 'chat') {
                                        window.dispatchEvent(new CustomEvent('productos:chat-peek-file', {
                                          detail: { fileName: doc.name }
                                        }));
                                      } else {
                                        onDocumentOpen(doc);
                                      }
                                    }}
                                  >
                                    {doc.type === 'chat' ? (
                                      <MessageSquare className={`w-3 h-3 ${isActive ? 'text-primary' : recentlyChangedFiles.has(`${activeProject.id}:${doc.id}`) ? 'text-primary' : 'text-emerald-500/70'}`} />
                                    ) : (
                                      <FileText className={`w-3 h-3 ${isActive ? 'text-primary' : recentlyChangedFiles.has(`${activeProject.id}:${doc.id}`) ? 'text-primary' : 'text-primary/70'}`} />
                                    )}
                                    <span className={`truncate text-[11px] font-medium ${isActive || recentlyChangedFiles.has(`${activeProject.id}:${doc.id}`) ? 'text-primary' : ''}`}>
                                      {doc.name}
                                    </span>
                                    {recentlyChangedFiles.has(`${activeProject.id}:${doc.id}`) && (
                                      <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="ml-auto px-1 py-0.5 rounded-[3px] bg-primary text-primary-foreground text-3xs font-bold tracking-tighter"
                                      >
                                        NEW
                                      </motion.span>
                                    )}
                                  </button>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  <ContextMenuItem
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('productos:chat-peek-file', {
                                        detail: { fileName: doc.name }
                                      }));
                                    }}
                                  >
                                    Peek File
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() => {
                                      window.dispatchEvent(new CustomEvent('productos:chat-reference-file', {
                                        detail: { fileName: doc.name }
                                      }));
                                    }}
                                  >
                                    Reference in Chat
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() => setRenameDialog({ open: true, projectId: activeProject.id, fileId: doc.id, currentName: doc.name })}
                                  >
                                    Rename
                                  </ContextMenuItem>
                                  <ContextMenuSub>
                                    <ContextMenuSubTrigger>
                                      Export as...
                                    </ContextMenuSubTrigger>
                                    <ContextMenuSubContent className="w-48">
                                      <ContextMenuItem onClick={() => onExportDocument && onExportDocument(activeProject.id, { ...doc, name: doc.name + '.pdf' })}>
                                        As PDF (.pdf)
                                      </ContextMenuItem>
                                      <ContextMenuItem onClick={() => onExportDocument && onExportDocument(activeProject.id, { ...doc, name: doc.name + '.docx' })}>
                                        As Word (.docx)
                                      </ContextMenuItem>
                                    </ContextMenuSubContent>
                                  </ContextMenuSub>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem onClick={() => onCreatePresentationFromFile && onCreatePresentationFromFile(activeProject.id, doc)}>
                                    Create Presentation from this File
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuSub>
                                    <ContextMenuSubTrigger className="flex items-center gap-2">
                                      <FileStack className="w-4 h-4 text-muted-foreground/70" />
                                      <span>Convert to Artifact</span>
                                    </ContextMenuSubTrigger>
                                    <ContextMenuSubContent className="w-56">
                                      {Object.entries(ARTIFACT_TYPE_CONFIG).map(([type, config]) => (
                                        <ContextMenuItem
                                          key={type}
                                          onClick={() => onConvertFileToArtifact && onConvertFileToArtifact(activeProject.id, doc, type as ArtifactType)}
                                          className="flex items-center gap-2"
                                        >
                                          <config.icon className="w-4 h-4" />
                                          <span>{config.label}</span>
                                        </ContextMenuItem>
                                      ))}
                                    </ContextMenuSubContent>
                                  </ContextMenuSub>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() => setDeleteDialog({ open: true, type: 'file', projectId: activeProject.id, fileId: doc.id, itemName: doc.name })}
                                    className="text-red-500 focus:text-red-500"
                                  >
                                    Delete File
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            );
                          }) : (
                            Object.keys(groupedArtifacts).length === 0 && <div className="px-2.5 py-2 text-2xs italic text-muted-foreground/50">No files yet</div>
                          )}
                        </div>
                      </ScrollArea>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                      <Folder className="w-8 h-8 opacity-20 mb-2" />
                      <span className="text-xs">No active product</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleProductPanel(true)}
                        className="mt-3 text-xs"
                      >
                        Select Product
                      </Button>
                    </div>
                  )}

                </div>
              )}

              {/* ── Skills / Playbooks Panel ── */}
              {activeTab === 'skills' && (
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in" data-testid="panel-skills">
                  <div className="flex shrink-0 gap-2 px-3 pb-1.5">
                    {onImportSkill && (
                      <Button variant="ghost" size="sm" className="h-8 rounded border border-border bg-background text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground gap-1" onClick={onImportSkill}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        Import
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="ml-auto h-8 rounded border border-border bg-background text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground gap-1" onClick={onNewSkill}>
                      <Plus className="w-3 h-3" />
                      New
                    </Button>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="space-y-1.5 px-3 py-1">
                      <AnimatePresence>
                        {skills.map((skill) => (
                          <motion.div
                            key={skill.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="group cursor-pointer rounded border border-border bg-background p-3 transition-all hover:bg-muted"
                            onClick={() => onSkillSelect && onSkillSelect(skill)}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="rounded bg-primary/10 p-1.5 text-primary">
                                <Zap className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-foreground truncate">{skill.name}</h4>
                                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-normal">{skill.description}</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteDialog({ open: true, type: 'skill', itemName: skill.name, skill });
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                                aria-label="Delete Skill"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* ── Artifacts Panel ── */}
              {activeTab === 'artifacts' && (
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in" data-testid="panel-artifacts">
                  <ArtifactList
                    artifacts={artifacts}
                    activeArtifactId={activeArtifactId}
                    filterType={activeArtifactCategory}
                    onArtifactSelect={onArtifactSelect || (() => { })}
                    onCreateArtifact={onCreateArtifact || (() => { })}
                    onImportArtifact={onImportArtifact || (() => { })}
                    onDeleteArtifact={onDeleteArtifact}
                    onArtifactUpdate={onArtifactUpdate}
                    onExportDocument={onExportDocument}
                    isChatFocused={isChatFocused}
                    onCreatePresentationFromFile={onCreatePresentationFromFile}
                  />
                </div>
              )}

              {/* ── Workflows Panel ── */}
              {activeTab === 'workflows' && (
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in" data-testid="panel-workflows">
                  <WorkflowList
                    workflows={workflows}
                    activeWorkflowId={activeWorkflowId}
                    onSelect={onWorkflowSelect || (() => { })}
                    onCreate={onNewWorkflow || (() => { })}
                    onRun={onRunWorkflow || (() => { })}
                    onDelete={onDeleteWorkflow || (() => { })}
                    onEdit={onEditWorkflow}
                    onQuickSchedule={onQuickScheduleWorkflow}
                    onOpenOptimizer={onOpenWorkflowOptimizer}
                    isLoading={false}
                  />
                </div>
              )}

              {/* ── Models Panel ── */}
              {activeTab === 'models' && (
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in">
                  <ScrollArea className="flex-1">
                    <div className="space-y-3 px-4 py-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                        <div className="flex items-center gap-2 mb-2">
                          <Cpu className="w-4 h-4 text-primary" />
                          <span className="text-xs font-semibold">Active Provider</span>
                        </div>
                        <p className="text-2xs text-muted-foreground">Configure AI engines in App Settings</p>
                        <Button variant="ghost" size="sm" className="mt-3 h-9 w-full rounded-xl border border-white/10 bg-white/5 text-2xs hover:bg-primary/10 hover:text-primary" onClick={onOpenModelsCost}>
                          Open App Settings
                        </Button>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                        <div className="text-2xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Cost Summary</div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-2xs">
                            <span className="text-muted-foreground italic">Product Total</span>
                            <span data-testid="sidebar-product-total" className="font-mono font-medium text-emerald-500">${Number(projectCost).toFixed(2)}</span>
                          </div>
                          <div className="pt-1 border-t border-primary/5">
                            <Button
                              variant="link"
                              data-testid="sidebar-view-more-usage"
                              className="h-auto p-0 text-2xs text-primary/60 hover:text-primary transition-colors flex items-center gap-1 ml-auto"
                              onClick={onOpenSettingsUsage}
                            >
                              View more
                              <ChevronRight className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              )}


            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogs */}
      {renameDialog && (
        <RenameDialog
          open={renameDialog.open}
          onOpenChange={(open) => !open && setRenameDialog(null)}
          currentName={renameDialog.currentName}
          onConfirm={(newName) => {
            if (onRenameFile) onRenameFile(renameDialog.projectId, renameDialog.fileId, newName);
          }}
        />
      )}
      {deleteDialog && (
        <ConfirmationDialog
          open={deleteDialog.open}
          onOpenChange={(open) => !open && setDeleteDialog(null)}
          title={
            deleteDialog.type === 'shutdown' ? 'Terminate ProductOS' :
            deleteDialog.type === 'project' ? 'Delete Product' :
            deleteDialog.type === 'file' ? 'Delete File' :
            deleteDialog.type === 'artifact' ? 'Delete Artifact' :
            'Delete Skill'
          }
          description={
            deleteDialog.type === 'shutdown' ? 'Are you sure you want to shut down the application? This will terminate all active processes and clear secrets from memory.' :
            deleteDialog.type === 'project'
              ? `This will delete all data associated with "${deleteDialog.itemName}". This action is irreversible.`
              : deleteDialog.type === 'artifact'
                ? `This will delete the artifact "${deleteDialog.itemName}" and its backing file. This action cannot be undone.`
                : deleteDialog.type === 'skill'
                  ? `This will delete the skill "${deleteDialog.itemName}". This action cannot be undone.`
                  : `This will delete the file "${deleteDialog.itemName}" from the current product. This action cannot be undone.`
          }
          confirmText={
            deleteDialog.type === 'shutdown' ? 'Quit Application' :
            deleteDialog.type === 'project' ? 'Delete product' :
            deleteDialog.type === 'artifact' ? 'Delete artifact' :
            deleteDialog.type === 'skill' ? 'Delete skill' :
            'Delete file'
          }
          requireTypeConfirm={deleteDialog.requireTypeConfirm}
          scopeSummary={deleteDialog.scopeSummary}
          onConfirm={() => {
            if (deleteDialog.type === 'shutdown') {
              if (onShutdown) {
                onShutdown();
              } else {
                appApi.shutdownApp();
              }
            } else if (deleteDialog.type === 'project' && deleteDialog.projectId && onDeleteProject) {
              onDeleteProject(deleteDialog.projectId);
            } else if (deleteDialog.type === 'file' && deleteDialog.projectId && deleteDialog.fileId && onDeleteFile) {
              onDeleteFile(deleteDialog.projectId, deleteDialog.fileId);
            } else if (deleteDialog.type === 'artifact' && deleteDialog.artifact && onDeleteArtifact) {
              onDeleteArtifact(deleteDialog.artifact);
            } else if (deleteDialog.type === 'skill' && deleteDialog.skill && onDeleteSkill) {
              onDeleteSkill(deleteDialog.skill);
            }
            setDeleteDialog(null);
          }}
        />
      )}
    </div>
  );
}
