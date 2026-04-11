import { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { isTauriRuntime } from '@/api/app';
import { cn } from '@/lib/utils';
import Logo from './Logo';

export function TitleBar({ className }: { className?: string }) {
    const [isMaximized, setIsMaximized] = useState(false);

    // Use try-catch to allow development in browser without crashing
    useEffect(() => {
        const init = async () => {
            if (!isTauriRuntime()) return;
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                const appWindow = getCurrentWindow();
                setIsMaximized(await appWindow.isMaximized());

                await appWindow.listen('tauri://resize', async () => {
                    setIsMaximized(await appWindow.isMaximized());
                });
            } catch (e) {
                // Not running in Tauri
            }
        };
        init();
    }, []);

    const minimize = async () => {
        if (!isTauriRuntime()) return;
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().minimize();
        } catch (e) { }
    };

    const toggleMaximize = async () => {
        if (!isTauriRuntime()) return;
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const appWindow = getCurrentWindow();
            if (await appWindow.isMaximized()) {
                await appWindow.unmaximize();
            } else {
                await appWindow.maximize();
            }
        } catch (e) { }
    };

    const close = async () => {
        if (!isTauriRuntime()) return;
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().close();
        } catch (e) { }
    };

    return (
        <div
            className={cn(
                "h-10 flex items-center justify-between px-4 select-none w-full z-[100] transition-colors",
                "bg-background/80 backdrop-blur-md border-b border-white/5",
                className
            )}
        >
            <div className="flex items-center gap-2 pointer-events-none opacity-80">
                <Logo size="sm" />
                <span className="text-xs font-semibold tracking-wide text-foreground">productOS</span>
            </div>
        </div>
    );
}
