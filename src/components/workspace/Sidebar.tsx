import { useState, useEffect } from 'react';
import { Folder, FileStack, Activity, Cpu, Settings, Plus, ChevronRight, Zap, FileText, MessageSquare, X, FolderPlus, Compass, Eye, LayoutTemplate, Rocket, Swords, Users, MonitorPlay, ClipboardList, Lightbulb, LogOut, Download, Sparkles } from 'lucide-react';
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
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

import { appApi } from '@/api/app';
import type { Project, Skill, Workflow, Artifact, ArtifactType } from '@/api/app';

interface Document {
  id: string;
  name: string;
  type: string;
  content: string;
}

const ARTIFACT_TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  roadmap: { icon: Compass, label: 'Roadmaps', color: 'text-violet-500 bg-violet-500/10 border-violet-500/10' },
  product_vision: { icon: Eye, label: 'Product Visions', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/10' },
  one_pager: { icon: LayoutTemplate, label: 'One Pagers', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/10' },
  prd: { icon: ClipboardList, label: 'PRDs', color: 'text-blue-500 bg-blue-500/10 border-blue-500/10' },
  initiative: { icon: Rocket, label: 'Initiatives', color: 'text-orange-500 bg-orange-500/10 border-orange-500/10' },
  competitive_research: { icon: Swords, label: 'Competitive Research', color: 'text-teal-500 bg-teal-500/10 border-teal-500/10' },
  user_story: { icon: Users, label: 'User Stories', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/10' },
  insight: { icon: Lightbulb, label: 'Insights', color: 'text-amber-500 bg-amber-500/10 border-amber-500/10' },
  presentation: { icon: MonitorPlay, label: 'Presentations', color: 'text-purple-500 bg-purple-500/10 border-purple-500/10' },
  pr_faq: { icon: ClipboardList, label: 'PR-FAQs', color: 'text-orange-500 bg-orange-500/10 border-orange-500/10' },
};

interface SidebarProps {
  projects: (Project & { documents?: Document[] })[];
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
}

const navItems = [
  { id: 'products', icon: Folder, label: 'Products' },
  { id: 'skills', icon: Zap, label: 'Skills' },
  { id: 'artifacts', icon: FileStack, label: 'Artifacts' },
  { id: 'workflows', icon: Activity, label: 'Workflows' },
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
}: SidebarProps) {
  const [internalFlyoutOpen, setInternalFlyoutOpen] = useState(false);
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
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'project' | 'file' | 'artifact'; projectId?: string; fileId?: string; itemName: string; artifact?: Artifact; } | null>(null);

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
    <div className="relative z-20 flex h-full">
      {/* ─── Icon Rail ─── */}
      <nav data-testid="sidebar-navigation" aria-label="Main navigation" className={`${flyoutOpen ? 'w-[76px] sm:w-[152px]' : 'w-[76px]'} flex shrink-0 flex-col overflow-hidden border-r border-white/10 bg-background/55 px-3 py-4 backdrop-blur-2xl transition-all duration-200`}>
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
            <Logo size="sm" />
          </div>
          {flyoutOpen && (
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:block">
              Control
            </div>
          )}
        </div>

        {/* Nav Icons */}
        <div className="flex flex-1 flex-col gap-1.5 w-full">
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
                  relative flex items-center rounded-2xl border transition-all duration-200
                  ${flyoutOpen ? 'h-11 w-full gap-3 px-3' : 'mx-auto h-11 w-11 justify-center'}
                  ${isActive
                    ? 'border-primary/20 bg-primary/12 text-primary shadow-[0_10px_24px_rgba(59,130,246,0.14)]'
                    : 'border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground'
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="rail-indicator"
                    className="absolute left-0 h-6 w-[3px] rounded-r-full bg-primary shadow-[0_0_10px_hsla(183,70%,48%,0.45)]"
                  />
                )}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-primary/12' : 'bg-white/5'}`}>
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
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
        <div className="mt-auto flex w-full flex-col gap-1.5 border-t border-white/10 pt-3">
          <button
            onClick={() => {
              onOpenSettings?.();
              setFlyoutOpen(false);
            }}
            data-testid="nav-settings"
            title="App settings"
            aria-label="App settings"
            className={`
              flex items-center rounded-2xl border transition-all duration-200
              ${flyoutOpen ? 'h-11 w-full gap-3 px-3' : 'mx-auto h-11 w-11 justify-center'}
              ${activeTab === 'settings'
                ? 'border-primary/20 bg-primary/12 text-primary'
                : 'border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground'
              }
            `}
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${activeTab === 'settings' ? 'bg-primary/12' : 'bg-white/5'}`}>
              <Settings className="h-[18px] w-[18px] shrink-0" />
            </div>
            {flyoutOpen && (
              <span className="hidden truncate text-xs font-semibold sm:block">App Settings</span>
            )}
          </button>

          {isInstallable && (
            <button
              onClick={onInstall}
              title="Install App"
              className={`
                mt-1 flex items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-all duration-200 hover:bg-primary/20
                ${flyoutOpen ? 'h-11 w-full gap-3 px-3' : 'mx-auto h-11 w-11 justify-center'}
              `}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12">
                <Download className="h-[18px] w-[18px] shrink-0" />
              </div>
              {flyoutOpen && (
                <span className="hidden truncate text-xs font-semibold sm:block">Install App</span>
              )}
            </button>
          )}

          <button
            onClick={async () => {
              if (onShutdown) {
                if (window.confirm("Are you sure you want to terminate ProductOS and the companion server? This will clear all secrets from memory.")) {
                  onShutdown();
                }
              } else {
                if (window.confirm("Are you sure you want to terminate ProductOS and the companion server? This will clear all secrets from memory.")) {
                   await appApi.shutdownApp();
                }
              }
            }}
            data-testid="nav-quit"
            title="Quit Application"
            className={`
              mt-1 flex items-center rounded-2xl border transition-all duration-200
              ${flyoutOpen ? 'h-11 w-full gap-3 px-3' : 'mx-auto h-11 w-11 justify-center'}
              border-transparent text-red-400 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-300
            `}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
              <LogOut className="h-[18px] w-[18px] shrink-0" />
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
            animate={{ width: 'min(272px, calc(100vw - 76px))', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute left-[76px] top-0 z-30 h-full overflow-hidden border-r border-white/10 bg-background/90 shadow-2xl backdrop-blur-2xl sm:relative sm:left-auto sm:z-auto sm:shrink-0 sm:bg-background/45 sm:shadow-none"
          >
            <div className="flex h-full w-[min(272px,calc(100vw-76px))] flex-col">
              {/* Flyout Header */}
              <div className="shrink-0 px-4 pb-3 pt-4">
                <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
                  <div className="min-w-0">
                    <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                      <Sparkles className="h-3 w-3" />
                      Workspace
                    </div>
                    <h3 data-testid="sidebar-flyout-header" className="truncate text-sm font-semibold text-foreground">
                      {activeNav?.label || 'Settings'}
                    </h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {activeTab === 'products' && 'Browse projects, files, and artifacts.'}
                      {activeTab === 'skills' && 'Manage reusable skills and playbooks.'}
                      {activeTab === 'artifacts' && 'Jump between structured product docs.'}
                      {activeTab === 'workflows' && 'Run and refine workflow automations.'}
                      {activeTab === 'models' && 'Review model setup and product usage.'}
                    </p>
                  </div>
                <button
                  onClick={() => setFlyoutOpen(false)}
                  data-testid="flyout-close-button"
                  aria-label={`Close ${activeNav?.label || 'Settings'} panel`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                </div>
              </div>

              {/* ── Projects Panel ── */}
              {activeTab === 'products' && (
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in" data-testid="panel-projects">
                  <div className="px-4 pb-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 w-full justify-start gap-2 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-muted-foreground hover:bg-white/10 hover:text-foreground"
                      data-testid="btn-create-new-project"
                      onClick={onNewProject}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Product
                    </Button>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="px-3 py-1.5 space-y-1.5">
                      <AnimatePresence>
                        {projects.map((project) => (
                          <motion.div
                            key={project.id}
                            layout
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                          >
                            <div
                              className={`relative flex items-center group rounded-2xl border transition-all duration-150 ${activeProject?.id === project.id
                                ? 'border-primary/20 bg-primary/10 text-foreground shadow-[0_10px_28px_rgba(59,130,246,0.12)]'
                                : 'border-white/5 text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground'
                                }`}
                              data-testid={`project-item-${project.name}`}
                            >
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <button
                                    className="flex w-full flex-1 items-center gap-2.5 px-3 py-3 text-left text-sm font-medium truncate"
                                    onClick={() => onProjectSelect(project)}
                                    onContextMenu={() => onProjectSelect(project)}
                                  >
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${activeProject?.id === project.id ? 'bg-primary/12 text-primary' : 'bg-white/5 text-muted-foreground'}`}>
                                      <Folder className="h-4 w-4 shrink-0" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <span className="block truncate">{project.name}</span>
                                      <span className="block text-[11px] text-muted-foreground">Product workspace</span>
                                    </div>
                                    {activeProject?.id === project.id && (
                                      <ChevronRight className="ml-auto h-3 w-3 opacity-40" />
                                    )}
                                  </button>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-48">
                                  <ContextMenuItem onClick={() => onAddFileToProject && onAddFileToProject(project.id)}>
                                    <Plus className="mr-2 h-4 w-4" /> Add File
                                  </ContextMenuItem>
                                  <ContextMenuItem onClick={() => onImportDocument && onImportDocument(project.id)}>
                                    <FolderPlus className="mr-2 h-4 w-4" /> Import Document
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() => setDeleteDialog({ open: true, type: 'project', projectId: project.id, itemName: project.name })}
                                    className="text-red-500 focus:text-red-500"
                                    data-testid="btn-delete-project"
                                  >
                                    Delete Product
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            </div>

                            {/* Expanded files */}
                            <AnimatePresence>
                              {activeProject?.id === project.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mb-2 ml-6 mt-1 space-y-1 border-l border-white/10 pl-3">
                                    {/* Grouped Artifacts */}
                                    {Object.entries(groupedArtifacts).map(([type, items]) => {
                                      const config = ARTIFACT_TYPE_CONFIG[type] || { label: type, icon: FileText, color: 'text-primary' };
                                      const TypeIcon = config.icon;
                                      return (
                                        <div key={type} className="mb-2 mt-1 text-xs">
                                          <button
                                            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                                            onClick={() => {
                                              setActiveArtifactCategory(type as ArtifactType);
                                              if (onArtifactCategorySelect) onArtifactCategorySelect(type as ArtifactType);
                                              onTabChange('artifacts');
                                            }}
                                          >
                                            <TypeIcon className="w-3.5 h-3.5" />
                                            <span className="truncate font-medium">{config.label}</span>
                                          </button>
                                          <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-3">
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
                                              const fileName = `${getArtifactDirectory(artifact.artifactType)}/${artifact.id}.md`;
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
                                                      className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${isActive
                                                          ? 'bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20'
                                                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                                                        }`}
                                                      onClick={() => {
                                                        if (onArtifactSelect) onArtifactSelect(artifact);
                                                        onTabChange('artifacts');
                                                      }}
                                                    >
                                                      <span className={`truncate text-xs ${isActive ? 'font-semibold' : ''}`}>{artifact.title}</span>
                                                    </button>
                                                  </ContextMenuTrigger>
                                                  <ContextMenuContent>
                                                    <ContextMenuItem onClick={async () => {
                                                      const currentTitle = artifact.title;
                                                      const newTitle = window.prompt('Enter new title for this artifact:', currentTitle);
                                                      if (newTitle && newTitle !== currentTitle) {
                                                        await appApi.updateArtifactMetadata(project.id, artifact.artifactType, artifact.id, newTitle);
                                                        onProjectSelect(project);
                                                      }
                                                    }}>
                                                      Rename
                                                    </ContextMenuItem>
                                                    <ContextMenuSub>
                                                      <ContextMenuSubTrigger>
                                                        Export as...
                                                      </ContextMenuSubTrigger>
                                                      <ContextMenuSubContent className="w-48">
                                                        <ContextMenuItem onClick={() => onExportDocument && onExportDocument(project.id, { ...artifactDoc, name: artifactDoc.name + '.pdf' })}>
                                                          As PDF (.pdf)
                                                        </ContextMenuItem>
                                                        <ContextMenuItem onClick={() => onExportDocument && onExportDocument(project.id, { ...artifactDoc, name: artifactDoc.name + '.docx' })}>
                                                          As Word (.docx)
                                                        </ContextMenuItem>
                                                      </ContextMenuSubContent>
                                                    </ContextMenuSub>
                                                    <ContextMenuSeparator />
                                                    <ContextMenuItem onClick={() => onCreatePresentationFromFile && onCreatePresentationFromFile(project.id, artifactDoc)}>
                                                      Create Presentation from this File
                                                    </ContextMenuItem>
                                                    <ContextMenuSeparator />
                                                    <ContextMenuItem
                                                      onClick={() => setDeleteDialog({ open: true, type: 'artifact', itemName: artifact.title, artifact })}
                                                      className="text-red-500 focus:text-red-500"
                                                    >
                                                      Delete File
                                                    </ContextMenuItem>
                                                  </ContextMenuContent>
                                                </ContextMenu>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {project.documents && project.documents.length > 0 ? project.documents.map((doc) => {
                                      const isActive = activeDocument?.id === doc.id;
                                      return (
                                        <ContextMenu key={doc.id}>
                                          <ContextMenuTrigger asChild>
                                            <button
                                              className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${isActive
                                                  ? 'bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20'
                                                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                                                }`}
                                              onClick={() => onDocumentOpen(doc)}
                                            >
                                              {doc.type === 'chat' ? (
                                                <MessageSquare className={`w-3 h-3 ${isActive ? 'text-primary' : recentlyChangedFiles.has(`${project.id}:${doc.id}`) ? 'text-primary' : 'text-emerald-500/70'}`} />
                                              ) : (
                                                <FileText className={`w-3 h-3 ${isActive ? 'text-primary' : recentlyChangedFiles.has(`${project.id}:${doc.id}`) ? 'text-primary' : 'text-primary/70'}`} />
                                              )}
                                              <span className={`truncate text-xs font-medium ${isActive || recentlyChangedFiles.has(`${project.id}:${doc.id}`) ? 'text-primary' : ''}`}>
                                                {doc.name}
                                              </span>
                                              {recentlyChangedFiles.has(`${project.id}:${doc.id}`) && (
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
                                              onClick={() => setRenameDialog({ open: true, projectId: project.id, fileId: doc.id, currentName: doc.name })}
                                            >
                                              Rename
                                            </ContextMenuItem>
                                            <ContextMenuSub>
                                              <ContextMenuSubTrigger>
                                                Export as...
                                              </ContextMenuSubTrigger>
                                              <ContextMenuSubContent className="w-48">
                                                <ContextMenuItem onClick={() => onExportDocument && onExportDocument(project.id, { ...doc, name: doc.name + '.pdf' })}>
                                                  As PDF (.pdf)
                                                </ContextMenuItem>
                                                <ContextMenuItem onClick={() => onExportDocument && onExportDocument(project.id, { ...doc, name: doc.name + '.docx' })}>
                                                  As Word (.docx)
                                                </ContextMenuItem>
                                              </ContextMenuSubContent>
                                            </ContextMenuSub>
                                            <ContextMenuSeparator />
                                            <ContextMenuItem onClick={() => onCreatePresentationFromFile && onCreatePresentationFromFile(project.id, doc)}>
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
                                                    onClick={() => onConvertFileToArtifact && onConvertFileToArtifact(project.id, doc, type as ArtifactType)}
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
                                              onClick={() => setDeleteDialog({ open: true, type: 'file', projectId: project.id, fileId: doc.id, itemName: doc.name })}
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
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* ── Skills / Playbooks Panel ── */}
              {activeTab === 'skills' && (
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in" data-testid="panel-skills">
                  <div className="flex shrink-0 gap-2 px-4 pb-2">
                    {onImportSkill && (
                      <Button variant="ghost" size="sm" className="h-9 rounded-xl border border-white/10 bg-white/5 text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground gap-1.5" onClick={onImportSkill}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        Import
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="ml-auto h-9 rounded-xl border border-white/10 bg-white/5 text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground gap-1.5" onClick={onNewSkill}>
                      <Plus className="w-3.5 h-3.5" />
                      New
                    </Button>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="space-y-2 px-3 py-1.5">
                      <AnimatePresence>
                        {skills.map((skill) => (
                          <motion.div
                            key={skill.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="group cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-3.5 transition-all hover:border-primary/15 hover:bg-white/8"
                            onClick={() => onSkillSelect && onSkillSelect(skill)}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="rounded-xl bg-primary/10 p-2 text-primary ring-1 ring-primary/10">
                                <Zap className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-semibold text-foreground truncate">{skill.name}</h4>
                                <p className="text-2xs text-muted-foreground line-clamp-2 mt-0.5">{skill.description}</p>
                              </div>
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
          title={`Delete ${deleteDialog.type === 'project' ? 'product' : deleteDialog.type}?`}
          description={deleteDialog.type === 'project'
            ? `This will delete the product "${deleteDialog.itemName}" and its files, artifacts, workflows, and research history. This action cannot be undone.`
            : deleteDialog.type === 'artifact'
              ? `This will delete the artifact "${deleteDialog.itemName}" and its backing file. This action cannot be undone.`
              : `This will delete the file "${deleteDialog.itemName}" from the current product. This action cannot be undone.`}
          confirmText={deleteDialog.type === 'project' ? 'Delete product' : deleteDialog.type === 'artifact' ? 'Delete artifact' : 'Delete file'}
          onConfirm={() => {
            if (deleteDialog.type === 'project' && deleteDialog.projectId && onDeleteProject) {
              onDeleteProject(deleteDialog.projectId);
            } else if (deleteDialog.type === 'file' && deleteDialog.projectId && deleteDialog.fileId && onDeleteFile) {
              onDeleteFile(deleteDialog.projectId, deleteDialog.fileId);
            } else if (deleteDialog.type === 'artifact' && deleteDialog.artifact && onDeleteArtifact) {
              onDeleteArtifact(deleteDialog.artifact);
            }
          }}
        />
      )}
    </div>
  );
}
