import React from 'react';
import { appApi } from '@/api/app';
import { Rocket, Loader2, Info, AlertTriangle, RefreshCcw, HardDrive, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';


interface GeneralSettingsProps {
    appVersion: string;
    updateStatus: {
        checking: boolean;
        available: boolean;
        error: string | null;
        updateInfo: any | null;
        lastChecked: Date | null;
    };
    installing: boolean;
    downloadProgress: number;
    onCheckForUpdates: () => void;
    onInstallUpdate: () => void;
    onFactoryReset: () => void;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
    appVersion,
    updateStatus,
    installing,
    downloadProgress,
    onCheckForUpdates,
    onInstallUpdate,
    onFactoryReset
}) => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Updates & Version */}
            <section className="space-y-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">System & Updates</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage application version and system-wide configurations</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-2 border-2 border-primary/10">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Rocket className="w-5 h-5 text-primary" />
                                Application Update
                            </CardTitle>
                            <CardDescription>Current Version: <span className="font-mono font-bold text-primary">v{appVersion}</span></CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!updateStatus.available ? (
                                <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl space-y-4">
                                    <div className="p-3 rounded-full bg-gray-50 dark:bg-gray-800/50">
                                        <Check className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">You are on the latest version</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {updateStatus.lastChecked 
                                                ? `Last checked: ${updateStatus.lastChecked.toLocaleTimeString()}` 
                                                : 'Update check pending'}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={updateStatus.checking}
                                        onClick={onCheckForUpdates}
                                        className="gap-2"
                                    >
                                        {updateStatus.checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                                        Check for Updates
                                    </Button>
                                </div>
                            ) : (
                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-primary">Version {updateStatus.updateInfo.version}</h4>
                                            <p className="text-xs text-primary/70 mt-1">Released on {new Date(updateStatus.updateInfo.date).toLocaleDateString()}</p>
                                        </div>
                                        <span className="bg-primary text-primary-foreground text-2xs px-2 py-0.5 rounded font-bold">NEW</span>
                                    </div>

                                    {updateStatus.updateInfo.body && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-950/50 p-3 rounded-lg border border-primary/5 max-h-32 overflow-y-auto">
                                            {updateStatus.updateInfo.body}
                                        </div>
                                    )}

                                    <Button
                                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                                        disabled={installing}
                                        onClick={onInstallUpdate}
                                    >
                                        {installing ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {downloadProgress > 0 ? `Downloading ${downloadProgress}%` : 'Starting Update...'}
                                            </>
                                        ) : (
                                            <>
                                                <Rocket className="w-4 h-4" />
                                                Update and Relaunch
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {updateStatus.error && (
                                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Update Error: {updateStatus.error}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex flex-col gap-4">
                        <Button
                            variant="outline"
                            className="flex-1 flex flex-col items-center justify-center gap-2 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 group"
                            onClick={() => appApi.openBrowser('https://github.com/AssafMiron/ai-researcher')}
                        >
                            <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-primary/10 transition-colors">
                                <Info className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary" />
                            </div>
                            <span className="text-sm font-medium">GitHub Repo</span>
                        </Button>

                        <Button
                            variant="outline"
                            className="flex-1 flex flex-col items-center justify-center gap-2 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 group"
                            onClick={() => appApi.openBrowser('https://github.com/AssafMiron/ai-researcher/issues')}
                        >
                            <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-red-50 dark:group-hover:bg-red-900/30 transition-colors">
                                <AlertTriangle className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-red-500" />
                            </div>
                            <span className="text-sm font-medium">Report Issue</span>
                        </Button>
                    </div>
                </div>

                <div className="text-center space-y-2 pt-4">
                    <p className="text-xs text-gray-500">
                        &copy; 2026 productOS Team. Built with Tauri, React and Radix UI.
                    </p>
                    <div className="flex items-center justify-center gap-4">
                        <button onClick={() => appApi.openBrowser('https://github.com/AssafMiron/ai-researcher/blob/main/LICENSE')} className="text-2xs text-primary hover:underline focus:outline-none">License Info</button>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <button onClick={() => appApi.openBrowser('https://github.com/AssafMiron/ai-researcher/blob/main/PRIVACY_POLICY.md')} className="text-2xs text-primary hover:underline focus:outline-none">Privacy Policy</button>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <button onClick={() => appApi.openBrowser('https://github.com/AssafMiron/ai-researcher/blob/main/CREDITS.md')} className="text-2xs text-primary hover:underline focus:outline-none">Credits</button>
                    </div>
                </div>
            </section>

            {/* Danger Zone */}
            <section className="mt-12 pt-10 border-t border-red-100 dark:border-red-900/20">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-6">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="text-xl font-bold tracking-tight uppercase">Danger Zone</h3>
                </div>
                
                <Card className="border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/5 shadow-sm overflow-hidden">
                    <CardContent className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <h4 className="text-base font-bold text-red-600 dark:text-red-400">Factory Reset</h4>
                            <p className="text-sm text-red-600/70 dark:text-red-400/70 max-w-md">
                                This will delete all local settings, keys and cached models. This action is irreversible.
                            </p>
                        </div>
                        <Button 
                            variant="destructive" 
                            size="lg"
                            className="gap-2 font-bold shadow-lg shadow-red-500/20"
                            onClick={onFactoryReset}
                        >
                            <HardDrive className="w-4 h-4" />
                            Nuke Settings
                        </Button>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
};

// Internal Helper for the lack of Check icon in imports
const Check = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
);
