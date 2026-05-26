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
    <div className="shrink-0 h-12 w-full border-b border-border bg-secondary text-secondary-foreground relative z-20">
      <div className="flex h-full w-full items-center justify-between gap-3 px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-8 w-8 items-center justify-center rounded bg-accent text-accent-foreground sm:flex">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-secondary-foreground/60">
              <span className="font-bold text-secondary-foreground/90">ProductOS</span>
              <span className="inline-flex items-center gap-1 rounded border border-accent bg-accent/40 px-1.5 py-0.5 text-[9px] normal-case tracking-normal text-secondary-foreground/85">
                <Layers className="h-3 w-3" />
                {projectCount} product{projectCount === 1 ? '' : 's'}
              </span>
            </div>

            {activeProject ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group flex max-w-full items-center gap-1.5 rounded border border-transparent px-1.5 py-0.5 text-left transition-all hover:border-accent hover:bg-accent">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent text-secondary-foreground">
                      <Folder className="h-3 w-3" />
                    </div>
                    <div className="truncate text-xs font-semibold text-secondary-foreground">{activeProject.name}</div>
                    <ChevronDown className="h-3 w-3 shrink-0 text-secondary-foreground/60 transition-colors group-hover:text-secondary-foreground" />
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
              className="hidden h-8 rounded border border-accent bg-secondary px-3 text-xs font-semibold text-secondary-foreground/70 hover:bg-accent hover:text-secondary-foreground sm:inline-flex"
              title="Research Log"
            >
              <History className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Research log
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
    </div>
  );
}
