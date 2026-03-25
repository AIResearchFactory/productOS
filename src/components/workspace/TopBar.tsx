import { Button } from '@/components/ui/button';
import { Settings, Moon, Sun, History } from 'lucide-react';

interface TopBarProps {
  activeProject: { name: string } | null;
  onProjectSettings: () => void;
  onShowResearchLog: () => void;
  theme: string;
  onToggleTheme: () => void;
}

export default function TopBar({ activeProject, onProjectSettings, onShowResearchLog, theme, onToggleTheme }: TopBarProps) {
  return (
    <div className="h-12 border-b border-border bg-background flex items-center justify-between px-4 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        {activeProject ? (
          <>
            <span className="text-muted-foreground font-medium">productOS</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold">{activeProject.name}</span>
          </>
        ) : (
          <span className="text-muted-foreground font-medium">productOS</span>
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