import { useState, useEffect } from 'react';
import { Folder, FileStack, Activity, Cpu, Settings, Plus, ChevronRight, Zap, FileText, MessageSquare, X } from 'lucide-react';
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
} from '@/components/ui/context-menu';
import { motion, AnimatePresence } from 'framer-motion';

import { type Project, type Skill, type Workflow, type Artifact, type ArtifactType, tauriApi } from '@/api/tauri';

interface Document {
  id: string;
  name: string;
  type: string;
  content: string;
}

interface SidebarProps {
  projects: (Project & { documents?: Document[] })[];
  skills: Skill[];
  activeProject: (Project & { documents?: Document[] }) | null;
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
  onDeleteProject?: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onAddFileToProject?: (projectId: string) => void;
  onDeleteFile?: (projectId: string, fileId: string) => void;
  onRenameFile?: (projectId: string, fileId: string, newName: string) => void;
  onImportSkill?: () => void;
  artifacts?: Artifact[];
  activeArtifactId?: string;
  onArtifactSelect?: (artifact: Artifact) => void;
  onCreateArtifact?: (type: ArtifactType) => void;
  onDeleteArtifact?: (artifact: Artifact) => void;
  onOpenSettings?: () => void;
  onOpenModelsCost?: () => void;
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
  onDeleteProject,
  onAddFileToProject,
  onDeleteFile,
  onRenameFile,
  onImportSkill,
  artifacts = [],
  activeArtifactId,
  onArtifactSelect,
  onCreateArtifact,
  onDeleteArtifact,
  onOpenSettings,
  onOpenModelsCost,
}: SidebarProps) {
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [projectCost, setProjectCost] = useState<number>(0);

  // Fetch project cost dynamically
  useEffect(() => {
    if (activeTab === 'models' && activeProject?.id) {
      tauriApi.getProjectCost(activeProject.id)
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

  return (
    <div className="flex h-full relative z-20">
      {/* ─── Icon Rail ─── */}
      <div className={`${flyoutOpen ? 'w-[140px]' : 'w-14'} glass-panel border-r border-border/50 flex flex-col items-center py-3 shrink-0 transition-all duration-200`}>
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
                onClick={() => handleNavClick(item.id)}
                title={item.label}
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
        </div>
      </div>

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
                  className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* ── Projects Panel ── */}
              {activeTab === 'projects' && (
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in">
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
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() => onDeleteProject && onDeleteProject(project.id)}
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
                                    {project.documents && project.documents.length > 0 ? project.documents.map((doc) => (
                                      <ContextMenu key={doc.id}>
                                        <ContextMenuTrigger asChild>
                                          <button
                                            className="w-full flex items-center gap-2 text-xs py-1.5 px-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                            onClick={() => onDocumentOpen(doc)}
                                          >
                                            {doc.type === 'chat' ? (
                                              <MessageSquare className="w-3 h-3 text-emerald-500/70" />
                                            ) : (
                                              <FileText className="w-3 h-3 text-primary/70" />
                                            )}
                                            <span className="truncate text-[11px] font-medium">{doc.name}</span>
                                          </button>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent>
                                          <ContextMenuItem onClick={() => {
                                            const newName = prompt('New file name:', doc.name);
                                            if (newName && onRenameFile) onRenameFile(project.id, doc.id, newName);
                                          }}>
                                            Rename
                                          </ContextMenuItem>
                                          <ContextMenuItem
                                            onClick={() => onDeleteFile && onDeleteFile(project.id, doc.id)}
                                            className="text-red-500 focus:text-red-500"
                                          >
                                            Delete File
                                          </ContextMenuItem>
                                        </ContextMenuContent>
                                      </ContextMenu>
                                    )) : (
                                      <div className="text-[10px] text-muted-foreground/40 py-1.5 px-2 italic">No files yet</div>
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
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in">
                  <ArtifactList
                    artifacts={artifacts}
                    activeArtifactId={activeArtifactId}
                    onArtifactSelect={onArtifactSelect || (() => { })}
                    onCreateArtifact={onCreateArtifact || (() => { })}
                    onDeleteArtifact={onDeleteArtifact}
                  />
                </div>
              )}

              {/* ── Workflows Panel ── */}
              {activeTab === 'workflows' && (
                <div className="flex-1 overflow-hidden flex flex-col animate-fade-in">
                  <WorkflowList
                    workflows={workflows}
                    activeWorkflowId={activeWorkflowId}
                    onSelect={onWorkflowSelect || (() => { })}
                    onCreate={onNewWorkflow || (() => { })}
                    onRun={onRunWorkflow || (() => { })}
                    onDelete={onDeleteWorkflow || (() => { })}
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
                          <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground">Total USD</span>
                            <span className="font-mono font-medium text-emerald-500">${projectCost.toFixed(4)}</span>
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
    </div>
  );
}