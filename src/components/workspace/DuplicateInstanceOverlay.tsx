import { Button } from '@/components/ui/button';
import { Layers, CheckCircle2 } from 'lucide-react';
import type { InstanceCoordinationState } from '@/lib/instanceCoordinator';

interface DuplicateInstanceOverlayProps {
  coordinationState: InstanceCoordinationState;
  onClaimPrimary: () => void;
}

export default function DuplicateInstanceOverlay({
  coordinationState,
  onClaimPrimary
}: DuplicateInstanceOverlayProps) {
  if (coordinationState.isPrimary) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Multi-instance workspace coordination"
    >
      <div className="relative w-full max-w-md mx-4 rounded-xl border border-border bg-card p-6 shadow-2xl text-center space-y-5">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Layers className="w-6 h-6 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground tracking-tight">
            {coordinationState.hasOtherInstance
              ? 'Workspace Open in Another Window'
              : 'Window in Standby Mode'}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {coordinationState.hasOtherInstance
              ? 'ProductOS is currently active in another window or tab. To protect file watchers, avoid socket exhaustion, and keep your data in sync, only one window is active at a time.'
              : 'The previous active window is no longer reporting. You can resume full editing and file watching in this window.'}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={onClaimPrimary}
            className="w-full sm:w-auto font-medium gap-1.5 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            {coordinationState.hasOtherInstance ? 'Use This Window Instead' : 'Resume Workspace Here'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Try to close this window if opened via script, or minimize
              if (window.opener || window.history.length <= 1) {
                window.close();
              }
            }}
            className="w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Close Window
          </Button>
        </div>

        <div className="text-[10px] text-muted-foreground/60 border-t border-border/50 pt-3">
          Window ID: <span className="font-mono">{coordinationState.instanceId.slice(0, 14)}</span>
        </div>
      </div>
    </div>
  );
}
