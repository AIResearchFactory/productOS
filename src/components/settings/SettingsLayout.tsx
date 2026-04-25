import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SettingsLayoutProps {
    sidebar: React.ReactNode;
    children: React.ReactNode;
    title: string | React.ReactNode;
    description?: string | React.ReactNode;
    searchTerm?: string;
    onSearchChange?: (val: string) => void;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
    sidebar,
    children,
    title,
    description,
    searchTerm,
    onSearchChange
}) => {
    return (
        <div className="flex h-full bg-background/25">
            {/* Sidebar nav */}
            <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-background/55 backdrop-blur-2xl">
                <div className="p-5 pb-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-4 shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
                        <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Settings</h2>
                        <p className="mt-2 text-sm font-semibold text-foreground">Workspace controls</p>
                        <p className="mt-1 text-xs text-muted-foreground">Models, integrations, usage, and system behavior.</p>
                    </div>
                </div>
                <ScrollArea className="flex-1 px-3 py-2">
                    <nav className="space-y-1">
                        {sidebar}
                    </nav>
                </ScrollArea>
                <div className="border-t border-white/10 p-4">
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-2xs font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        System Connected
                    </div>
                </div>
            </aside>

            {/* Main content area */}
            <main className="flex min-w-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-white/10 bg-background/35 px-8 pb-4 pt-6 backdrop-blur-xl">
                    <div className="max-w-5xl">
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                            <div className="space-y-1">
                                {typeof title === 'string' ? (
                                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                                ) : (
                                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                                )}
                                {description && (
                                    typeof description === 'string'
                                        ? <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                                        : description
                                )}
                            </div>
                            <div className="relative max-w-sm flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input 
                                    value={searchTerm || ''}
                                    onChange={(e) => onSearchChange?.(e.target.value)}
                                    placeholder="Search settings..." 
                                    className="h-11 rounded-2xl border-white/10 bg-white/5 pl-10 focus:ring-primary/20"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="mx-auto w-full max-w-5xl p-8">
                        {children}
                    </div>
                </ScrollArea>
            </main>
        </div>
    );
};

interface SettingsNavItemProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    isActive: boolean;
    onClick: () => void;
    badge?: string;
    testId?: string;
}

export const SettingsNavItem: React.FC<SettingsNavItemProps> = ({
    icon: Icon,
    label,
    isActive,
    onClick,
    badge,
    testId
}) => {
    return (
        <button
            onClick={onClick}
            data-testid={testId}
            className={cn(
                "group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-sm font-medium transition-all",
                isActive 
                    ? "border-primary/20 bg-primary/10 text-primary shadow-[0_10px_24px_rgba(59,130,246,0.12)]" 
                    : "border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/5 hover:text-foreground"
            )}
        >
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", isActive ? "bg-primary/12 text-primary" : "bg-white/5 text-muted-foreground group-hover:text-foreground")}>
                <Icon className="h-4 w-4 shrink-0" />
            </div>
            <span className="flex-1 text-left truncate">{label}</span>
            {badge && (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    {badge}
                </span>
            )}
        </button>
    );
};
