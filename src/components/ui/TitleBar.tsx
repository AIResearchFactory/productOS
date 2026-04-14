import { cn } from '@/lib/utils';
import Logo from './Logo';

export function TitleBar({ className }: { className?: string }) {

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
