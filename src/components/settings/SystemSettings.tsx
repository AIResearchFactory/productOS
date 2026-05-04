import React, { useEffect, useState } from 'react';
import { 
    Palette, FolderOpen, Info, HardDrive, AlertTriangle, ShieldAlert, Download, Settings, Loader2 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlobalSettings as IGlobalSettings, appApi } from '@/api/app';
import { SERVER_URL } from '@/api/server';
import { useToast } from '@/hooks/use-toast';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

interface SystemSettingsProps {
    settings: IGlobalSettings;
    setSettings: React.Dispatch<React.SetStateAction<IGlobalSettings>>;
    onFactoryReset: () => void;
}

const SystemSettings: React.FC<SystemSettingsProps> = ({
    settings,
    setSettings,
    onFactoryReset
}) => {
    const { toast } = useToast();
    const [paths, setPaths] = useState<{ globalSettingsPath: string; secretsPath: string; projectsPath: string } | null>(null);
    const [exporting, setExporting] = useState(false);
    
    // Path change confirmation state
    const [isConfirmingPath, setIsConfirmingPath] = useState(false);
    const [pendingPath, setPendingPath] = useState('');
    const [localProjectsPath, setLocalProjectsPath] = useState('');

    useEffect(() => {
        const currentPath = settings.projectsPath || paths?.projectsPath || '';
        setLocalProjectsPath(currentPath);
    }, [settings.projectsPath, paths?.projectsPath]);

    useEffect(() => {
        const loadPaths = async () => {
            try {
                const p = await appApi.getSettingsPaths();
                setPaths(p);
            } catch (err) {
                console.error("Failed to load settings paths", err);
            }
        };
        loadPaths();
    }, []);

    const handleBrowseProjects = async () => {
        try {
            const selected = await appApi.open({
                directory: true,
                multiple: false,
                defaultPath: settings.projectsPath,
                title: 'Select Projects Directory'
            });

            if (selected && typeof selected === 'string') {
                setPendingPath(selected);
                setIsConfirmingPath(true);
            }
        } catch (error) {
            toast({
                title: 'Browse failed',
                description: 'Could not open folder picker.',
                variant: 'destructive',
            });
        }
    };

    const handleConfirmPathChange = async () => {
        try {
            const updatedSettings = { ...settings, projectsPath: pendingPath };
            
            // Save settings immediately before reload
            await appApi.saveGlobalSettings(updatedSettings);
            
            toast({
                title: 'Refreshing Workspace',
                description: 'Project directory changed. Reloading to accurately show your files.',
            });

            // Brief delay for the toast and then reload everything
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            toast({
                title: 'Update failed',
                description: 'Failed to save the new projects directory.',
                variant: 'destructive',
            });
        }
    };

    const handleExportSecrets = async () => {
        setExporting(true);
        try {
            // Show native OS save dialog with default filename
            const savePath = await appApi.save({
                title: 'Export Secrets',
                defaultPath: `productos-secrets-backup-${new Date().toISOString().split('T')[0]}.json`,
                filters: [{ name: 'JSON Files', extensions: ['json'] }, { name: 'Text Files', extensions: ['txt'] }]
            });

            if (!savePath || typeof savePath !== 'string') {
                // User cancelled the dialog
                return;
            }

            const secrets = await appApi.exportSecrets();

            // Write the file via backend to the user-chosen path
            const response = await fetch(`${SERVER_URL}/api/system/write-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: savePath,
                    content: JSON.stringify(secrets, null, 2),
                })
            });

            if (!response.ok) {
                throw new Error('Failed to write file');
            }

            toast({
                title: 'Export successful',
                description: `Secrets exported to: ${savePath}`,
            });
        } catch (err) {
            toast({
                title: 'Export failed',
                description: err instanceof Error ? err.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-12 animate-in fade-in duration-500 pb-20">
            {/* Appearance & Theme */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <Palette className="w-5 h-5 flex-shrink-0" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 italic tracking-tight">Appearance</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Customize how the interface looks and feels</p>
                    </div>
                </div>

                <Card className="border-2 border-primary/10 overflow-hidden">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                            <div className="space-y-2">
                                <Label htmlFor="theme-select" className="text-sm font-bold uppercase tracking-wider text-gray-500">Interface Theme</Label>
                                <Select 
                                    value={settings.theme || 'dark'} 
                                    onValueChange={(v) => setSettings(prev => ({ ...prev, theme: v }))}
                                >
                                    <SelectTrigger id="theme-select" className="w-full h-11 bg-white dark:bg-gray-900 border-primary/20 shadow-sm">
                                        <SelectValue placeholder="Select theme..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="light">Light Mode</SelectItem>
                                        <SelectItem value="dark">Dark Mode</SelectItem>
                                        <SelectItem value="system">System Default</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="hidden md:flex justify-center">
                                <div className="relative w-40 h-24 rounded-lg border-2 border-primary/20 bg-primary/5 flex items-center justify-center overflow-hidden shadow-inner">
                                    <div className={`absolute inset-0 transition-colors duration-500 ${settings.theme === 'light' ? 'bg-white' : settings.theme === 'dark' ? 'bg-gray-950' : 'bg-gradient-to-br from-white to-gray-950'}`} />
                                    <Settings className={`w-8 h-8 animate-pulse ${settings.theme === 'light' ? 'text-gray-400' : 'text-primary'}`} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Workspace Storage */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <FolderOpen className="w-5 h-5 flex-shrink-0" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 italic tracking-tight">Workspace Storage</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Define where your research projects and metadata are stored</p>
                    </div>
                </div>

                <Card className="border-2 border-primary/10">
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="projects-path" className="text-sm font-bold uppercase tracking-wider text-gray-500">Projects Directory</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="projects-path"
                                    value={localProjectsPath}
                                    onChange={(e) => setLocalProjectsPath(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && localProjectsPath !== (settings.projectsPath || paths?.projectsPath || '')) {
                                            setPendingPath(localProjectsPath);
                                            setIsConfirmingPath(true);
                                        }
                                    }}
                                    className="h-11 font-mono text-sm bg-white dark:bg-gray-900 border-primary/20"
                                    placeholder="e.g. ~/Documents/productOS/projects"
                                />
                                {localProjectsPath !== (settings.projectsPath || paths?.projectsPath || '') ? (
                                    <Button 
                                        className="h-11 px-4 bg-primary text-white hover:bg-primary/90 shrink-0 font-bold"
                                        onClick={() => {
                                            setPendingPath(localProjectsPath);
                                            setIsConfirmingPath(true);
                                        }}
                                    >
                                        Apply
                                    </Button>
                                ) : (
                                    <Button 
                                        variant="outline" 
                                        className="h-11 px-4 border-primary/20 hover:bg-primary/5 shrink-0"
                                        onClick={handleBrowseProjects}
                                    >
                                        <FolderOpen className="w-4 h-4 mr-2" />
                                        Browse
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-start gap-2 mt-2">
                                <Info className="w-3.5 h-3.5 text-primary/60 mt-0.5" />
                                <p className="text-[11px] text-gray-500 italic leading-snug">
                                    Changing this path requires a workspace refresh. Existing projects will not be moved automatically.
                                </p>
                            </div>
                        </div>

            {/* Confirmation Dialog for Path Change */}
            <ConfirmationDialog 
                open={isConfirmingPath}
                onOpenChange={setIsConfirmingPath}
                title="Change Projects Directory?"
                description={`This is a major change. The workspace will reload to correctly index projects and skills from "${pendingPath}". Are you sure you want to proceed?`}
                onConfirm={handleConfirmPathChange}
                confirmText="Change & Reload"
                isDestructive={false}
            />
                    </CardContent>
                </Card>
            </section>

            {/* Config & Security */}
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <HardDrive className="w-5 h-5 flex-shrink-0" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 italic tracking-tight">Settings & Security</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Local configuration and encrypted vault details</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/10">
                        <CardContent className="p-5 space-y-4">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Global Config</Label>
                                <p className="text-xs font-mono break-all text-gray-600 dark:text-gray-400 bg-white dark:bg-black/20 p-2 rounded border border-gray-100 dark:border-gray-800">
                                    {paths?.globalSettingsPath || 'Loading...'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Encrypted Vault</Label>
                                <p className="text-xs font-mono break-all text-gray-600 dark:text-gray-400 bg-white dark:bg-black/20 p-2 rounded border border-gray-100 dark:border-gray-800">
                                    {paths?.secretsPath || 'Loading...'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-primary/5 flex flex-col justify-center items-center p-6 space-y-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                            <Download className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 dark:text-gray-100">Export Vault</h4>
                            <p className="text-xs text-gray-500 italic mt-1 max-w-[200px]">Download a decrypted copy of your API keys and secrets for backup.</p>
                        </div>
                        <Button 
                            variant="secondary" 
                            className="bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all w-full"
                            onClick={handleExportSecrets}
                            disabled={exporting}
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                            Export Secrets
                        </Button>
                    </Card>
                </div>
            </section>

            {/* Danger Zone */}
            <section className="space-y-6 pt-10 border-t border-red-100 dark:border-red-900/30">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold italic tracking-tight uppercase">Danger Zone</h3>
                        <p className="text-sm text-red-500/70 mt-0.5">Actions here are permanent and cannot be undone</p>
                    </div>
                </div>

                <Card className="border-2 border-red-500/10 bg-red-50/10 dark:bg-red-950/5">
                    <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="space-y-2">
                                <h4 className="font-bold text-red-600 dark:text-red-400">Factory Reset Application</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md italic leading-relaxed">
                                    This will delete all local configuration, clear your encrypted vault, 
                                    and reset productOS to its original state. Your project files will not be deleted, 
                                    but they will no longer be tracked.
                                </p>
                            </div>
                            <Button 
                                variant="destructive" 
                                className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 px-8 h-11 shrink-0 font-bold"
                                onClick={onFactoryReset}
                            >
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                Reset productOS
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
};

export default SystemSettings;
