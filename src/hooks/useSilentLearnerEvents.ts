import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useSilentLearnerEvents() {
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const unlisteners: Array<() => void> = [];
    const addUnlistener = (unlisten: () => void) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    };

    // Dynamically import to ensure compatibility with ESM in client bundles
    import('@/api/runtime').then(({ runtimeApi }) => {
      if (cancelled) return;
      // Listen for memory ready events
      runtimeApi.listen('silent_learner.memory_ready', (event: any) => {
        const { workspaceId, memoryItemCount, sourceSessionCount } = event.payload;
        
        // Track which workspaces have already displayed a "memory ready" toast
        const storageKey = 'productos:silent-learner-toasted-workspaces';
        let toastedList: string[] = [];
        try {
          toastedList = JSON.parse(localStorage.getItem(storageKey) || '[]');
        } catch {
          toastedList = [];
        }

        if (!toastedList.includes(workspaceId)) {
          // Fire toast once
          toast({
            title: 'Silent Learner Ready',
            description: `Distilled ${memoryItemCount} lessons from ${sourceSessionCount} sessions to optimize your context.`,
          });

          // Mark as toasted
          toastedList.push(workspaceId);
          localStorage.setItem(storageKey, JSON.stringify(toastedList));
        }
      }).then(addUnlistener);

      // Listen for error events
      runtimeApi.listen('silent_learner.error', (event: any) => {
        const { errorType } = event.payload;
        if (errorType === 'redaction_failed' || errorType === 'redacted_secret') {
          toast({
            title: 'Silent Learner Paused',
            description: 'Learning paused due to sensitive content redaction. Review privacy settings.',
            variant: 'destructive',
          });
        }
      }).then(addUnlistener);
    });

    return () => {
      cancelled = true;
      for (const unlisten of unlisteners) unlisten();
      unlisteners.length = 0;
    };
  }, [toast]);
}
