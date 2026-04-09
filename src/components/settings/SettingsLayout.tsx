import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface SettingsLayoutProps {
    sidebar: React.ReactNode;
    children: React.ReactNode;
    title: string | React.ReactNode;
    description?: string | React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
    sidebar,
    children,
    title,
    description,
}) => {
    return (
        <div className="flex h-full bg-white dark:bg-gray-950">
            {/* Sidebar nav */}
            <aside className="w-64 border-r border-gray-100 dark:border-gray-900 bg-gray-50/30 dark:bg-gray-900/10 flex flex-col shrink-0">
                <div className="p-6 pb-2">
                    <h2 className="text-sm uppercase font-bold tracking-widest text-gray-500 dark:text-gray-400">Settings</h2>
                </div>
                <ScrollArea className="flex-1 px-3 py-2">
                    <nav className="space-y-1">
                        {sidebar}
                    </nav>
                </ScrollArea>
                <div className="p-4 border-t border-gray-100 dark:border-gray-900">
                    <div className="flex items-center gap-2 px-2 py-1 text-2xs text-gray-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        System Connected
                    </div>
                </div>
            </aside>

            {/* Main content area */}
            <main className="flex-1 flex flex-col min-w-0">
                <div className="p-8 pb-4 shrink-0 border-b border-gray-50 dark:border-gray-900/50">
                    <div className="max-w-4xl">
                        {typeof title === 'string' ? (
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 italic tracking-tighter">{title}</h1>
                        ) : title}
                        {description && (
                            typeof description === 'string'
                                ? <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
                                : description
                        )}
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-8 max-w-4xl mx-auto w-full">
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
}

export const SettingsNavItem: React.FC<SettingsNavItemProps> = ({
    icon: Icon,
    label,
    isActive,
    onClick,
    badge
}) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive 
                    ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(var(--primary),0.1)]" 
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
            )}
        >
            <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300")} />
            <span className="flex-1 text-left truncate">{label}</span>
            {badge && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                    {badge}
                </span>
            )}
        </button>
    );
};
