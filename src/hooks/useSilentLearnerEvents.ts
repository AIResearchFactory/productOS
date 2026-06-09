import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useSilentLearnerEvents() {
  const { toast } = useToast();

  useEffect(() => {
    let unlistenReady: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;

    // Dynamically import to ensure compatibility with ESM in client bundles
    import('@/api/runtime').then(({ runtimeApi }) => {
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
      }).then(un => unlistenReady = un);

      // Listen for error events
      runtimeApi.listen('silent_learner.error', (event: any) => {
        const { errorType } = event.payload;
        if (errorType === 'redaction_failed') {
          toast({
            title: 'Silent Learner Paused',
            description: 'Learning paused due to sensitive content redaction. Review privacy settings.',
            variant: 'destructive',
          });
        }
      }).then(un => unlistenError = un);
    });

    return () => {
      if (unlistenReady) unlistenReady();
      if (unlistenError) unlistenError();
    };
  }, [toast]);
}
