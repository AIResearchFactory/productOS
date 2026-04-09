import { useEffect } from 'react';

interface ShortcutHandlers {
    onNewProject: () => void;
    onNewFile: () => void;
    onCloseFile: () => void;
    onCloseProject: () => void;
    onOpenSettings: () => void;
    onExit: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, dependencies: any[]) {
    useEffect(() => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        const handleKeyDown = (e: KeyboardEvent) => {
            const modifier = isMac ? e.metaKey : e.ctrlKey;
            if (!modifier) return;

            const key = e.key.toLowerCase();
            const shift = e.shiftKey;

            // Mapping: key -> { handler, shift }
            if (key === 'n' && !shift) {
                e.preventDefault();
                handlers.onNewProject();
            } else if (key === 'n' && shift) {
                e.preventDefault();
                handlers.onNewFile();
            } else if (key === 'w' && !shift) {
                e.preventDefault();
                handlers.onCloseFile();
            } else if (key === 'w' && shift) {
                e.preventDefault();
                handlers.onCloseProject();
            } else if (key === ',') {
                e.preventDefault();
                handlers.onOpenSettings();
            } else if (key === 'q' && isMac) {
                e.preventDefault();
                handlers.onExit();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [...dependencies]);
}
