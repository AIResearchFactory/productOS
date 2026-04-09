import { useState, useEffect } from 'react';
import { Folder, FileStack, Activity, Cpu, Settings, Plus, ChevronRight, Zap, FileText, MessageSquare, X, FolderPlus, Compass, Eye, LayoutTemplate, Rocket, Swords, Users, MonitorPlay, ClipboardList, Lightbulb, LogOut } from 'lucide-react';
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
  roadmap: { icon: Compass, label: 'Roadmaps', color: 'text-amber-500 bg-amber-500/10 border-amber-500/10' },
  product_vision: { icon: Eye, label: 'Product Visions', color: 'text-blue-500 bg-blue-500/10 border-blue-500/10' },
  one_pager: { icon: LayoutTemplate, label: 'One Pagers', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/10' },
  prd: { icon: ClipboardList, label: 'PRDs', color: 'text-purple-500 bg-purple-500/10 border-purple-500/10' },
  initiative: { icon: Rocket, label: 'Initiatives', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/10' },
  competitive_research: { icon: Swords, label: 'Competitive Research', color: 'text-rose-500 bg-rose-500/10 border-rose-500/10' },
  user_story: { icon: Users, label: 'User Stories', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/10' },
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
}

const navItems = [
  { id: 'projects', icon: Folder, label: 'Products' },
  { id: 'research', icon: Zap, label: 'Skills' },
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
    if (activeTab === 'models' && activeProject?.id) {
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

  return (
    <div className="flex h-full relative z-20">
      {/* ─── Icon Rail ─── */}
      <nav aria-label="Main navigation" className={`${flyoutOpen ? 'w-[140px]' : 'w-14'} glass-panel border-r border-border/50 flex flex-col items-center py-3 shrink-0 transition-all duration-200`}>
        {/* Logo */}
        <div className="mb-6">
          <Logo size="sm" />
        </div>

        {/* Nav Icons */}
        <div className="flex-1 flex flex-col gap-1 w-full px-2">
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
                  relative rounded-lg flex items-center transition-all duration-200
                  ${flyoutOpen ? 'w-full h-10 gap-2 px-2.5' : 'w-10 h-10 justify-center mx-auto'}
                  ${isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }
                `}
              >
                {isActive && (
                  <motion.div
                    layoutId="rail-indicator"
                    className="absolute left-0 w-[3px] h-5 bg-primary rounded-r-full shadow-[0_0_8px_hsla(183,70%,48%,0.4)]"
                  />
                )}
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {flyoutOpen && (
                  <span className="text-xs font-medium truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom: Settings */}
        <div className="flex flex-col gap-1 mt-auto w-full px-2">
          <button
            onClick={() => {
              onOpenSettings?.();
              setFlyoutOpen(false);
            }}
            title="Settings"
            aria-label="Settings"
            className={`
              rounded-lg flex items-center transition-all duration-200
              ${flyoutOpen ? 'w-full h-10 gap-2 px-2.5' : 'w-10 h-10 justify-center mx-auto'}
              ${activeTab === 'settings'
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }
            `}
          >
            <Settings className="w-[18px] h-[18px] shrink-0" />
            {flyoutOpen && (
              <span className="text-xs font-medium truncate">Settings</span>
            )}
          </button>

          <button
            onClick={async () => {
              if (window.confirm("Are you sure you want to terminate productOS and the companion server? This will clear all secrets from memory.")) {
                await appApi.shutdownApp();
              }
            }}
            title="Quit Application"
            className={`
              rounded-lg flex items-center transition-all duration-200 mt-1
              ${flyoutOpen ? 'w-full h-10 gap-2 px-2.5' : 'w-10 h-10 justify-center mx-auto'}
              text-red-400 hover:text-red-500 hover:bg-red-500/10
            `}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {flyoutOpen && (
              <span className="text-xs font-medium truncate">Quit</span>
            )}
          </button>
        </div>
      </nav>

      {/* ─── Flyout Panel ─── */}
      <AnimatePresence>
        {flyoutOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="glass-panel border-r border-border/50 overflow-hidden shrink-0"
          >
            <div className="w-[240px] h-full flex flex-col">
              {/* Flyout Header */}
              <div className="px-4 pt-4 pb-3 flex justify-between items-center shrink-0">
                <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  {navItems.find(n => n.id === activeTab)?.label || 'Settings'}
                </h3>
                <button
                  onClick={() => setFlyoutOpen(false)}
                  aria-label={`Close ${navItems.find(n => n.id === activeTab)?.label || 'Settings'} panel`}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* ── Projects Panel ── */}
              {activeTab === 'projects' && (
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in" data-testid="panel-projects">
                  <div className="px-4 pb-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground"
                      onClick={onNewProject}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Product
                    </Button>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="px-2 py-1 space-y-0.5">
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
                              className={`relative flex items-center group rounded-lg transition-all duration-150 ${activeProject?.id === project.id
                                ? 'bg-primary/8 text-foreground'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                }`}
                            >
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <button
                                    className="flex-1 flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-left truncate w-full"
                                    onClick={() => onProjectSelect(project)}
                                    onContextMenu={() => onProjectSelect(project)}
                                  >
                                    <Folder className={`w-4 h-4 shrink-0 ${activeProject?.id === project.id ? 'text-primary' : ''}`} />
                                    <span className="truncate">{project.name}</span>
                                    {activeProject?.id === project.id && (
                                      <ChevronRight className="w-3 h-3 ml-auto opacity-40" />
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
                                  <div className="ml-6 mt-0.5 mb-1.5 space-y-0.5 border-l border-border pl-2">
                                      {/* Grouped Artifacts */}
                                      {Object.entries(groupedArtifacts).map(([type, items]) => {
                                        const config = ARTIFACT_TYPE_CONFIG[type] || { label: type, icon: FileText, color: 'text-primary' };
                                        const TypeIcon = config.icon;
                                        return (
                                          <div key={type} className="mt-1 mb-2 text-xs">
                                            <button
                                              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                              onClick={() => {
                                                setActiveArtifactCategory(type as ArtifactType);
                                                if (onArtifactCategorySelect) onArtifactCategorySelect(type as ArtifactType);
                                                onTabChange('artifacts');
                                              }}
                                            >
                                              <TypeIcon className="w-3.5 h-3.5" />
                                              <span className="truncate font-medium">{config.label}</span>
                                            </button>
                                            <div className="ml-4 pl-2 border-l border-border mt-0.5 space-y-0.5">
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
                                                        className={`w-full flex items-center gap-2 py-1 px-2 rounded-md transition-colors text-left ${
                                                          isActive
                                                            ? 'bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20'
                                                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                                        }`}
                                                        onClick={() => {
                                                          if (onArtifactSelect) onArtifactSelect(artifact);
                                                          onTabChange('artifacts');
                                                        }}
                                                      >
                                                        <span className={`truncate text-[11px] ${isActive ? 'font-semibold' : ''}`}>{artifact.title}</span>
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
                                              className={`w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded-md transition-colors ${
                                                isActive 
                                                  ? 'bg-primary/15 text-primary shadow-sm ring-1 ring-primary/20' 
                                                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                              }`}
                                              onClick={() => onDocumentOpen(doc)}
                                            >
                                              {doc.type === 'chat' ? (
                                                <MessageSquare className={`w-3 h-3 ${isActive ? 'text-primary' : recentlyChangedFiles.has(`${project.id}:${doc.id}`) ? 'text-primary' : 'text-emerald-500/70'}`} />
                                              ) : (
                                                <FileText className={`w-3 h-3 ${isActive ? 'text-primary' : recentlyChangedFiles.has(`${project.id}:${doc.id}`) ? 'text-primary' : 'text-primary/70'}`} />
                                              )}
                                              <span className={`truncate text-[11px] font-medium ${isActive || recentlyChangedFiles.has(`${project.id}:${doc.id}`) ? 'text-primary' : ''}`}>
                                                {doc.name}
                                              </span>
                                            {recentlyChangedFiles.has(`${project.id}:${doc.id}`) && (
                                              <motion.span
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="ml-auto px-1 py-0.5 rounded-[3px] bg-primary text-primary-foreground text-[8px] font-bold tracking-tighter"
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
                                    Object.keys(groupedArtifacts).length === 0 && <div className="text-[10px] text-muted-foreground/40 py-1.5 px-2 italic">No files yet</div>
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
              {activeTab === 'research' && (
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in">
                  <div className="px-4 pb-2 flex gap-1 shrink-0">
                    {onImportSkill && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5" onClick={onImportSkill}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                        Import
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5 ml-auto" onClick={onNewSkill}>
                      <Plus className="w-3.5 h-3.5" />
                      New
                    </Button>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="px-2 py-1 space-y-1">
                      <AnimatePresence>
                        {skills.map((skill) => (
                          <motion.div
                            key={skill.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-3 rounded-lg glass-card cursor-pointer transition-all group"
                            onClick={() => onSkillSelect && onSkillSelect(skill)}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <Zap className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-semibold text-foreground truncate">{skill.name}</h4>
                                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{skill.description}</p>
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
                    <div className="px-4 py-2 space-y-3">
                      <div className="p-3 rounded-lg glass-card">
                        <div className="flex items-center gap-2 mb-2">
                          <Cpu className="w-4 h-4 text-primary" />
                          <span className="text-xs font-semibold">Active Provider</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Configure models in Settings</p>
                        <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-[10px] hover:bg-primary/10 hover:text-primary" onClick={onOpenModelsCost}>
                          Open Model Settings
                        </Button>
                      </div>
                      <div className="p-3 rounded-lg glass-card">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Cost Summary</div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-muted-foreground italic">Product Total</span>
                            <span className="font-mono font-medium text-emerald-500">${projectCost.toFixed(4)}</span>
                          </div>
                          <div className="pt-1 border-t border-primary/5">
                            <Button 
                              variant="link" 
                              className="h-auto p-0 text-[9px] text-primary/60 hover:text-primary transition-colors flex items-center gap-1 ml-auto"
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
          title={`Delete ${deleteDialog.type}`}
          description={`Are you sure you want to delete "${deleteDialog.itemName}"? This action cannot be undone.`}
          confirmText="Delete"
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
