import { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { cn } from '@/lib/utils';
import Logo from './Logo';

export function TitleBar({ className }: { className?: string }) {
    const [isMaximized, setIsMaximized] = useState(false);

    // Use try-catch to allow development in browser without crashing
    useEffect(() => {
        const init = async () => {
            try {
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
        try {
            await getCurrentWindow().minimize();
        } catch (e) { }
    };

    const toggleMaximize = async () => {
        try {
            const appWindow = getCurrentWindow();
            if (await appWindow.isMaximized()) {
                await appWindow.unmaximize();
            } else {
                await appWindow.maximize();
            }
        } catch (e) { }
    };

    const close = async () => {
        try {
            await getCurrentWindow().close();
        } catch (e) { }
    };

    return (
        <div
            data-tauri-drag-region
            className={cn(
                "h-10 flex items-center justify-between px-4 select-none w-full z-[100] transition-colors",
                "bg-background/80 backdrop-blur-md border-b border-white/5",
                className
            )}
        >
            <div className="flex items-center gap-2 pointer-events-none opacity-80" data-tauri-drag-region>
                <Logo size="sm" />
                <span className="text-xs font-semibold tracking-wide text-foreground">productOS</span>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={minimize} className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-muted-foreground hover:text-foreground">
                    <Minus size={14} />
                </button>
                <button onClick={toggleMaximize} className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-muted-foreground hover:text-foreground">
                    {isMaximized ? <Square size={12} /> : <Maximize2 size={12} />}
                </button>
                <button onClick={close} className="p-1.5 hover:bg-red-500/20 hover:text-red-500 rounded-md transition-colors text-muted-foreground">
                    <X size={14} />
                </button>
            </div>
        </div>
    );
}
