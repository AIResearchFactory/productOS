import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Settings, Moon, Sun, History, ChevronDown, Folder, Sparkles, Layers } from 'lucide-react';

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
    <div className="shrink-0 border-b border-white/10 bg-background/50 px-4 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-background/55 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/20 sm:flex">
            <Sparkles className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              <span className="font-semibold text-foreground/90">ProductOS</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] normal-case tracking-normal">
                <Layers className="h-3 w-3" />
                {projectCount} product{projectCount === 1 ? '' : 's'}
              </span>
            </div>

            {activeProject ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="group mt-1 flex max-w-full items-center gap-2 rounded-xl border border-transparent px-2 py-1 text-left transition-all hover:border-white/10 hover:bg-white/5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Folder className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{activeProject.name}</div>
                      <div className="text-[11px] text-muted-foreground">Active workspace</div>
                    </div>
                    <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="mt-2 max-h-[320px] w-64 overflow-y-auto rounded-xl border-white/10 bg-background/95 backdrop-blur-xl">
                  <DropdownMenuLabel className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Switch Product
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {projectCount > 0 ? (
                    projects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onSelect={() => onProjectSelect(project)}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg ${activeProject.id === project.id ? 'bg-primary/10 text-primary' : ''}`}
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
              <div className="mt-1 rounded-xl border border-dashed border-white/10 px-3 py-2 text-sm text-muted-foreground">
                No project active
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {activeProject && (
            <Button
              variant="ghost"
              onClick={onShowResearchLog}
              data-testid="nav-research-log"
              className="hidden h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground sm:inline-flex"
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
            className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
