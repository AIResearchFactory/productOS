import React from 'react';
import { 
    Rocket, Loader2, AlertTriangle, RefreshCcw, Github, ExternalLink, ShieldCheck, Heart, FileText 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { appApi } from '@/api/app';

interface AboutSettingsProps {
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
}

const AboutSettings: React.FC<AboutSettingsProps> = ({
    appVersion,
    updateStatus,
    installing,
    downloadProgress,
    onCheckForUpdates,
    onInstallUpdate
}) => {
    const handleOpenLink = (url: string) => {
        appApi.openBrowser(url);
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* Header / Brand */}
            <div className="flex flex-col items-center justify-center p-8 border-b border-gray-100 dark:border-gray-800 space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <Rocket className="w-10 h-10" />
                </div>
                <div className="text-center">
                    <h2 className="text-3xl font-black bg-gradient-to-br from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">productOS</h2>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">Node.js Native Intelligence Layer for the Modern Product Workspace</p>
                    <Badge variant="outline" className="mt-2 font-mono text-xs py-1 px-3 border-primary/20 bg-primary/5 text-primary">
                        v{appVersion}
                    </Badge>
                </div>
            </div>

            {/* Updates Section */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <RefreshCcw className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 italic tracking-tight">Application Update</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Keep productOS up to date with the latest features and fixes</p>
                    </div>
                </div>

                <Card className="border-2 border-primary/10 overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-gray-900 dark:text-gray-100">
                                        {updateStatus.available ? `Version ${updateStatus.updateInfo?.version || 'New'} is available!` : 'You are up to date'}
                                    </h4>
                                    {updateStatus.checking && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                    {updateStatus.lastChecked 
                                        ? `Last checked: ${updateStatus.lastChecked.toLocaleTimeString()}`
                                        : 'No update check performed yet.'}
                                </p>
                                {updateStatus.error && (
                                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg flex items-center gap-2 text-xs text-red-600 dark:text-red-400 font-medium">
                                        <AlertTriangle className="w-4 h-4" />
                                        {updateStatus.error}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button 
                                    onClick={onCheckForUpdates} 
                                    disabled={updateStatus.checking || installing}
                                    variant="outline"
                                    className="h-10 border-primary/20 hover:bg-primary/5"
                                >
                                    Check for Updates
                                </Button>
                                {updateStatus.available && (
                                    <Button 
                                        onClick={onInstallUpdate} 
                                        disabled={installing}
                                        className="h-10 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
                                    >
                                        {installing ? 'Installing...' : 'Install Now'}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {installing && (
                            <div className="mt-6 space-y-2">
                                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500">
                                    <span>Downloading update...</span>
                                    <span>{downloadProgress}%</span>
                                </div>
                                <Progress value={downloadProgress} className="h-2 bg-primary/10" />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>

            {/* Links Section */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card 
                    className="border border-gray-100 dark:border-gray-800 hover:border-primary/30 transition-all cursor-pointer group"
                    onClick={() => handleOpenLink('https://github.com/AIResearchFactory/productOS/')}
                >
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-600 dark:text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <Github className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">GitHub Repository</h4>
                            <p className="text-xs text-gray-500 italic">Source code and contributions</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-primary/50" />
                    </CardContent>
                </Card>

                <Card 
                    className="border border-gray-100 dark:border-gray-800 hover:border-primary/30 transition-all cursor-pointer group"
                    onClick={() => handleOpenLink('https://github.com/AIResearchFactory/productOS//issues')}
                >
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-600 dark:text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">Report an Issue</h4>
                            <p className="text-xs text-gray-500 italic">Bug reports and feature requests</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-primary/50" />
                    </CardContent>
                </Card>
            </section>

            {/* Footer / Legal */}
            <div className="pt-10 border-t border-gray-100 dark:border-gray-800 text-center space-y-6">
                <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-medium text-gray-500">
                    <button onClick={() => handleOpenLink('https://github.com/AIResearchFactory/productOS//blob/main/LICENSE')} className="hover:text-primary transition-colors flex items-center gap-2">
                        <FileText className="w-4 h-4" /> License
                    </button>
                    <button onClick={() => handleOpenLink('https://github.com/AIResearchFactory/productOS//blob/main/CREDITS.md')} className="hover:text-primary transition-colors flex items-center gap-2">
                        <Heart className="w-4 h-4" /> Credits
                    </button>
                    <button onClick={() => handleOpenLink('https://github.com/AIResearchFactory/productOS//blob/main/PRIVACY.md')} className="hover:text-primary transition-colors flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> Privacy Policy
                    </button>
                </div>
                
                <p className="text-[11px] text-gray-400 leading-relaxed max-w-lg mx-auto italic">
                    Developed with passion by the productOS community. Crafted for product managers, designers, and engineers who care about velocity and deep work.
                </p>
            </div>
        </div>
    );
};

export default AboutSettings;
