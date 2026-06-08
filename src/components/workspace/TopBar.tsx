import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, Moon, Sun, History, ChevronDown, Folder, Sparkles, Layers, Menu, X, Search, FolderPlus } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import ConfirmationDialog from '@/components/ui/ConfirmationDialog';

interface TopBarProps {
  activeProject: { id: string, name: string } | null;
  projects: any[];
  onProjectSettings: () => void;
  onShowResearchLog: () => void;
  theme: string;
  onToggleTheme: () => void;
  showProductPanel: boolean;
  onToggleProductPanel: () => void;
  showChat: boolean;
  onToggleChat: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  artifacts?: any[];
  onProjectSelect: (project: any) => void | Promise<void>;
  onNewProject: () => void;
  onDeleteProject?: (projectId: string) => void;
}

export default function TopBar({
  activeProject,
  projects,
  onProjectSettings,
  onShowResearchLog,
  theme,
  onToggleTheme,
  showProductPanel,
  onToggleProductPanel,
  showChat,
  onToggleChat,
  isSidebarOpen,
  onToggleSidebar,
  artifacts = [],
  onProjectSelect,
  onNewProject,
  onDeleteProject,
}: TopBarProps) {
  const projectCount = Array.isArray(projects) ? projects.length : 0;
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; projectId: string; itemName: string; } | null>(null);
  const productSwitcherRef = useRef<HTMLDivElement>(null);

  const closeProductPanel = () => {
    if (showProductPanel) {
      onToggleProductPanel();
    }
  };

  const selectProject = (project: any) => {
    onProjectSelect(project);
    closeProductPanel();
    setProjectSearchQuery('');
  };

  useEffect(() => {
    if (!showProductPanel) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeProductPanel();
      }
    };
    const handlePointerDown = (e: PointerEvent) => {
      if (productSwitcherRef.current && !productSwitcherRef.current.contains(e.target as Node)) {
        closeProductPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [showProductPanel, onToggleProductPanel]);

  return (
    <div className="shrink-0 h-12 w-full border-b border-border bg-secondary text-secondary-foreground relative z-40">
      <div className="flex h-full w-full items-center justify-between gap-3 px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-8 w-8 rounded border border-accent bg-secondary text-secondary-foreground/70 hover:bg-accent hover:text-secondary-foreground flex items-center justify-center shrink-0"
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <Menu className="h-4 w-4 text-primary" />
          </Button>

          <div className="min-w-0">
            <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-secondary-foreground/60">
              <span className="font-bold text-secondary-foreground/90">ProductOS</span>
              <span className="inline-flex items-center gap-1 rounded border border-accent bg-accent/40 px-1.5 py-0.5 text-[9px] normal-case tracking-normal text-secondary-foreground/85">
                <Layers className="h-3 w-3" />
                {projectCount} product{projectCount === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-0.5 relative">
              <div className="relative min-w-0" ref={productSwitcherRef}>
                <button
                  data-testid="nav-products"
                  onClick={onToggleProductPanel}
                  aria-expanded={showProductPanel}
                  className={`group flex max-w-[160px] sm:max-w-[240px] md:max-w-[280px] items-center gap-1.5 rounded border px-1.5 py-0.5 text-left transition-all ${
                    showProductPanel
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-transparent hover:border-accent hover:bg-accent'
                  }`}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent text-secondary-foreground">
                    <Folder className="h-3 w-3" />
                  </div>
                  <div className="truncate min-w-0 text-xs font-semibold text-secondary-foreground">
                    {activeProject ? activeProject.name : 'Select Product...'}
                  </div>
                  <ChevronDown className={`h-3 w-3 shrink-0 text-secondary-foreground/60 transition-transform group-hover:text-secondary-foreground ${showProductPanel ? 'rotate-180 text-primary' : ''}`} />
                </button>

                {showProductPanel && (
                  <div
                    className="absolute top-full left-0 mt-2 w-80 max-h-[calc(100vh-4rem)] bg-secondary text-secondary-foreground border border-border shadow-2xl z-[60] flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-200 rounded-md"
                    data-testid="topbar-product-switcher"
                  >
                    {/* Switcher Header/Search Area */}
                    <div className="p-3 shrink-0 flex flex-col gap-2 border-b border-border bg-secondary/50">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Select Product</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={onToggleProductPanel}
                          className="h-5 w-5 rounded-md hover:bg-muted text-muted-foreground"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="relative flex items-center">
                        <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/60" />
                        <input
                          type="text"
                          placeholder="Search products..."
                          value={projectSearchQuery}
                          onChange={(e) => setProjectSearchQuery(e.target.value)}
                          className="w-full h-8 pl-8 pr-2.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Switcher List Area */}
                    <div data-testid="panel-projects" className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 bg-background/30">
                      {projects.filter(p =>
                        p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                        (p.description || '').toLowerCase().includes(projectSearchQuery.toLowerCase())
                      ).length > 0 ? (
                        projects.filter(p =>
                          p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                          (p.description || '').toLowerCase().includes(projectSearchQuery.toLowerCase())
                        ).map((project) => {
                          const fileCount = project.documents?.length || 0;
                          const projectArtifacts = Array.isArray(artifacts) ? artifacts.filter(a => a.projectId === project.id) : [];
                          const artifactCount = projectArtifacts.length;
                          const isActive = activeProject?.id === project.id;
                          
                          return (
                            <ContextMenu key={project.id}>
                              <ContextMenuTrigger asChild>
                                <button
                                  type="button"
                                  data-testid={`project-item-${project.name}`}
                                  onClick={() => selectProject(project)}
                                  className={`w-full flex flex-col gap-1 p-2.5 rounded-lg border cursor-pointer text-left transition-all ${
                                    isActive
                                      ? 'border-primary/50 bg-primary/10 shadow-sm font-semibold text-primary'
                                      : 'border-border bg-background/50 hover:bg-muted hover:border-muted-foreground/30 hover:text-foreground'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Folder className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                                      <span className="text-xs font-bold truncate max-w-[200px]">{project.name}</span>
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
                                  
                                  <div className="flex gap-2 text-[9px] text-muted-foreground/75 font-normal mt-0.5">
                                    <span>{fileCount} file{fileCount === 1 ? '' : 's'}</span>
                                    <span>•</span>
                                    <span>{artifactCount} output{artifactCount === 1 ? '' : 's'}</span>
                                  </div>
                                </button>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                <ContextMenuItem
                                  data-testid="btn-delete-project"
                                  onClick={() => {
                                    closeProductPanel();
                                    setDeleteDialog({ open: true, projectId: project.id, itemName: project.name });
                                  }}
                                  className="text-red-500 focus:text-red-500 cursor-pointer"
                                >
                                  Delete Product
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        })
                      ) : (
                        <div className="py-6 text-center text-xs italic text-muted-foreground">
                          No products match search
                        </div>
                      )}
                    </div>

                    {/* Switcher Footer: Add New Product */}
                    <div className="p-3 border-t border-border bg-secondary/50 shrink-0">
                      <Button
                        data-testid="btn-create-new-project"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onNewProject();
                          onToggleProductPanel();
                          setProjectSearchQuery('');
                        }}
                        className="w-full text-xs font-semibold gap-1.5 h-9 rounded-lg"
                      >
                        <FolderPlus className="w-3.5 h-3.5 text-primary" />
                        New Product
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {activeProject && (
                <Button
                  data-testid="show-chat-button"
                  variant="ghost"
                  onClick={onToggleChat}
                  className={`h-6 rounded border px-2 py-0.5 text-2xs transition-all gap-1 flex items-center font-semibold ${
                    showChat
                      ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                      : 'border-transparent text-secondary-foreground/70 hover:border-accent hover:bg-accent hover:text-secondary-foreground'
                  }`}
                  title={showChat ? 'Close Copilot' : 'Open Copilot'}
                  aria-label={showChat ? 'Close Copilot' : 'Open Copilot'}
                >
                  <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                  <span className="hidden md:inline">{showChat ? 'Hide chat' : 'Show chat'}</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            data-testid="nav-theme-toggle"
            className="h-8 w-8 rounded border border-accent bg-secondary text-secondary-foreground/70 hover:bg-accent hover:text-secondary-foreground"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-primary" /> : <Moon className="h-3.5 w-3.5 text-primary" />}
          </Button>

          {activeProject && (
            <Button
              variant="ghost"
              onClick={onShowResearchLog}
              data-testid="nav-research-log"
              className="h-8 rounded border border-accent bg-secondary px-2 sm:px-3 text-xs font-semibold text-secondary-foreground/70 hover:bg-accent hover:text-secondary-foreground inline-flex items-center"
              title="Research Log"
            >
              <History className="h-3.5 w-3.5 text-primary sm:mr-1.5" />
              <span className="hidden sm:inline">Research log</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onProjectSettings}
            data-testid="nav-project-settings"
            className="h-8 w-8 rounded border border-accent bg-secondary text-secondary-foreground/70 hover:bg-accent hover:text-secondary-foreground"
            title="Product settings"
            aria-label="Product settings"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          </Button>
        </div>
      </div>

      {deleteDialog && (
        <ConfirmationDialog
          open={deleteDialog.open}
          onOpenChange={(open) => !open && setDeleteDialog(null)}
          title="Delete Product"
          description={`This will delete all data associated with "${deleteDialog.itemName}". This action is irreversible.`}
          confirmText="Delete product"
          requireTypeConfirm={deleteDialog.itemName}
          onConfirm={() => {
            if (onDeleteProject) {
              onDeleteProject(deleteDialog.projectId);
            }
            setDeleteDialog(null);
          }}
        />
      )}
    </div>
  );
}
