import { useState, useEffect } from 'react';
import { Folder, FolderOpen, FolderPlus, Repeat, Cpu, Settings, Plus, ChevronRight, Zap, FileText, FileCode, MessageSquare, X, Compass, Eye, LayoutTemplate, Rocket, Swords, Users, MonitorPlay, ClipboardList, Lightbulb, LogOut, Download, Layers, Home, Loader2 } from 'lucide-react';
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
import Logo from '@/components/ui/Logo';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { RenameDialog } from '@/components/ui/RenameDialog';
import { MoveFileDialog } from '@/components/ui/MoveFileDialog';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

import { appApi } from '@/api/app';
import type { Project, Skill, Workflow, Artifact, ArtifactType } from '@/api/app';

interface Document {
  id: string;
  name: string;
  type: string;
  content: string;
  confidence?: number;
}

interface FileTreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  doc?: Document;
  children: Map<string, FileTreeNode>;
}

function buildFileTree(documents: Document[]): FileTreeNode[] {
  const root: Map<string, FileTreeNode> = new Map();

  for (const doc of documents) {
    const isExplicitFolder = doc.name.endsWith('/');
    const cleanPath = isExplicitFolder ? doc.name.slice(0, -1) : doc.name;
    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let currentMap = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;
      const isFolderNode = !isLast || isExplicitFolder;

      let node = currentMap.get(part);
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          isFolder: isFolderNode,
          doc: !isFolderNode && isLast ? doc : undefined,
          children: new Map(),
        };
        currentMap.set(part, node);
      } else {
        if (isFolderNode) {
          node.isFolder = true;
        }
        if (!isFolderNode && isLast) {
          node.doc = doc;
        }
      }
      currentMap = node.children;
    }
  }

  const sortMap = (map: Map<string, FileTreeNode>): FileTreeNode[] => {
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    return arr;
  };

  return sortMap(root);
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
  onAddFileToProject?: (projectId: string, folderPrefix?: string) => void;
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
  isLoadingFiles?: boolean;
  isLoadingArtifacts?: boolean;
}

