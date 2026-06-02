import { Button } from '@/components/ui/button';
import { SlidersHorizontal, Moon, Sun, History, ChevronDown, Folder, Sparkles, Layers } from 'lucide-react';

interface TopBarProps {
  activeProject: { id: string, name: string } | null;
  projects: { id: string, name: string }[];
  onProjectSettings: () => void;
  onShowResearchLog: () => void;
  theme: string;
  onToggleTheme: () => void;
  showProductPanel: boolean;
  onToggleProductPanel: () => void;
  showChat: boolean;
  onToggleChat: () => void;
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
  onToggleChat
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
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onToggleProductPanel}
                  aria-expanded={showProductPanel}
                  className={`group flex max-w-full items-center gap-1.5 rounded border px-1.5 py-0.5 text-left transition-all ${
                    showProductPanel
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-transparent hover:border-accent hover:bg-accent'
                  }`}
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent text-secondary-foreground">
                    <Folder className="h-3 w-3" />
                  </div>
                  <div className="truncate text-xs font-semibold text-secondary-foreground">{activeProject.name}</div>
                  <ChevronDown className={`h-3 w-3 shrink-0 text-secondary-foreground/60 transition-transform group-hover:text-secondary-foreground ${showProductPanel ? 'rotate-180 text-primary' : ''}`} />
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleChat}
                  className={`h-6 w-6 rounded border transition-all ${
                    showChat
                      ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                      : 'border-transparent text-secondary-foreground/70 hover:border-accent hover:bg-accent hover:text-secondary-foreground'
                  }`}
                  title={showChat ? 'Close Copilot' : 'Open Copilot'}
                  aria-label={showChat ? 'Close Copilot' : 'Open Copilot'}
                >
                  <Sparkles className="h-3 w-3" />
                </Button>
              </div>
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
