import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, Moon, Sun, History, ChevronDown, Folder, Sparkles, Layers } from 'lucide-react';

interface TopBarProps {
  activeProject: { id: string, name: string } | null;
  projects: { id: string, name: string }[];
  onProjectSelect: (project: any) => void;
  onProjectSettings: () => void;
  onShowResearchLog: () => void;
  theme: string;
  onToggleTheme: () => void;
}

export default function TopBar({
  activeProject,
  projects,
  onProjectSelect,
  onProjectSettings,
  onShowResearchLog,
  theme,
  onToggleTheme
}: TopBarProps) {
  const projectCount = Array.isArray(projects) ? projects.length : 0;

  return (
    <div className="shrink-0 h-12 w-full border-b border-border bg-background relative z-20">
      <div className="flex h-full w-full items-center justify-between gap-3 px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-8 w-8 items-center justify-center rounded bg-muted text-foreground sm:flex">
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <span className="font-bold text-foreground/90">ProductOS</span>
              <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[9px] normal-case tracking-normal">
                <Layers className="h-3 w-3" />
                {projectCount} product{projectCount === 1 ? '' : 's'}
              </span>
            </div>

            {activeProject ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex max-w-full items-center gap-1.5 rounded border border-transparent px-1.5 py-0.5 text-left transition-all hover:border-border hover:bg-muted">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-foreground">
                      <Folder className="h-3 w-3" />
                    </div>
                    <div className="truncate text-xs font-semibold text-foreground">{activeProject.name}</div>
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="mt-1 max-h-[320px] w-64 overflow-y-auto rounded border-border bg-popover shadow-md">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Switch Product
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {projectCount > 0 ? (
                    projects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onSelect={() => onProjectSelect(project)}
                        className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs ${activeProject.id === project.id ? 'bg-primary/10 text-primary' : ''}`}
                      >
                        <Folder className="h-3.5 w-3.5" />
                        <span className="truncate">{project.name}</span>
                        {activeProject.id === project.id && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="px-2 py-4 text-center text-xs italic text-muted-foreground">
                      No products yet
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="text-xs text-muted-foreground">
                No product active
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="h-8 w-8 rounded border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>

          {activeProject && (
            <Button
              variant="ghost"
              onClick={onShowResearchLog}
              data-testid="nav-research-log"
              className="hidden h-8 rounded border border-border bg-background px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
              title="Research Log"
            >
              <History className="mr-1.5 h-3.5 w-3.5" />
              Research log
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onProjectSettings}
            data-testid="nav-project-settings"
            className="h-8 w-8 rounded border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Product settings"
            aria-label="Product settings"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
