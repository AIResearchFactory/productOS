import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Check, Download, Search, Trash2, Globe, Server, Database, Github, FolderOpen, Plus, FileJson, Star, User, ShieldCheck, Save, RotateCcw, Loader2 } from 'lucide-react';
import { tauriApi, McpServerConfig } from '@/api/tauri';
import { useToast } from '@/hooks/use-toast';

export default function McpMarketplace() {
    const [installedServers, setInstalledServers] = useState<McpServerConfig[]>([]);
    const [marketplaceServers, setMarketplaceServers] = useState<McpServerConfig[]>([]);
    const [loadingMarketplace, setLoadingMarketplace] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newServer, setNewServer] = useState({ id: '', name: '', command: '', args: '' });
    const { toast } = useToast();
    const [configJson, setConfigJson] = useState('[]');
    const [setupServer, setSetupServer] = useState<McpServerConfig | null>(null);
    const [isSetupOpen, setIsSetupOpen] = useState(false);
    const [setupConfig, setSetupConfig] = useState<Record<string, string>>({});
    const [ownerName, setOwnerName] = useState('');
    const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncTargets, setSyncTargets] = useState<string[]>([]);

    // Sync config JSON when installed servers change
    useEffect(() => {
        setConfigJson(JSON.stringify(installedServers, null, 2));
    }, [installedServers]);

    const handleSaveConfig = async () => {
        try {
            const parsed = JSON.parse(configJson);
            if (!Array.isArray(parsed)) {
                throw new Error("Configuration must be an array of servers");
            }
            // Basic validation
            for (const s of parsed) {
                if (!s.id || !s.name || !s.command) {
                    throw new Error("Each server must have id, name, and command");
                }
            }

            const settings = await tauriApi.getGlobalSettings();
            // Ensure we keep the full object structure but update mcpServers
            const newSettings = {
                ...settings,
                mcpServers: parsed
            };

            await tauriApi.saveGlobalSettings(newSettings);
            await loadServers();

            toast({ title: 'Configuration Saved', description: 'MCP settings updated successfully.' });
        } catch (error) {
            console.error(error);
            toast({
                title: 'Save Failed',
                description: error instanceof Error ? error.message : String(error),
                variant: 'destructive',
            });
        }
    };

    // Helper functions
    const isInstalled = (id: string) => installedServers.some(s => s.id === id);

    // Load installed servers
    const loadServers = async () => {
        try {
            const servers = await tauriApi.getMcpServers();
            setInstalledServers(servers || []);
        } catch (error) {
            console.error('Failed to load MCP servers:', error);
            toast({
                title: 'Error',
                description: 'Failed to load configured MCP servers',
                variant: 'destructive',
            });
        }
    };

    const loadMarketplace = async (query?: string) => {
        setLoadingMarketplace(true);
        try {
            const servers = await tauriApi.fetchMcpMarketplace(query);
            setMarketplaceServers(servers || []);
        } catch (error) {
            console.error('Failed to load MCP marketplace:', error);

            // Provide mock data if in browser mode to show the UI
            if (window.location.hostname === 'localhost' && !(window as any).__TAURI__) {
                setMarketplaceServers([
                    { id: 'google-maps', name: 'Google Maps', description: 'Search and navigate using Google Maps data.', command: 'npx', args: [], enabled: false, stars: 1200, author: 'google', categories: ['Maps', 'Search'] },
                    { id: 'postgres', name: 'PostgreSQL', description: 'Direct access to PostgreSQL databases for data analysis.', command: 'npx', args: [], enabled: false, stars: 850, author: 'mcp-official', categories: ['Database'] },
                    { id: 'monday', name: 'Monday.com', description: 'Manage boards and items on Monday.com work OS.', command: 'npx', args: [], enabled: false, stars: 450, author: 'monday-corp', categories: ['Productivity'] },
                    { id: 'github', name: 'GitHub', description: 'Interact with repositories, issues, and pull requests.', command: 'npx', args: [], enabled: false, stars: 2100, author: 'github', categories: ['DevTools'] }
                ]);
            } else {
                toast({
                    title: 'Marketplace Error',
                    description: 'Failed to connect to marketplace. Check your connection.',
                    variant: 'destructive',
                });
            }
        } finally {
            setLoadingMarketplace(false);
        }
    };

    useEffect(() => {
        loadServers();
        loadMarketplace();

        // Load owner name for auto-fill
        tauriApi.getFormattedOwnerName().then(setOwnerName).catch(console.error);
    }, []);

    useEffect(() => {
        if (searchQuery.length >= 3) {
            const timeoutId = setTimeout(() => {
                loadMarketplace(searchQuery);
            }, 500);
            return () => clearTimeout(timeoutId);
        } else if (searchQuery.length === 0) {
            loadMarketplace();
        }
    }, [searchQuery]);

    const handleInstall = async (item: McpServerConfig) => {
        try {
            if (isInstalled(item.id)) {
                toast({
                    title: 'Already Installed',
                    description: `${item.name} is already configured.`,
                });
                return;
            }

            // Check if this server requires specialized setup
            const id = item.id.toLowerCase();
            if (id.includes('aha') || id.includes('jira') || id.includes('monday') || id.includes('productboard')) {
                setSetupServer(item);
                setIsSetupOpen(true);

                // Initialize setup config with blanks or defaults
                const initialConfig: Record<string, string> = {
                    owner: ownerName
                };

                if (id.includes('aha')) {
                    initialConfig.domain = '';
                    initialConfig.apiKey = '';
                } else if (id.includes('jira')) {
                    initialConfig.domain = '';
                    initialConfig.email = '';
                    initialConfig.apiKey = '';
                } else if (id.includes('monday') || id.includes('productboard')) {
                    initialConfig.apiKey = '';
                }

                setSetupConfig(initialConfig);
                return;
            }

            const config: McpServerConfig = {
                ...item,
                enabled: true,
            };

            await tauriApi.addMcpServer(config);
            await loadServers();
            toast({
                title: 'Server Added',
                description: `${item.name} has been added to your configuration.`,
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: String(error),
                variant: 'destructive',
            });
        }
    };

    const handleSetupSubmit = async () => {
        if (!setupServer) return;

        try {
            const id = setupServer.id.toLowerCase();
            const config: McpServerConfig = {
                ...setupServer,
                enabled: true,
                env: { ...setupServer.env }
            };

            // 1. Handle Secrets
            if (setupConfig.apiKey && setupConfig.apiKey !== '••••••••') {
                const secretKey = `${id}_api_key`.replace(/[^a-zA-Z0-9_]/g, '_');
                await tauriApi.saveSecret(secretKey, setupConfig.apiKey);

                // Use secretsEnv instead of env for API keys
                if (!config.secretsEnv) config.secretsEnv = {};

                if (id.includes('aha')) {
                    config.secretsEnv.AHA_API_KEY = secretKey;
                } else if (id.includes('jira')) {
                    config.secretsEnv.JIRA_API_TOKEN = secretKey;
                    if (!config.env) config.env = {};
                    config.env.JIRA_EMAIL = setupConfig.email;
                } else if (id.includes('monday')) {
                    config.secretsEnv.MONDAY_API_TOKEN = secretKey;
                } else if (id.includes('productboard')) {
                    config.secretsEnv.PRODUCTBOARD_TOKEN = secretKey;
                }
            }

            // 2. Handle Domains & Environment Variables
            if (setupConfig.domain) {
                if (!config.env) config.env = {};
                if (id.includes('aha')) config.env.AHA_DOMAIN = setupConfig.domain;
                if (id.includes('jira')) config.env.JIRA_DOMAIN = setupConfig.domain;
            }

            // 3. Handle Owner (if required by the server logic or just for metadata)
            if (setupConfig.owner) {
                if (!config.env) config.env = {};
                config.env.OWNER = setupConfig.owner;
            }

            await tauriApi.addMcpServer(config);
            await loadServers();
            setIsSetupOpen(false);
            setSetupServer(null);

            toast({
                title: 'Integration Setup Complete',
                description: `${setupServer.name} has been configured with your credentials.`,
            });
        } catch (error) {
            toast({
                title: 'Setup Failed',
                description: String(error),
                variant: 'destructive',
            });
        }
    };

    const handleAddCustom = async () => {
        if (!newServer.id || !newServer.name || !newServer.command) {
            toast({
                title: 'Validation Error',
                description: 'Please fill in all required fields',
                variant: 'destructive',
            });
            return;
        }

        try {
            const config: McpServerConfig = {
                id: newServer.id,
                name: newServer.name,
                command: newServer.command,
                args: newServer.args.split(' ').filter(a => a.length > 0),
                enabled: true,
                description: 'Custom MCP Server',
            };

            await tauriApi.addMcpServer(config);
            await loadServers();
            setNewServer({ id: '', name: '', command: '', args: '' });
            setIsDialogOpen(false);
            toast({
                title: 'Server Added',
                description: 'Custom MCP server configured successfully.',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: String(error),
                variant: 'destructive',
            });
        }
    };

    const handleRemove = async (id: string) => {
        try {
            await tauriApi.removeMcpServer(id);
            await loadServers();
            toast({
                title: 'Server Removed',
                description: 'MCP server has been removed.',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: String(error),
                variant: 'destructive',
            });
        }
    };

    const handleEdit = (server: McpServerConfig) => {
        const id = server.id.toLowerCase();
        setSetupServer(server);
        setIsSetupOpen(true);

        const initialConfig: Record<string, string> = {
            owner: server.env?.OWNER || ownerName
        };

        if (id.includes('aha')) {
            initialConfig.domain = server.env?.AHA_DOMAIN || '';
            initialConfig.apiKey = '••••••••'; // Placeholder to show it's set
        } else if (id.includes('jira')) {
            initialConfig.domain = server.env?.JIRA_DOMAIN || '';
            initialConfig.email = server.env?.JIRA_EMAIL || '';
            initialConfig.apiKey = '••••••••';
        } else if (id.includes('monday')) {
            initialConfig.apiKey = '••••••••';
        } else if (id.includes('productboard')) {
            initialConfig.apiKey = '••••••••';
        }

        setSetupConfig(initialConfig);
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        try {
            await tauriApi.toggleMcpServer(id, enabled);
            setInstalledServers(prev => prev.map(s => s.id === id ? { ...s, enabled } : s));
        } catch (error) {
            await loadServers();
            toast({
                title: 'Error',
                description: String(error),
                variant: 'destructive'
            });
        }
    };

    const handleOpenSyncDialog = async () => {
        try {
            const settings = await tauriApi.getGlobalSettings();
            const targets: string[] = [];

            // Fixed paths for standard CLIs (assuming home dir expansion on backend)
            targets.push('~/.gemini/settings.json');
            targets.push('~/.claude/settings.json');

            // Custom CLIs
            if (settings.customClis) {
                for (const custom of settings.customClis) {
                    if (custom.isConfigured && custom.settingsFilePath) {
                        targets.push(`${custom.settingsFilePath} (${custom.name})`);
                    }
                }
            }

            setSyncTargets(targets);
            setIsSyncDialogOpen(true);
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to load sync targets', variant: 'destructive' });
        }
    };

    const handleSyncWithClis = async () => {
        setSyncing(true);
        try {
            const paths = await tauriApi.syncMcpWithClis();
            toast({
                title: 'CLIs Synchronized',
                description: `Updated config files for: ${paths.join(', ')}`,
            });
            setIsSyncDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({
                title: 'Sync Failed',
                description: String(error),
                variant: 'destructive',
            });
        } finally {
            setSyncing(false);
        }
    };

    const cleanName = (name: string) => {
        if (!name) return 'Unknown Server';
        // Handle github names e.g. github.com/user/repo or user/repo
        let base = name;
        if (name.includes('/')) {
            const parts = name.split('/');
            base = parts[parts.length - 1];
        }
        // Replace dashes/underscores with spaces and Title Case
        return base
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getInitials = (name: string) => {
        const cleaned = cleanName(name);
        return cleaned.slice(0, 2).toUpperCase();
    };

    const getIcon = (item: McpServerConfig) => {
        const id = (item.id || '').toLowerCase();
        const rawName = (item.name || '').toLowerCase();
        const displayName = cleanName(item.name || '');

        if (item.iconUrl) {
            return <img src={item.iconUrl} className="w-12 h-12 rounded-2xl object-cover shadow-md ring-1 ring-slate-900/5 dark:ring-white/10" alt={displayName} />;
        }

        if (id.includes('monday') || rawName.includes('monday')) return <div className="w-12 h-12 bg-[#6161FF] rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md">M</div>;
        if (id.includes('github') || id.includes('git')) return <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-md"><Github className="w-7 h-7" /></div>;
        if (id.includes('postgres') || id.includes('sql')) return <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shadow-md border border-blue-100 dark:border-blue-800"><Database className="w-7 h-7 text-blue-500" /></div>;
        if (id.includes('file')) return <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center shadow-md border border-amber-100 dark:border-amber-800"><FolderOpen className="w-7 h-7 text-amber-500" /></div>;
        if (id.includes('search') || id.includes('google')) return <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center shadow-md border border-emerald-100 dark:border-emerald-800"><Globe className="w-7 h-7 text-emerald-500" /></div>;

        // Dynamic gradient fallback based on name char code to vary colors slightly
        const charCode = displayName.charCodeAt(0) || 0;
        const gradients = [
            'from-blue-500 to-indigo-600',
            'from-emerald-500 to-teal-600',
            'from-orange-500 to-red-600',
            'from-purple-500 to-pink-600',
            'from-cyan-500 to-blue-600'
        ];
        const gradient = gradients[charCode % gradients.length];

        return (
            <div className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md ring-1 ring-white/20`}>
                {getInitials(displayName)}
            </div>
        );
    };

    const filteredMarketplace = marketplaceServers.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const isPmIntegration = (id: string) => {
        const lower = id.toLowerCase();
        return lower.includes('aha') || lower.includes('jira') || lower.includes('monday') || lower.includes('productboard');
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto px-4 pb-12">
            <div className="flex flex-col items-center text-center gap-3 mb-8 pt-4">
                <h1 className="text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                    MCP Marketplace
                </h1>
                <p className="text-slate-500 dark:text-slate-400 max-w-lg text-lg font-medium leading-relaxed">
                    Discover and install specialized capability providers to supercharge your AI assistants.
                </p>
            </div>

            <div className="sticky top-4 z-30">
                <div className="relative group max-w-4xl mx-auto shadow-2xl rounded-2xl">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-focus-within:opacity-75 transition duration-500" />
                    <div className="relative flex items-center bg-white dark:bg-slate-900 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden px-5 py-1">
                        <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            placeholder="Search for tools, databases, APIs..."
                            className="h-12 bg-transparent border-none focus-visible:ring-0 text-lg shadow-none placeholder:text-slate-400"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {filteredMarketplace.length > 0 && (
                            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                                {filteredMarketplace.length} <span className="text-slate-400">Items</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Tabs defaultValue="marketplace" className="w-full">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
                    <TabsList className="bg-slate-100 dark:bg-slate-800/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                        <TabsTrigger value="marketplace" className="px-8 py-2.5 rounded-xl text-sm font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm transition-all">
                            Browse Registry
                        </TabsTrigger>
                        <TabsTrigger value="installed" className="px-8 py-2.5 rounded-xl text-sm font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:shadow-sm transition-all">
                            Installed
                            {installedServers.length > 0 && (
                                <span className="ml-2 bg-slate-200 dark:bg-slate-950 px-1.5 py-0.5 rounded-md text-[10px]">
                                    {installedServers.length}
                                </span>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="raw" className="px-4 py-2.5 rounded-xl text-sm font-semibold"><FileJson className="w-4 h-4" /></TabsTrigger>
                    </TabsList>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 rounded-xl h-10 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10">
                                <Plus className="w-4 h-4" /> Custom Server
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] rounded-3xl">
                            <DialogHeader>
                                <DialogTitle>Add Custom MCP Server</DialogTitle>
                                <DialogDescription>
                                    Configure a local or community MCP server manually.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="id">Unique ID</Label>
                                    <Input id="id" placeholder="e.g. my-server" value={newServer.id} onChange={(e) => setNewServer({ ...newServer, id: e.target.value })} className="rounded-xl" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Display Name</Label>
                                    <Input id="name" placeholder="e.g. My Tools" value={newServer.name} onChange={(e) => setNewServer({ ...newServer, name: e.target.value })} className="rounded-xl" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="command">Runtime Command</Label>
                                    <Input id="command" placeholder="npx, python, node" value={newServer.command} onChange={(e) => setNewServer({ ...newServer, command: e.target.value })} className="rounded-xl" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="args">Arguments</Label>
                                    <Input id="args" placeholder="-y @package-name" value={newServer.args} onChange={(e) => setNewServer({ ...newServer, args: e.target.value })} className="rounded-xl" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAddCustom} className="w-full rounded-xl">Save Server</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isSyncDialogOpen} onOpenChange={setIsSyncDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 rounded-xl h-10 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                onClick={handleOpenSyncDialog}
                            >
                                <RotateCcw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} /> Sync with CLIs
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] rounded-3xl">
                            <DialogHeader>
                                <DialogTitle>Sync MCP with Global CLIs</DialogTitle>
                                <DialogDescription>
                                    This will update your global configuration files for Gemini CLI and Claude Code to include the current enabled MCP servers.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4 text-sm text-slate-500">
                                <p>Modified files will include:</p>
                                <ul className="list-disc list-inside space-y-1 font-mono text-[10px] bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                    {syncTargets.map((target, idx) => (
                                        <li key={idx} className="truncate" title={target}>{target}</li>
                                    ))}
                                </ul>
                                <p className="italic text-amber-600 dark:text-amber-400">
                                    Existing settings will be preserved; only the <strong>mcpServers</strong> section will be updated.
                                </p>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsSyncDialogOpen(false)}
                                    className="rounded-xl"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSyncWithClis}
                                    disabled={syncing}
                                    className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Apply Changes
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
                        <DialogContent className="sm:max-w-[450px] rounded-[2.5rem] p-8">
                            <DialogHeader className="items-center text-center pb-4">
                                <div className="mb-4">
                                    {setupServer && getIcon(setupServer)}
                                </div>
                                <DialogTitle className="text-2xl font-black tracking-tight uppercase italic underline decoration-blue-500 underline-offset-8 decoration-4">
                                    Setup {setupServer?.name}
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 font-medium">
                                    Connect your AI assistant to your {setupServer?.name} instance securely.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-6 pt-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="owner" className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                                        <User className="w-3 h-3" /> System Owner (Auto-derived)
                                    </Label>
                                    <Input
                                        id="owner"
                                        value={setupConfig.owner || ''}
                                        onChange={(e) => setSetupConfig({ ...setupConfig, owner: e.target.value })}
                                        className="h-12 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 font-bold"
                                        placeholder="Dominik"
                                    />
                                </div>

                                {('domain' in setupConfig) && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="domain" className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                                            <Globe className="w-3 h-3" /> Instance Domain
                                        </Label>
                                        <div className="relative group">
                                            <Input
                                                id="domain"
                                                value={setupConfig.domain || ''}
                                                onChange={(e) => setSetupConfig({ ...setupConfig, domain: e.target.value })}
                                                className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 font-bold pl-3 pr-24"
                                                placeholder="e.g. mydomain"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black italic text-slate-400 group-focus-within:text-blue-500 transition-colors">
                                                .{setupServer?.id.includes('aha') ? 'aha.io' : 'atlassian.net'}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {('email' in setupConfig) && (
                                    <div className="grid gap-2">
                                        <Label htmlFor="email" className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                                            <User className="w-3 h-3" /> Atlassian Email
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={setupConfig.email || ''}
                                            onChange={(e) => setSetupConfig({ ...setupConfig, email: e.target.value })}
                                            className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 font-bold"
                                            placeholder="you@company.com"
                                        />
                                    </div>
                                )}

                                <div className="grid gap-2">
                                    <Label htmlFor="apiKey" className="flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                                        <ShieldCheck className="w-3 h-3" /> API Key / Token
                                    </Label>
                                    <Input
                                        id="apiKey"
                                        type="password"
                                        value={setupConfig.apiKey || ''}
                                        onChange={(e) => setSetupConfig({ ...setupConfig, apiKey: e.target.value })}
                                        className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 font-mono tracking-widest text-blue-500"
                                        placeholder="••••••••••••••••"
                                    />
                                    <p className="text-[10px] text-slate-400 italic">This key will be stored securely in your encrypted settings.</p>
                                </div>
                            </div>

                            <DialogFooter className="pt-8 block">
                                <Button
                                    onClick={handleSetupSubmit}
                                    className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-lg shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all uppercase italic tracking-wider"
                                >
                                    Activate Integration
                                </Button>
                                <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">By clicking activate, you agree to add this server to your AI's available toolkit.</p>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <TabsContent value="installed" className="mt-0">
                    {installedServers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-3xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 max-w-2xl mx-auto">
                            <Server className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No Servers Installed</h3>
                            <p className="text-sm text-slate-500 max-w-xs text-center mt-2 px-4 italic">
                                Ready to scale up? Head to browse to add tools.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {installedServers.map(server => (
                                <div
                                    key={server.id}
                                    className="group flex items-start p-5 rounded-3xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden"
                                >
                                    <div className="mr-5 shrink-0 relative z-10">
                                        {getIcon(server)}
                                    </div>

                                    <div className="flex-1 min-w-0 mr-2 relative z-10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate text-lg">
                                                {cleanName(server.name)}
                                            </h4>
                                            {server.enabled ? (
                                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-[10px] font-bold uppercase tracking-wider">
                                                    Active
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                                    Disabled
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed h-10">
                                            {server.description || 'Custom MCP server configuration active.'}
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-2 relative z-10">
                                        <Switch
                                            checked={server.enabled}
                                            onCheckedChange={(checked) => handleToggle(server.id, checked)}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="w-8 h-8 -mr-1 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full transition-colors"
                                            onClick={() => handleRemove(server.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                        {isPmIntegration(server.id) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="w-8 h-8 -mr-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-full transition-colors"
                                                onClick={() => handleEdit(server)}
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="marketplace" className="mt-0">
                    {loadingMarketplace ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-6">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800" />
                                <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
                            </div>
                            <span className="text-sm font-bold text-slate-400 animate-pulse tracking-widest uppercase">Indexing Registry...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-20">
                            {filteredMarketplace.map(item => {
                                const installed = isInstalled(item.id);
                                const displayName = cleanName(item.name);

                                return (
                                    <div
                                        key={item.id}
                                        className={`group flex flex-col p-6 rounded-[2rem] border transition-all duration-300 relative overflow-hidden ${installed
                                            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800'
                                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-xl hover:-translate-y-1'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="transform group-hover:scale-110 transition-transform duration-300">
                                                    {getIcon(item)}
                                                </div>
                                                <div>
                                                    <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-xl tracking-tight leading-none mb-1 group-hover:text-blue-600 transition-colors">
                                                        {displayName}
                                                    </h4>
                                                    <div className="flex items-center gap-3 text-[11px] font-medium text-slate-400">
                                                        {item.author && (
                                                            <span className="flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                                                <User className="w-3 h-3" /> {item.author}
                                                            </span>
                                                        )}
                                                        {item.stars && (
                                                            <span className="flex items-center gap-1 text-amber-500 bg-amber-50 dark:bg-amber-900/10 px-1.5 py-0.5 rounded-md">
                                                                <Star className="w-3 h-3 fill-amber-500" />
                                                                {item.stars > 1000 ? `${(item.stars / 1000).toFixed(1)}k` : item.stars}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {item.source === 'registry' && (
                                                <div title="Official Registry">
                                                    <ShieldCheck className="w-5 h-5 text-blue-500/80" />
                                                </div>
                                            )}
                                        </div>

                                        <p className="flex-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6 line-clamp-2">
                                            {item.description || 'Access specialized capabilities and tools for your AI environment.'}
                                        </p>

                                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50 dark:border-slate-800/50 dashed">
                                            <div className="flex gap-2">
                                                {item.categories && item.categories.slice(0, 2).map(cat => (
                                                    <span key={cat} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                                        {cat}
                                                    </span>
                                                ))}
                                            </div>

                                            {installed ? (
                                                <Button size="sm" variant="ghost" disabled className="h-9 gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold opacity-100">
                                                    <Check className="w-4 h-4" /> Installed
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    className={`h-9 px-5 rounded-xl text-white shadow-lg transition-all font-bold group-hover:translate-x-1 ${isPmIntegration(item.id)
                                                        ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 hover:shadow-blue-500/40'
                                                        : 'bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 shadow-indigo-500/20 hover:shadow-indigo-500/40'
                                                        }`}
                                                    onClick={() => handleInstall(item)}
                                                >
                                                    {isPmIntegration(item.id) ? 'Configure' : 'Install'}
                                                    <Download className="w-3.5 h-3.5 ml-2 opacity-70" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="raw" className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                <FileJson className="w-5 h-5 text-slate-500" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">MCP Configuration</h4>
                                <p className="text-xs text-slate-500">Edit raw JSON configuration</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-2 rounded-xl border-slate-200 dark:border-slate-800"
                                onClick={() => {
                                    setConfigJson(JSON.stringify(installedServers, null, 2));
                                    toast({ title: 'Reset', description: 'Configuration reset to current settings.' });
                                }}
                            >
                                <RotateCcw className="w-4 h-4" /> Reset
                            </Button>
                            <Button
                                size="sm"
                                className="h-9 gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 font-bold shadow-lg"
                                onClick={handleSaveConfig}
                            >
                                <Save className="w-4 h-4" /> Save Configuration
                            </Button>
                        </div>
                    </div>
                    <Card className="bg-slate-950 text-slate-300 border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/5">
                        <CardContent className="p-0">
                            <Textarea
                                value={configJson}
                                onChange={(e) => setConfigJson(e.target.value)}
                                className="font-mono text-[12px] min-h-[700px] w-full border-0 focus-visible:ring-0 p-8 bg-transparent text-blue-400/90 leading-relaxed resize-none"
                                spellCheck={false}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

