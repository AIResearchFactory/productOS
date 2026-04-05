import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Settings, Moon, Sun, History, ChevronDown, Folder } from 'lucide-react';

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
  return (
    <div className="h-12 border-b border-border bg-background flex items-center justify-between px-4 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground font-medium">productOS</span>
        <span className="text-muted-foreground/40">/</span>
        {activeProject ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-secondary transition-colors group">
                <span className="text-foreground font-semibold">{activeProject.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 mt-1 overflow-y-auto max-h-[300px]">
              <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
                Switch Product
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Array.isArray(projects) && projects.length > 0 ? (
                projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onSelect={() => onProjectSelect(project)}
                    className={`flex items-center gap-2 cursor-pointer ${activeProject.id === project.id ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span className="truncate">{project.name}</span>
                    {activeProject.id === project.id && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-4 text-xs text-center text-muted-foreground italic">
                  No other products found
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-muted-foreground italic">No project active</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {activeProject && (
          <Button
            variant="ghost"
            onClick={onShowResearchLog}
            className="h-8 px-3 rounded-lg text-muted-foreground hover:text-foreground text-xs font-medium gap-1.5"
            title="Research Log"
          >
            <History className="w-3.5 h-3.5" />
            Project log
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={onProjectSettings}
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}