export default function Sidebar(props: SidebarProps) {
  const {
    skills,
    activeProject,
    activeTab,
    onTabChange,
    onDocumentOpen,
    onNewSkill,
    onSkillSelect,
    workflows = [],
    activeWorkflowId,
    onWorkflowSelect,
    onNewWorkflow,
    onRunWorkflow,
    onEditWorkflow,
    onQuickScheduleWorkflow,
    onOpenWorkflowOptimizer,
    onDeleteSkill,
    onImportSkill,
    onDeleteArtifact,
    onOpenModelsCost,
    onOpenSettingsUsage,
    recentlyChangedFiles = new Set(),
    onExportDocument,
    activeDocument,
    isFlyoutOpen: controlledFlyoutOpen,
    onFlyoutOpenChange,
    isInstallable,
    onInstall,
    flyoutWidth = 240,
    isResizing = false,
    onCreateArtifact,
    onArtifactSelect,
    onProjectSelect,
    onAddFileToProject,
    onDeleteFile,
    onRenameFile,
    onOpenSettings,
    onShutdown,
    onDeleteWorkflow,
    onDeleteProject,
    artifacts = [],
    onImportDocument,
    onConvertFileToArtifact,
    isLoadingFiles = false,
    isLoadingArtifacts = false,
  } = props;

  const [internalFlyoutOpen, setInternalFlyoutOpen] = useState(true);
  const [isChatFocused, setIsChatFocused] = useState(false);
  const [projectCost, setProjectCost] = useState<number>(0);

  const [isSkillsExpanded, setIsSkillsExpanded] = useState(false);
  const [isWorkflowsExpanded, setIsWorkflowsExpanded] = useState(false);
  const [isModelsExpanded, setIsModelsExpanded] = useState(false);
  const [isArtifactsExpanded, setIsArtifactsExpanded] = useState(true);
  const [isFilesExpanded, setIsFilesExpanded] = useState(true);

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

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`productos:folders:${activeProject?.id}`);
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    if (!activeProject?.id) return;
    try {
      const saved = localStorage.getItem(`productos:folders:${activeProject.id}`);
      if (saved) {
        setExpandedFolders(new Set(JSON.parse(saved)));
      } else if (activeProject.documents && activeProject.documents.length > 0) {
        // Default expand all existing folders if no user preference is saved yet
        const defaultExpanded = new Set<string>();
        for (const doc of activeProject.documents) {
          const isExplicit = doc.name.endsWith('/');
          const clean = isExplicit ? doc.name.slice(0, -1) : doc.name;
          const parts = clean.split('/').filter(Boolean);
          const folderCount = isExplicit ? parts.length : parts.length - 1;
          let cur = '';
          for (let i = 0; i < folderCount; i++) {
            cur = cur ? `${cur}/${parts[i]}` : parts[i];
            defaultExpanded.add(cur);
          }
        }
        setExpandedFolders(defaultExpanded);
      } else {
        setExpandedFolders(new Set<string>());
      }
    } catch {
      setExpandedFolders(new Set<string>());
    }
  }, [activeProject?.id, activeProject?.documents?.length]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      try {
        localStorage.setItem(`productos:folders:${activeProject?.id}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Scroll active document into view and auto-expand its parent folders
  useEffect(() => {
    if (!activeDocument?.name) return;

    // Check if file is in a subfolder and expand parent folders
    const parts = activeDocument.name.split('/');
    if (parts.length > 1) {
      setExpandedFolders(prev => {
        const next = new Set(prev);
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
          next.add(currentPath);
        }
        try {
          localStorage.setItem(`productos:folders:${activeProject?.id}`, JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
    }

    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-doc-id="${CSS.escape(activeDocument.id)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [activeDocument?.id, activeProject?.id]);

  // Listen to manual reveal-in-sidebar event
  useEffect(() => {
    const handleReveal = (e: Event) => {
      const customEvent = e as CustomEvent<{ fileId?: string; fileName?: string }>;
      const fileId = customEvent.detail?.fileId;
      const fileName = customEvent.detail?.fileName || fileId;
      setIsFilesExpanded(true);
      if (fileName && fileName.includes('/')) {
        const parts = fileName.split('/');
        setExpandedFolders(prev => {
          const next = new Set(prev);
          let currentPath = '';
          for (let i = 0; i < parts.length - 1; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
            next.add(currentPath);
          }
          try {
            localStorage.setItem(`productos:folders:${activeProject?.id}`, JSON.stringify(Array.from(next)));
          } catch {}
          return next;
        });
      }
      if (fileId) {
        setTimeout(() => {
          const el = document.querySelector(`[data-doc-id="${CSS.escape(fileId)}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-primary', 'transition-all');
            setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 1500);
          }
        }, 120);
      }
    };
    window.addEventListener('productos:reveal-file-in-sidebar', handleReveal);
    return () => window.removeEventListener('productos:reveal-file-in-sidebar', handleReveal);
  }, [activeProject?.id]);

  // Listen to open-move-file-dialog event (e.g. from MainPanel tab context menu)
  useEffect(() => {
    const handleOpenMove = (e: Event) => {
      if (!activeProject?.id) return;
      const customEvent = e as CustomEvent<{ fileId: string; fileName: string }>;
      if (customEvent.detail?.fileId) {
        setMoveDialog({
          open: true,
          projectId: activeProject.id,
          fileId: customEvent.detail.fileId,
          currentName: customEvent.detail.fileName || customEvent.detail.fileId,
        });
      }
    };
    window.addEventListener('productos:open-move-file-dialog', handleOpenMove);
    return () => window.removeEventListener('productos:open-move-file-dialog', handleOpenMove);
  }, [activeProject?.id]);

  const [renameDialog, setRenameDialog] = useState<{ open: boolean; projectId: string; fileId: string; currentName: string; isFolder?: boolean; artifact?: Artifact } | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ open: boolean; projectId: string; fileId: string; currentName: string } | null>(null);
  const [folderDialog, setFolderDialog] = useState<{ open: boolean; parentFolder?: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: 'project' | 'file' | 'folder' | 'artifact' | 'skill' | 'shutdown'; projectId?: string; fileId?: string; folderPath?: string; itemName: string; artifact?: Artifact; skill?: Skill; requireTypeConfirm?: string; scopeSummary?: string[]; } | null>(null);

  const allProjectFolders = (() => {
    const folders = new Set<string>();
    for (const doc of activeProject?.documents || []) {
      const isExplicit = doc.name.endsWith('/');
      const clean = isExplicit ? doc.name.slice(0, -1) : doc.name;
      const parts = clean.split('/').filter(Boolean);
      const folderCount = isExplicit ? parts.length : parts.length - 1;
      let cur = '';
      for (let i = 0; i < folderCount; i++) {
        cur = cur ? `${cur}/${parts[i]}` : parts[i];
        folders.add(cur);
      }
    }
    return Array.from(folders).sort((a, b) => a.localeCompare(b));
  })();

  const renderFileTree = (nodes: FileTreeNode[]) => {
    if (!activeProject) return null;
    return nodes.map((node) => {
      if (node.isFolder) {
        const isExpanded = expandedFolders.has(node.path);
        const childNodes = Array.from(node.children.values()).sort((a, b) => {
          if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        return (
          <div key={`folder-${node.path}`} className="space-y-0.5">
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  data-testid={`folder-item-${node.path}`}
                  data-folder-path={node.path}
                  className="group flex items-center justify-between rounded px-2 py-1 text-2xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer select-none"
                  onClick={() => toggleFolder(node.path)}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <ChevronRight className={`w-3 h-3 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                    {isExpanded ? (
                      <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-500/80" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500/80" />
                    )}
                    <span className="truncate font-semibold">{node.name}</span>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderDialog({ open: true, parentFolder: node.path });
                      }}
                      className="p-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                      title={`New Subfolder in ${node.name}`}
                    >
                      <FolderPlus className="w-2.5 h-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddFileToProject && onAddFileToProject(activeProject.id, `${node.path}/`);
                      }}
                      className="p-0.5 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                      title={`New File in ${node.name}`}
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => onAddFileToProject && onAddFileToProject(activeProject.id, `${node.path}/`)}
                >
                  New File in Folder
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => setFolderDialog({ open: true, parentFolder: node.path })}
                >
                  New Subfolder
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => setRenameDialog({
                    open: true,
                    projectId: activeProject.id,
                    fileId: node.path,
                    currentName: node.path,
                    isFolder: true
                  })}
                >
                  Rename Folder
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => setDeleteDialog({
                    open: true,
                    type: 'folder',
                    projectId: activeProject.id,
                    folderPath: node.path,
                    itemName: node.name
                  })}
                  className="text-red-500 focus:text-red-500"
                >
                  Delete Folder
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            {isExpanded && (
              <div className="pl-3.5 border-l border-border/30 ml-2 space-y-0.5">
                {childNodes.length > 0 ? (
                  renderFileTree(childNodes)
                ) : (
                  <div className="px-2 py-1 text-[10px] italic text-muted-foreground/45">Empty folder</div>
                )}
              </div>
            )}
          </div>
        );
      }

      const doc = node.doc;
      if (!doc) return null;
      const isActive = activeDocument?.id === doc.id;

      return (
        <ContextMenu key={doc.id}>
          <ContextMenuTrigger asChild>
            <button
              data-doc-id={doc.id}
              title={doc.name}
              className={`w-full flex items-center gap-2 rounded px-2 py-1 text-2xs transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary/30'
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
                <MessageSquare className={`w-3 h-3 shrink-0 ${isActive ? 'text-primary' : 'text-emerald-500/70'}`} />
              ) : /\.(html|htm)$/i.test(doc.name) ? (
                <FileCode className={`w-3 h-3 shrink-0 ${isActive ? 'text-primary' : 'text-orange-500/80'}`} />
              ) : (
                <FileText className={`w-3 h-3 shrink-0 ${isActive ? 'text-primary' : 'text-primary/70'}`} />
              )}
              <span className="truncate flex-1 text-left">{node.name}</span>
              {recentlyChangedFiles.has(`${activeProject.id}:${doc.id}`) && (
                <span className="px-1 py-0.5 rounded bg-primary text-primary-foreground text-[8px] font-bold">
                  NEW
                </span>
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

            {onConvertFileToArtifact && doc.type !== 'chat' && doc.name.toLowerCase().endsWith('.md') && (
              <>
                <ContextMenuSub>
                  <ContextMenuSubTrigger className="text-xs">
                    Convert to Output
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48 max-h-[300px] overflow-y-auto z-50">
                    {Object.entries(ARTIFACT_TYPE_CONFIG).map(([type, config]) => (
                      <ContextMenuItem
                        key={type}
                        onClick={() => onConvertFileToArtifact(activeProject.id, doc, type as ArtifactType)}
                        className="flex items-center gap-2 cursor-pointer text-xs"
                      >
                        <config.icon className="w-3.5 h-3.5 text-primary" />
                        <span>{config.label}</span>
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
                <ContextMenuSeparator />
              </>
            )}

            {onExportDocument && doc.type !== 'chat' && (
              <>
                <ContextMenuItem
                  onClick={() => {
                    const baseName = doc.name.replace(/\.[^/.]+$/, '');
                    onExportDocument(activeProject.id, { ...doc, name: baseName + '.pdf' });
                  }}
                >
                  Export as PDF
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    const baseName = doc.name.replace(/\.[^/.]+$/, '');
                    onExportDocument(activeProject.id, { ...doc, name: baseName + '.docx' });
                  }}
                >
                  Export as DOCX
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}

            <ContextMenuItem
              onClick={() => setMoveDialog({ open: true, projectId: activeProject.id, fileId: doc.id, currentName: doc.name })}
            >
              Move to Folder...
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => setRenameDialog({ open: true, projectId: activeProject.id, fileId: doc.id, currentName: doc.name })}
            >
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => setDeleteDialog({ open: true, type: 'file', projectId: activeProject.id, fileId: doc.id, itemName: doc.name })}
              className="text-red-500 focus:text-red-500"
            >
              Delete File
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    });
  };

  useEffect(() => {
    if (!activeProject?.id || activeProject.id === 'new-project') {
      setProjectCost(0);
      return;
    }
    
    const abortController = new AbortController();
    
    appApi.getProjectCost(activeProject.id)
      .then(cost => {
        if (!abortController.signal.aborted) {
          setProjectCost(cost);
        }
      })
      .catch(err => {
        if (!abortController.signal.aborted) {
          console.error("Failed to fetch project cost:", err);
        }
      });
      
    return () => {
      abortController.abort();
    };
  }, [activeProject?.id]);

  const groupedArtifacts = props.artifacts ? props.artifacts.reduce((acc, artifact) => {
    if (!acc[artifact.artifactType]) acc[artifact.artifactType] = [];
    acc[artifact.artifactType].push(artifact);
    return acc;
  }, {} as Record<string, Artifact[]>) : {};

  return (
    <div data-testid="sidebar-navigation" className="shrink-0 flex h-full border-r border-border relative z-20 bg-secondary">
      {/* ── Unified Sidebar Panel ── */}
      <AnimatePresence>
        {flyoutOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: `${flyoutWidth}px`, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={isResizing ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
            className={`h-full overflow-hidden bg-secondary shrink-0 border-border relative rounded-none shadow-none z-30 ${isResizing ? 'transition-none' : 'transition-all duration-200'}`}
            style={{ width: `${flyoutWidth}px` }}
          >
            <div className="flex h-full w-full flex-col">
              {/* Sidebar Header */}
              <div data-testid="sidebar-flyout-header" className="shrink-0 px-4 py-4 flex items-center justify-between border-b border-border/40 bg-secondary/35">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background shadow-sm">
                    <Logo size="sm" />
                  </div>
                  <span className="text-xs font-bold tracking-wider text-foreground">Control Panel</span>
                </div>
                <button
                  onClick={() => setFlyoutOpen(false)}
                  data-testid="flyout-close-button"
                  aria-label="Close sidebar"
                  className="flex h-5 w-5 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              
              {/* Scroll Area for Unified List */}
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-4">
                  
                  {/* ── Product Home ── */}
                  {activeProject && (
                    <button
                      data-testid="nav-home"
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-bold transition-all ${
                        activeDocument?.type === 'product-home' && activeDocument?.id === `product-home-${activeProject.id}`
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
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
                      <Home className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Product Home</span>
                    </button>
                  )}

                  {activeProject ? (
                    <>
                      {/* Create & Import Action Row */}
                      <div className="flex gap-2 px-2 pb-3 pt-1 relative z-30 border-b border-border/10">
                        {/* Split Button: Create File / Artifact */}
                        <div className="flex-1 flex rounded-md overflow-hidden bg-primary text-primary-foreground h-8 shadow-sm">
                          <button
                            onClick={() => onAddFileToProject && onAddFileToProject(activeProject.id)}
                            className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 text-2xs font-bold hover:bg-primary/90 active:scale-95 transition-all text-primary-foreground"
                            title="Create new file"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create</span>
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="px-1.5 border-l border-primary-foreground/20 hover:bg-primary/90 flex items-center justify-center transition-all text-primary-foreground"
                                title="Create output type..."
                              >
                                <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48 max-h-[300px] overflow-y-auto z-50">
                              <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                Create Output Type
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onAddFileToProject && onAddFileToProject(activeProject.id)}
                                className="flex items-center gap-2 cursor-pointer text-xs"
                              >
                                <FileText className="w-3.5 h-3.5 text-primary" />
                                <span>New File</span>
                              </DropdownMenuItem>
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
                        <button
                          onClick={() => onImportDocument && onImportDocument(activeProject.id)}
                          className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-2xs font-bold transition-all shrink-0"
                          title="Import document (md, docx, pdf)"
                        >
                          <Download className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>Import</span>
                        </button>
                      </div>
                      {/* ── Skills Collapsible ── */}
                      <div className="space-y-1 border-b border-border/20 pb-3">
                        <div className="w-full flex items-center justify-between rounded-md hover:bg-muted/50 transition-colors">
                          <button 
                            type="button"
                            data-testid="nav-skills"
                            aria-expanded={isSkillsExpanded}
                            aria-controls="panel-skills"
                            onClick={() => setIsSkillsExpanded(!isSkillsExpanded)}
                            className="flex-1 flex items-center justify-between px-2 py-1.5 text-left text-[10px] font-bold tracking-wider uppercase text-muted-foreground/80 hover:text-foreground transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5 text-primary" />
                              <span>Skills</span>
                            </div>
                            <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isSkillsExpanded ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                          </button>
                          <div className="flex items-center gap-1 pr-2">
                            {onImportSkill && (
                              <button
                                type="button"
                                onClick={() => onImportSkill()}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Import Skill"
                                aria-label="Import Skill"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onNewSkill()}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="New Skill"
                              aria-label="New Skill"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {isSkillsExpanded && (
                          <div data-testid="panel-skills" className="pl-3.5 space-y-1.5 animate-fade-in">
                            {skills.length > 0 ? (
                              skills.map((skill) => (
                                <div
                                  key={skill.id}
                                  className="group cursor-pointer rounded-lg border border-border/60 bg-background/50 p-2.5 transition-all hover:bg-muted/70 hover:border-primary/20"
                                  onClick={() => onSkillSelect && onSkillSelect(skill)}
                                >
                                  <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-[11px] font-bold text-foreground truncate">{skill.name}</h4>
                                      <p className="text-[9px] text-muted-foreground line-clamp-1 mt-0.5 leading-normal">{skill.description}</p>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteDialog({ open: true, type: 'skill', itemName: skill.name, skill });
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                                      aria-label="Delete Skill"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="px-2 py-2 text-2xs italic text-muted-foreground/50">No skills defined</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Workflows Collapsible ── */}
                      <div className="space-y-1 border-b border-border/20 pb-3">
                        <div className="w-full flex items-center justify-between rounded-md hover:bg-muted/50 transition-colors">
                          <button 
                            type="button"
                            data-testid="nav-workflows"
                            aria-expanded={isWorkflowsExpanded}
                            aria-controls="panel-workflows"
                            onClick={() => setIsWorkflowsExpanded(!isWorkflowsExpanded)}
                            className="flex-1 flex items-center justify-between px-2 py-1.5 text-left text-[10px] font-bold tracking-wider uppercase text-muted-foreground/80 hover:text-foreground transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <Repeat className="w-3.5 h-3.5 text-primary" />
                              <span>Workflows</span>
                            </div>
                            <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isWorkflowsExpanded ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                          </button>
                          <div className="flex items-center gap-1 pr-2">
                            {onOpenWorkflowOptimizer && (
                              <button
                                type="button"
                                data-testid="workflow-optimizer-button"
                                onClick={() => onOpenWorkflowOptimizer()}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Open Workflow Optimizer"
                                aria-label="Open Workflow Optimizer"
                              >
                                <Settings className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              data-testid="workflow-create-button"
                              onClick={() => onNewWorkflow && onNewWorkflow()}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="New Workflow"
                              aria-label="New Workflow"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {isWorkflowsExpanded && (
                          <div data-testid="panel-workflows" className="pl-3.5 space-y-1.5 animate-fade-in">
                            {workflows.length > 0 ? (
                              workflows.map((workflow) => {
                                const isWorkflowActive = activeWorkflowId === workflow.id;
                                return (
                                  <div
                                    key={workflow.id}
                                    data-testid={`workflow-item-${workflow.id}`}
                                    className={`group cursor-pointer rounded-lg border p-2.5 transition-all hover:bg-muted/70 hover:border-primary/20 ${
                                      isWorkflowActive ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-background/50'
                                    }`}
                                    onClick={() => onWorkflowSelect && onWorkflowSelect(workflow)}
                                  >
                                    <div className="flex items-start justify-between gap-1.5">
                                      <div className="min-w-0 flex-1">
                                        <h4 className="text-[11px] font-bold text-foreground truncate">{workflow.name}</h4>
                                        <p className="text-[9px] text-muted-foreground line-clamp-1 mt-0.5 leading-normal">{workflow.description}</p>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] text-muted-foreground">
                                          <span>{workflow.steps.length} steps • {workflow.status || 'Draft'}</span>
                                          {workflow.schedule?.enabled && (
                                            <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 font-bold uppercase tracking-wider text-primary">
                                              Scheduled
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {onEditWorkflow && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); onEditWorkflow(workflow); }}
                                            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                                            title="Edit Workflow"
                                            aria-label="Edit Workflow"
                                          >
                                            <Settings className="w-3 h-3" />
                                          </button>
                                        )}
                                        {onQuickScheduleWorkflow && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); onQuickScheduleWorkflow(workflow); }}
                                            className="p-0.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                                            title="Schedule Workflow"
                                            aria-label="Schedule Workflow"
                                          >
                                            <Repeat className="w-3 h-3" />
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => { e.stopPropagation(); onRunWorkflow && onRunWorkflow(workflow); }}
                                          className="p-0.5 rounded hover:bg-emerald-500/10 text-emerald-500 hover:text-emerald-600 transition-all"
                                          title="Run Workflow"
                                          aria-label="Run Workflow"
                                        >
                                          <Rocket className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); onDeleteWorkflow && onDeleteWorkflow(workflow); }}
                                          className="p-0.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all"
                                          title="Delete Workflow"
                                          aria-label="Delete Workflow"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="px-2 py-2 text-2xs italic text-muted-foreground/50">No workflows defined</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Models Collapsible ── */}
                      <div className="space-y-1 border-b border-border/20 pb-3">
                        <button 
                          type="button"
                          data-testid="nav-models"
                          aria-expanded={isModelsExpanded}
                          aria-controls="panel-models"
                          onClick={() => setIsModelsExpanded(!isModelsExpanded)}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-muted/50 text-[10px] font-bold tracking-wider uppercase text-muted-foreground/80 hover:text-foreground transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5 text-primary" />
                            <span>Models & Usage</span>
                          </div>
                          <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isModelsExpanded ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                        </button>
                        {isModelsExpanded && (
                          <div data-testid="panel-models" className="pl-3.5 pr-2 py-2 space-y-2 border border-border/40 bg-background/25 rounded-lg text-2xs animate-fade-in">
                            <div className="flex items-center gap-2">
                              <Cpu className="w-3.5 h-3.5 text-primary" />
                              <span className="font-semibold">AI Settings</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-muted-foreground italic">Product Cost</span>
                              <span data-testid="sidebar-product-total" className="font-mono font-medium text-emerald-500">${Number(projectCost).toFixed(2)}</span>
                            </div>
                            {onOpenSettingsUsage && (
                              <div className="flex justify-end">
                                <Button
                                  variant="link"
                                  data-testid="sidebar-view-more-usage"
                                  className="h-auto p-0 text-[10px] text-primary/60 hover:text-primary transition-colors flex items-center gap-0.5"
                                  onClick={onOpenSettingsUsage}
                                >
                                  View more
                                  <ChevronRight className="w-2.5 h-2.5" />
                                </Button>
                              </div>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-full rounded-md border border-border/80 bg-background/50 hover:bg-primary/10 hover:text-primary text-[10px] font-bold" 
                              onClick={onOpenModelsCost}
                            >
                              Manage Models
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* ── Outputs (Artifacts) Collapsible ── */}
                      <div className="space-y-1 border-b border-border/20 pb-3">
                        <div className="w-full flex items-center justify-between rounded-md hover:bg-muted/50 transition-colors">
                          <button 
                            type="button"
                            data-testid="nav-artifacts"
                            aria-expanded={isArtifactsExpanded}
                            aria-controls="panel-artifacts"
                            onClick={() => setIsArtifactsExpanded(!isArtifactsExpanded)}
                            className="flex-1 flex items-center justify-between px-2 py-1.5 text-left text-[10px] font-bold tracking-wider uppercase text-muted-foreground/80 hover:text-foreground transition-colors"
                          >
                            <div className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-primary" />
                              <span>Outputs (Artifacts)</span>
                            </div>
                            <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isArtifactsExpanded ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                          </button>
                          <div className="flex items-center pr-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button 
                                  type="button"
                                  data-testid="artifact-create-button"
                                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title="New Output"
                                >
                                  <Plus className="w-3 h-3" />
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
                        </div>
                        {isArtifactsExpanded && (
                          <div data-testid="panel-artifacts" className="pl-2 mt-1 border-l border-border/40 space-y-1.5 animate-fade-in">
                            {Object.entries(groupedArtifacts).map(([type, items]) => {
                              const config = ARTIFACT_TYPE_CONFIG[type] || { label: type, icon: FileText };
                              const TypeIcon = config.icon;
                              return (
                                <div key={type} className="space-y-1">
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 text-[9px] text-muted-foreground/60 font-semibold tracking-wider uppercase">
                                    <TypeIcon className="w-3 h-3" />
                                    <span>{config.label}</span>
                                  </div>
                                  <div className="pl-3.5 space-y-0.5">
                                    {items.map(artifact => {
                                      const getArtifactDirectory = (t: string): string => {
                                        switch (t) {
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
                                              className={`w-full flex items-center gap-2 rounded px-2 py-1 text-left text-2xs transition-colors ${
                                                isActive
                                                  ? 'bg-primary/10 text-primary font-bold shadow-sm'
                                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                              }`}
                                              onClick={() => {
                                                if (isChatFocused) {
                                                  window.dispatchEvent(new CustomEvent('productos:chat-peek-file', {
                                                    detail: { fileName }
                                                  }));
                                                } else {
                                                  if (onArtifactSelect) onArtifactSelect(artifact);
                                                  onTabChange('artifacts');
                                                }
                                              }}
                                            >
                                              <span className="truncate">{artifact.title}</span>
                                            </button>
                                          </ContextMenuTrigger>
                                          <ContextMenuContent>
                                            <ContextMenuItem
                                              onClick={() => {
                                                window.dispatchEvent(new CustomEvent('productos:chat-peek-file', {
                                                  detail: { fileName }
                                                }));
                                              }}
                                            >
                                              Peek Artifact
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                              onClick={() => {
                                                window.dispatchEvent(new CustomEvent('productos:chat-reference-file', {
                                                  detail: { fileName }
                                                }));
                                              }}
                                            >
                                              Reference in Chat
                                            </ContextMenuItem>
                                            <ContextMenuSeparator />
                                            <ContextMenuItem onClick={() => {
                                              setRenameDialog({
                                                open: true,
                                                projectId: activeProject.id,
                                                fileId: artifact.id,
                                                currentName: artifact.title,
                                                artifact
                                              });
                                            }}>
                                              Rename
                                            </ContextMenuItem>
                                            <ContextMenuItem onClick={() => {
                                              if (onExportDocument) {
                                                const baseName = artifactDoc.name.replace(/\.[^/.]+$/, '');
                                                onExportDocument(activeProject.id, { ...artifactDoc, name: baseName + '.pdf' });
                                              }
                                            }}>
                                              Export as PDF
                                            </ContextMenuItem>
                                            <ContextMenuItem onClick={() => {
                                              if (onExportDocument) {
                                                const baseName = artifactDoc.name.replace(/\.[^/.]+$/, '');
                                                onExportDocument(activeProject.id, { ...artifactDoc, name: baseName + '.docx' });
                                              }
                                            }}>
                                              Export as DOCX
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
                            {artifacts.length === 0 && (
                              isLoadingArtifacts ? (
                                <div className="px-2 py-2 text-[10px] italic text-muted-foreground/70 flex items-center gap-1.5">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Loading outputs...</span>
                                </div>
                              ) : (
                                <div className="px-2 py-2 text-[10px] italic text-muted-foreground/45">No outputs created yet</div>
                              )
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Files & Chats Section ── */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-2 py-1.5 group select-none">
                          <button
                            type="button"
                            data-testid="nav-files"
                            onClick={() => setIsFilesExpanded(!isFilesExpanded)}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/70 hover:text-foreground tracking-wider uppercase transition-colors"
                            aria-expanded={isFilesExpanded}
                            aria-controls="panel-files"
                          >
                            <div className="flex items-center gap-1.5">
                              <Folder className="w-3.5 h-3.5" />
                              <span>Files</span>
                            </div>
                            <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isFilesExpanded ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                          </button>
                          <div className="flex items-center pr-2 gap-1">
                            <button
                              type="button"
                              data-testid="new-folder-button"
                              onClick={() => setFolderDialog({ open: true })}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="New Folder"
                            >
                              <FolderPlus className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onAddFileToProject && onAddFileToProject(activeProject.id)}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="New File"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {isFilesExpanded && (
                          <div data-testid="panel-files" className="pl-3.5 space-y-1 animate-fade-in">
                            {activeProject.documents && activeProject.documents.length > 0 ? (
                              renderFileTree(buildFileTree(activeProject.documents))
                            ) : isLoadingFiles ? (
                              <div className="px-2 py-2 text-2xs italic text-muted-foreground/70 flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Loading files...</span>
                              </div>
                            ) : (
                              <div className="px-2 py-2 text-2xs italic text-muted-foreground/50">No files added yet</div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      <Folder className="w-8 h-8 opacity-20 mx-auto mb-2" />
                      <span className="text-xs">No active product</span>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Bottom Section */}
              <div className="shrink-0 mt-auto border-t border-border/40 p-3 bg-secondary/35 flex flex-col gap-1.5">
                <button
                  data-testid="nav-settings"
                  onClick={() => {
                    onOpenSettings?.();
                    setFlyoutOpen(false);
                  }}
                  className={`
                    flex h-9 w-full items-center gap-2.5 rounded-lg border px-3 text-xs font-semibold transition-all duration-150
                    ${activeTab === 'settings'
                      ? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
                      : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                    }
                  `}
                >
                  <Settings className="h-4 w-4 shrink-0 text-primary" />
                  <span>Settings</span>
                </button>

                {isInstallable && (
                  <button
                    onClick={onInstall}
                    className="flex h-9 w-full items-center gap-2.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground"
                  >
                    <Download className="h-4 w-4 shrink-0 text-primary" />
                    <span>Install App</span>
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
                  className="flex h-9 w-full items-center gap-2.5 rounded-lg border border-transparent px-3 text-xs font-semibold text-muted-foreground transition-all duration-150 hover:bg-red-500/10 hover:text-red-500"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-red-500/10 text-red-500">
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  <span>Quit Application</span>
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogs */}
      {moveDialog && activeProject && (
        <MoveFileDialog
          open={moveDialog.open}
          onOpenChange={(open) => !open && setMoveDialog(null)}
          fileName={moveDialog.currentName}
          projectName={activeProject.name}
          existingFolders={allProjectFolders}
          onCreateFolder={async (folderPath) => {
            await appApi.createFolder(activeProject.id, folderPath);
            setExpandedFolders(prev => {
              const next = new Set(prev);
              let currentPath = '';
              for (const part of folderPath.split('/')) {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                next.add(currentPath);
              }
              try {
                localStorage.setItem(`productos:folders:${activeProject.id}`, JSON.stringify(Array.from(next)));
              } catch {}
              return next;
            });
            window.dispatchEvent(new CustomEvent('productos:refresh-files'));
          }}
          onMove={async (newFilePath) => {
            if (onRenameFile) {
              await onRenameFile(moveDialog.projectId, moveDialog.fileId, newFilePath);
            }
            const folderParts = newFilePath.split('/').slice(0, -1);
            if (folderParts.length > 0) {
              setExpandedFolders(prev => {
                const next = new Set(prev);
                let currentPath = '';
                for (const part of folderParts) {
                  currentPath = currentPath ? `${currentPath}/${part}` : part;
                  next.add(currentPath);
                }
                try {
                  localStorage.setItem(`productos:folders:${activeProject.id}`, JSON.stringify(Array.from(next)));
                } catch {}
                return next;
              });
            }
            setMoveDialog(null);
          }}
        />
      )}
      {folderDialog && activeProject && (
        <RenameDialog
          open={folderDialog.open}
          onOpenChange={(open) => !open && setFolderDialog(null)}
          currentName=""
          title={folderDialog.parentFolder ? `New Subfolder in "${folderDialog.parentFolder}"` : 'New Folder'}
          description="Enter a name for the new folder."
          placeholder="e.g., research, courses"
          confirmText="Create Folder"
          onConfirm={async (folderName) => {
            const cleanName = folderName.trim().replace(/^\/+|\/+$/g, '');
            if (!cleanName) return;
            const fullPath = folderDialog.parentFolder
              ? `${folderDialog.parentFolder}/${cleanName}`
              : cleanName;
            try {
              await appApi.createFolder(activeProject.id, fullPath);
              setExpandedFolders(prev => {
                const next = new Set(prev);
                let currentPath = '';
                for (const part of fullPath.split('/')) {
                  currentPath = currentPath ? `${currentPath}/${part}` : part;
                  next.add(currentPath);
                }
                try {
                  localStorage.setItem(`productos:folders:${activeProject.id}`, JSON.stringify(Array.from(next)));
                } catch {}
                return next;
              });
              window.dispatchEvent(new CustomEvent('productos:refresh-files'));
            } catch (err) {
              console.error('Failed to create folder:', err);
            }
            setFolderDialog(null);
          }}
        />
      )}
      {renameDialog && (
        <RenameDialog
          open={renameDialog.open}
          onOpenChange={(open) => !open && setRenameDialog(null)}
          currentName={renameDialog.currentName}
          title={renameDialog.isFolder ? 'Rename Folder' : renameDialog.artifact ? 'Rename Output' : 'Rename File'}
          description={renameDialog.isFolder ? 'Enter a new path or name for this folder.' : 'Update the name and save when you are ready.'}
          onConfirm={async (newName) => {
            const trimmed = newName.trim().replace(/^\/+|\/+$/g, '');
            if (!trimmed || trimmed === renameDialog.currentName) return;
            if (renameDialog.isFolder) {
              try {
                await appApi.renameFolder(renameDialog.projectId, renameDialog.fileId, trimmed);
                setExpandedFolders(prev => {
                  const next = new Set(prev);
                  if (next.has(renameDialog.fileId)) {
                    next.delete(renameDialog.fileId);
                    next.add(trimmed);
                  }
                  return next;
                });
                window.dispatchEvent(new CustomEvent('productos:refresh-files'));
              } catch (err) {
                console.error('Failed to rename folder:', err);
              }
            } else if (renameDialog.artifact && activeProject) {
              try {
                await appApi.updateArtifactMetadata(activeProject.id, renameDialog.artifact.artifactType, renameDialog.artifact.id, trimmed);
                onProjectSelect(activeProject);
              } catch (err) {
                console.error('Failed to rename artifact:', err);
              }
            } else if (onRenameFile) {
              onRenameFile(renameDialog.projectId, renameDialog.fileId, trimmed);
            }
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
            deleteDialog.type === 'folder' ? 'Delete Folder' :
            deleteDialog.type === 'file' ? 'Delete File' :
            deleteDialog.type === 'artifact' ? 'Delete Artifact' :
            'Delete Skill'
          }
          description={
            deleteDialog.type === 'shutdown' ? 'Are you sure you want to shut down the application? This will terminate all active processes and clear secrets from memory.' :
            deleteDialog.type === 'project'
              ? `This will delete all data associated with "${deleteDialog.itemName}". This action is irreversible.`
              : deleteDialog.type === 'folder'
                ? `This will delete the folder "${deleteDialog.itemName}" and all files inside it. This action cannot be undone.`
                : deleteDialog.type === 'artifact'
                  ? `This will delete the artifact "${deleteDialog.itemName}" and its backing file. This action cannot be undone.`
                  : deleteDialog.type === 'skill'
                    ? `This will delete the skill "${deleteDialog.itemName}". This action cannot be undone.`
                    : `This will delete the file "${deleteDialog.itemName}" from the current product. This action cannot be undone.`
          }
          confirmText={
            deleteDialog.type === 'shutdown' ? 'Quit Application' :
            deleteDialog.type === 'project' ? 'Delete product' :
            deleteDialog.type === 'folder' ? 'Delete folder' :
            deleteDialog.type === 'artifact' ? 'Delete artifact' :
            deleteDialog.type === 'skill' ? 'Delete skill' :
            'Delete file'
          }
          requireTypeConfirm={deleteDialog.requireTypeConfirm}
          scopeSummary={deleteDialog.scopeSummary}
          onConfirm={async () => {
            if (deleteDialog.type === 'shutdown') {
              if (onShutdown) {
                onShutdown();
              } else {
                appApi.shutdownApp();
              }
            } else if (deleteDialog.type === 'project' && deleteDialog.projectId && onDeleteProject) {
              onDeleteProject(deleteDialog.projectId);
            } else if (deleteDialog.type === 'folder' && deleteDialog.projectId && deleteDialog.folderPath) {
              try {
                await appApi.deleteFolder(deleteDialog.projectId, deleteDialog.folderPath);
                window.dispatchEvent(new CustomEvent('productos:refresh-files'));
              } catch (err) {
                console.error('Failed to delete folder:', err);
              }
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
