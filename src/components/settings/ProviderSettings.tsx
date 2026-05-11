import React from 'react';
import { 
    Check, Loader2, Server, Zap, Cpu, Key, RefreshCcw, 
    Link2, ChevronDown, Trash2, Plus, Terminal
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { 
    OpenAiCliInfo, GlobalSettings, 
    OllamaInfo, ClaudeCodeInfo, GeminiInfo, 
    ProviderType, CustomCliConfig, OpenAiAuthStatus, GoogleAuthStatus 
} from '@/api/app';

interface ProviderCardProps {
    id: string;
    title: string;
    icon: React.ReactNode;
    configured: boolean;
    expanded: boolean;
    onToggle: () => void;
    badge?: React.ReactNode;
    status?: 'active' | 'detected' | 'none';
    children: React.ReactNode;
}

interface ProviderSettingsProps {
    settings: GlobalSettings;
    setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
    apiKey: string;
    setApiKey: (v: string) => void;
    customApiKeys: Record<string, string>;
    setCustomApiKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    localModels: {
        ollama: OllamaInfo | null;
        claudeCode: ClaudeCodeInfo | null;
        gemini: GeminiInfo | null;
        openAiCli: OpenAiCliInfo | null;
    };
    expandedSections: Record<string, boolean>;
    setExpandedSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    litellmTesting: boolean;
    litellmTestResult: { ok: boolean; message: string } | null;
    ollamaModelsList: string[];
    onRefreshOllamaKeys: () => void;
    onTestLiteLlm: (baseUrl: string, apiKey: string) => void;
    onAddCustomCli: (config: CustomCliConfig) => void;
    onRemoveCustomCli: (id: string) => void;
    onUpdateCustomCli: (id: string, field: keyof CustomCliConfig, value: any) => void;
    isConfigured: (provider: ProviderType, customId?: string) => boolean;
    openAiAuthStatus: OpenAiAuthStatus | null;
    googleAuthStatus: GoogleAuthStatus | null;
    onAuthenticateOpenAi: () => void;
    onLogoutOpenAi: () => void;
    onAuthenticateGemini: () => void;
    onAuthenticateClaude: () => void;
    onLogoutGoogle: () => void;
    onRefreshAuthStatus: () => void;
    isAuthenticating: string | null;
    searchTerm?: string;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
    id,
    title,
    icon,
    configured,
    expanded,
    onToggle,
    badge,
    status = 'none',
    children
}) => {
    const isActive = status === 'active' || configured;
    
    return (
        <div className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${isActive ? 'border-primary/20 bg-primary/[0.02] dark:bg-primary/[0.04]' : status === 'detected' ? 'border-blue-100 dark:border-blue-900/20 bg-blue-50/10 dark:bg-blue-900/5' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'}`}>
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                id={`provider-card-toggle-${id}`}
            >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-primary/10 text-primary' : status === 'detected' ? 'bg-blue-100 dark:bg-blue-950 text-blue-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                    {icon}
                </div>
                <span className="flex-1 text-left font-semibold text-sm text-gray-900 dark:text-gray-100">{title}</span>
                {badge}
                {isActive ? (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                        <Check className="w-3 h-3" />
                        Active
                    </span>
                ) : status === 'detected' ? (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                        <Zap className="w-3 h-3" />
                        Detected
                    </span>
                ) : (
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                )}
            </button>
            {expanded && (
                <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-800">
                    {children}
                </div>
            )}
        </div>
    );
};

const ProviderSettings: React.FC<ProviderSettingsProps> = ({
    settings,
    setSettings,
    apiKey,
    setApiKey,
    customApiKeys,
    setCustomApiKeys,
    localModels,
    expandedSections,
    setExpandedSections,
    litellmTesting,
    litellmTestResult,
    ollamaModelsList,
    onRefreshOllamaKeys,
    onTestLiteLlm,
    onAddCustomCli,
    onRemoveCustomCli,
    onUpdateCustomCli,
    isConfigured,
    isAuthenticating,
    onLogoutGoogle,
    onRefreshAuthStatus,
    openAiAuthStatus,
    googleAuthStatus,
    onAuthenticateOpenAi,
    onLogoutOpenAi,
    onAuthenticateGemini,
    onAuthenticateClaude,
    searchTerm = '',
}) => {
    
    const filterCard = (name: string, description: string) => {
        if (!searchTerm) return true;
        const lowerSearch = searchTerm.toLowerCase();
        return name.toLowerCase().includes(lowerSearch) || description.toLowerCase().includes(lowerSearch);
    };

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <section className="space-y-4">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">AI Providers</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure your AI providers, local models, and authentication keys</p>
                </div>
                
                <p className="text-2xs text-gray-400 dark:text-gray-500 italic">Click any provider to expand and configure it. Configured providers show a green "Active" badge.</p>

                <div className="grid grid-cols-1 gap-3">
                    {/* 1. Ollama (Local) — highest priority */}
                    {filterCard('Ollama Local', 'local instance') && (
                        <ProviderCard
                            id="ollama"
                            title="Ollama (Local)"
                            icon={<Zap className="w-4 h-4" />}
                            configured={isConfigured('ollama')}
                            status={localModels.ollama?.installed ? 'active' : 'none'}
                            expanded={!!expandedSections.ollama}
                            onToggle={() => toggleSection('ollama')}
                        >
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50/50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-tight">Ollama Status</div>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${localModels.ollama?.installed ? 'animate-pulse bg-green-500' : 'bg-gray-400'}`} />
                                            <span className="text-sm font-medium">{localModels.ollama?.installed ? 'Running Local Instance' : 'Not Detected'}</span>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={onRefreshOllamaKeys} className="h-8">
                                        <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                                        Refresh
                                    </Button>
                                </div>
                                {localModels.ollama?.installed && (
                                    <div className="space-y-2">
                                        <Label className="text-2xs text-gray-500 uppercase font-bold">Ollama Model</Label>
                                        <Select 
                                          value={settings.ollama?.model || ''} 
                                          onValueChange={(v) => setSettings(prev => ({ ...prev, ollama: { ...prev.ollama!, model: v } }))}
                                        >
                                          <SelectTrigger className="h-9">
                                            <SelectValue placeholder="Select a model" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {ollamaModelsList.map(m => (
                                              <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        </ProviderCard>
                    )}

                    {/* 2. Claude Code */}
                    {filterCard('Claude Code', 'CLI') && (
                        <ProviderCard
                            id="claudeCode"
                            title="Claude Code"
                            icon={<Cpu className="w-4 h-4" />}
                            configured={isConfigured('claudeCode')}
                            status={localModels.claudeCode?.authenticated ? 'active' : localModels.claudeCode?.installed ? 'detected' : 'none'}
                            expanded={!!expandedSections.claudeCode}
                            onToggle={() => toggleSection('claudeCode')}
                        >
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-tight">CLI Authentication</div>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${localModels.claudeCode?.authenticated ? 'bg-green-500' : 'bg-gray-400'}`} />
                                            <span className="text-sm font-medium">{localModels.claudeCode?.authenticated ? 'Authenticated' : 'Not Authenticated'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!localModels.claudeCode?.authenticated && (
                                            <Button 
                                                variant="default" 
                                                size="sm" 
                                                onClick={onAuthenticateClaude} 
                                                className="h-8" 
                                                disabled={isAuthenticating === 'claudecode' || !localModels.claudeCode?.installed}
                                            >
                                                {isAuthenticating === 'claudecode' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Terminal className="w-3.5 h-3.5 mr-2" />}
                                                Login
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={onRefreshAuthStatus} className="h-8 w-8">
                                            <RefreshCcw className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                {!localModels.claudeCode?.installed && (
                                    <p className="text-xs text-red-500 italic px-1">
                                        Claude Code is not detected. Install Claude Code CLI to use this provider.
                                    </p>
                                )}
                                {localModels.claudeCode?.installed && !localModels.claudeCode?.authenticated && (
                                    <p className="text-2xs text-gray-400 italic px-1">
                                        Click Login to open a terminal and run 'claude login'.
                                    </p>
                                )}
                            </div>
                        </ProviderCard>
                    )}

                    {/* 3. Google Gemini */}
                    {filterCard('Google Gemini', 'CLI') && (
                        <ProviderCard
                            id="geminiCli"
                            title="Google Gemini (CLI)"
                            icon={<Cpu className="w-4 h-4" />}
                            configured={isConfigured('geminiCli')}
                            status={googleAuthStatus?.connected || settings.geminiCli?.apiKeyEnvVar ? 'active' : localModels.gemini?.installed ? 'detected' : 'none'}
                            expanded={!!expandedSections.geminiCli}
                            onToggle={() => toggleSection('geminiCli')}
                        >
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tight">CLI Authentication</div>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${googleAuthStatus?.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                                            <span className="text-sm font-medium">{googleAuthStatus?.connected ? 'Authenticated' : 'Not Authenticated'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {googleAuthStatus?.connected ? (
                                            <Button variant="outline" size="sm" onClick={onLogoutGoogle} className="h-8">Logout</Button>
                                        ) : (
                                            <Button variant="default" size="sm" onClick={onAuthenticateGemini} className="h-8" disabled={isAuthenticating === 'gemini'}>
                                                {isAuthenticating === 'gemini' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Link2 className="w-3.5 h-3.5 mr-2" />}
                                                Login
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={onRefreshAuthStatus} className="h-8 w-8">
                                            <RefreshCcw className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-2xs text-gray-500 uppercase font-bold">API Key Environment Variable</Label>
                                    <Input
                                        value={settings.geminiCli?.apiKeyEnvVar || ''}
                                        onChange={(e) => setSettings(prev => ({ ...prev, geminiCli: { ...prev.geminiCli!, apiKeyEnvVar: e.target.value } }))}
                                        placeholder="GEMINI_API_KEY"
                                        className="h-9 font-mono"
                                    />
                                    <p className="text-2xs text-gray-400 italic">Set the environment variable name that contains your Gemini API key.</p>
                                </div>
                            </div>
                        </ProviderCard>
                    )}

                    {/* 4. OpenAI (Codex) */}
                    {filterCard('OpenAI Codex', 'CLI') && (
                        <ProviderCard
                            id="openAiCli"
                            title="OpenAI Codex (CLI)"
                            icon={<Cpu className="w-4 h-4" />}
                            configured={isConfigured('openAiCli')}
                            status={openAiAuthStatus?.connected || settings.openAiCli?.apiKeyEnvVar ? 'active' : localModels.openAiCli?.installed ? 'detected' : 'none'}
                            expanded={!!expandedSections.openAiCli}
                            onToggle={() => toggleSection('openAiCli')}
                        >
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30">
                                    <div className="space-y-0.5">
                                        <div className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-tight">CLI Authentication</div>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${openAiAuthStatus?.connected ? 'bg-green-500' : 'bg-gray-400'}`} />
                                            <span className="text-sm font-medium">{openAiAuthStatus?.connected ? 'Authenticated' : 'Not Authenticated'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {openAiAuthStatus?.connected ? (
                                            <Button variant="outline" size="sm" onClick={onLogoutOpenAi} className="h-8">Logout</Button>
                                        ) : (
                                            <Button variant="default" size="sm" onClick={onAuthenticateOpenAi} className="h-8" disabled={isAuthenticating === 'openai'}>
                                                {isAuthenticating === 'openai' ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Link2 className="w-3.5 h-3.5 mr-2" />}
                                                Login
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={onRefreshAuthStatus} className="h-8 w-8">
                                            <RefreshCcw className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-2xs text-gray-500 uppercase font-bold">API Key Environment Variable</Label>
                                    <Input
                                        value={settings.openAiCli?.apiKeyEnvVar || ''}
                                        onChange={(e) => setSettings(prev => ({ ...prev, openAiCli: { ...prev.openAiCli!, apiKeyEnvVar: e.target.value } }))}
                                        placeholder="OPENAI_API_KEY"
                                        className="h-9 font-mono"
                                    />
                                    <p className="text-2xs text-gray-400 italic">Set the environment variable name that contains your OpenAI API key.</p>
                                </div>
                            </div>
                        </ProviderCard>
                    )}

                    {/* 5. Cloud API (Hosted) */}
                    {filterCard('Cloud API Hosted', 'Anthropic Google Gemini OpenAI') && (
                        <ProviderCard
                            id="hosted"
                            title="Cloud API (Hosted)"
                            icon={<Server className="w-4 h-4" />}
                            configured={isConfigured('hostedApi')}
                            status={isConfigured('hostedApi') ? 'active' : 'none'}
                            expanded={!!expandedSections.hosted}
                            onToggle={() => toggleSection('hosted')}
                        >
                            <div className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label className="text-2xs text-gray-500 uppercase font-bold">Provider Token</Label>
                                    <div className="relative">
                                        <Input
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="Paste your API key here"
                                            className="pr-10 h-9"
                                        />
                                        <Key className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                                    </div>
                                    <p className="text-2xs text-gray-500 italic">Supports Anthropic, Google Gemini, and OpenAI keys.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-2xs text-gray-500 uppercase font-bold">Default Hosted Model</Label>
                                    <Input
                                        value={settings.hosted?.model || ''}
                                        onChange={(e) => setSettings(prev => ({ ...prev, hosted: { ...prev.hosted!, model: e.target.value } }))}
                                        placeholder="e.g. claude-3-5-sonnet-latest"
                                        className="h-9 font-mono"
                                    />
                                </div>
                            </div>
                        </ProviderCard>
                    )}

                    {/* 6. Custom Model CLIs */}
                    {filterCard('Custom Model CLIs', '') && (
                        <div className={`rounded-xl border-2 transition-all duration-200 overflow-hidden ${isConfigured('custom') ? 'border-primary/20 bg-primary/[0.02] dark:bg-primary/[0.04]' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'}`}>
                            <div
                                onClick={() => toggleSection('custom')}
                                className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isConfigured('custom') ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                                    <Terminal className="w-4 h-4" />
                                </div>
                                <span className="flex-1 text-left font-semibold text-sm text-gray-900 dark:text-gray-100">Custom Model CLIs</span>
                                {(settings.customClis?.length || 0) > 0 && (
                                    <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-bold">
                                        {settings.customClis?.length}
                                    </span>
                                )}
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 px-2 text-primary hover:bg-primary/10 ml-1"
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        onAddCustomCli({
                                            id: crypto.randomUUID(),
                                            name: 'New Custom CLI',
                                            command: '',
                                            isConfigured: false
                                        }); 
                                    }}
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    Add
                                </Button>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedSections.custom ? 'rotate-180' : ''}`} />
                            </div>
                            {expandedSections.custom && (
                                <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-gray-800">
                                    <div className="grid gap-3 pt-4">
                                        {settings.customClis?.map(cli => (
                                            <Card key={cli.id} className="border border-gray-100 dark:border-gray-800 overflow-hidden">
                                                <CardHeader className="p-3 bg-gray-50/50 dark:bg-gray-950/50">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <Input
                                                                value={cli.name}
                                                                onChange={(e) => onUpdateCustomCli(cli.id, 'name', e.target.value)}
                                                                className="h-7 text-xs font-bold border-none bg-transparent p-0 focus-visible:ring-0 shadow-none w-32"
                                                                placeholder="CLI Name"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {cli.isConfigured && <Check className="w-3 h-3 text-green-500" />}
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => onRemoveCustomCli(cli.id)}>
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-3 pt-0 grid gap-3">
                                                    <div className="grid gap-1.5">
                                                        <Label className="text-2xs text-gray-500">Executable Command</Label>
                                                        <Input
                                                            value={cli.command}
                                                            onChange={(e) => onUpdateCustomCli(cli.id, 'command', e.target.value)}
                                                            placeholder="e.g. ./my-model-cli"
                                                            className="h-8 text-xs font-mono"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="grid gap-1.5">
                                                            <Label className="text-2xs text-gray-500">API Key Env Var</Label>
                                                            <Input
                                                                value={cli.apiKeyEnvVar || ''}
                                                                onChange={(e) => onUpdateCustomCli(cli.id, 'apiKeyEnvVar', e.target.value)}
                                                                placeholder="e.g. CUSTOM_API_KEY"
                                                                className="h-8 text-xs"
                                                            />
                                                        </div>
                                                        <div className="grid gap-1.5">
                                                            <Label className="text-2xs text-gray-500">Secret Key</Label>
                                                            <Input
                                                                type="password"
                                                                value={customApiKeys[`CUSTOM_CLI_${cli.id}_KEY`] || ''}
                                                                onChange={(e) => {
                                                                    const secretId = `CUSTOM_CLI_${cli.id}_KEY`;
                                                                    setCustomApiKeys(prev => ({ ...prev, [secretId]: e.target.value }));
                                                                    onUpdateCustomCli(cli.id, 'apiKeySecretId', secretId);
                                                                }}
                                                                placeholder="Enter Key"
                                                                className="h-8 text-xs"
                                                            />
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        {(!settings.customClis || settings.customClis.length === 0) && (
                                            <div className="text-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
                                                <p className="text-2xs text-gray-400">No custom CLIs defined. Click "Add" to create one.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 7. LiteLLM Proxy / Gateway */}
                    {filterCard('LiteLLM Proxy Gateway', '') && (
                        <ProviderCard
                            id="liteLlm"
                            title="LiteLLM Proxy / Gateway"
                            icon={<Link2 className="w-4 h-4" />}
                            configured={isConfigured('liteLlm')}
                            status={isConfigured('liteLlm') ? 'active' : 'none'}
                            expanded={!!expandedSections.liteLlm}
                            onToggle={() => toggleSection('liteLlm')}
                        >
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="litellm-toggle" className="text-sm font-medium">Enable Proxy</Label>
                                    <Switch 
                                        id="litellm-toggle"
                                        checked={settings.liteLlm?.enabled} 
                                        onCheckedChange={(v) => setSettings(prev => ({ ...prev, liteLlm: { ...prev.liteLlm!, enabled: v } }))} 
                                    />
                                </div>
                                <div className="grid gap-4 opacity-[var(--enabled-opacity)]" style={{ '--enabled-opacity': settings.liteLlm?.enabled ? '1' : '0.5' } as any}>
                                    <div className="space-y-2">
                                        <Label className="text-2xs text-gray-500">Base URL</Label>
                                        <Input
                                            value={settings.liteLlm?.baseUrl || ''}
                                            onChange={(e) => setSettings(prev => ({ ...prev, liteLlm: { ...prev.liteLlm!, baseUrl: e.target.value } }))}
                                            placeholder="http://localhost:4000"
                                            disabled={!settings.liteLlm?.enabled}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-2xs text-gray-500">API Key (Optional)</Label>
                                        <Input
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="Proxy API Key"
                                            disabled={!settings.liteLlm?.enabled}
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="pt-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="w-full h-8" 
                                            onClick={() => onTestLiteLlm(settings.liteLlm?.baseUrl || '', apiKey)}
                                            disabled={litellmTesting || !settings.liteLlm?.enabled}
                                        >
                                            {litellmTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCcw className="w-3.5 h-3.5 mr-2" />}
                                            Test Connection
                                        </Button>
                                        {litellmTestResult && (
                                            <p className={`text-2xs mt-2 px-1 ${litellmTestResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                                                {litellmTestResult.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </ProviderCard>
                    )}
                </div>
            </section>
        </div>
    );
};

export default ProviderSettings;
