import React from 'react';
import { 
    Check, Loader2, Server, Zap, Cpu, Key, AlertTriangle, RefreshCcw, 
    Link2, Info, FolderOpen, ChevronDown, ChevronUp, Trash2, Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { 
    GlobalSettings, ProviderType, CustomCliConfig, GeminiInfo, 
    ClaudeCodeInfo, OllamaInfo, LiteLlmConfig, OpenAiAuthStatus, 
    GoogleAuthStatus 
} from '@/api/tauri';

interface ProviderSettingsProps {
    settings: GlobalSettings;
    setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
    apiKey: string;
    setApiKey: (v: string) => void;
    geminiApiKey: string;
    setGeminiApiKey: (v: string) => void;
    openAiApiKey: string;
    setOpenAiApiKey: (v: string) => void;
    customApiKeys: Record<string, string>;
    setCustomApiKeys: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    localModels: {
        ollama: OllamaInfo | null;
        claudeCode: ClaudeCodeInfo | null;
        gemini: GeminiInfo | null;
    };
    expandedSections: Record<string, boolean>;
    setExpandedSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    isAuthenticatingGemini: boolean;
    isAuthenticatingOpenAI: boolean;
    openAiAuthStatus: OpenAiAuthStatus | null;
    googleAuthStatus: GoogleAuthStatus | null;
    litellmTesting: boolean;
    litellmTestResult: { ok: boolean; message: string } | null;
    ollamaModelsList: string[];
    onAuthenticateGemini: () => void;
    onAuthenticateOpenAI: () => void;
    onRefreshOllamaKeys: () => void;
    onTestLiteLlm: () => void;
    onAddCustomCli: () => void;
    onRemoveCustomCli: (id: string) => void;
    onUpdateCustomCli: (id: string, field: keyof CustomCliConfig, value: any) => void;
    isConfigured: (provider: ProviderType, customId?: string) => boolean;
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({
    settings,
    setSettings,
    apiKey,
    setApiKey,
    geminiApiKey,
    setGeminiApiKey,
    openAiApiKey,
    setOpenAiApiKey,
    customApiKeys,
    setCustomApiKeys,
    localModels,
    expandedSections,
    setExpandedSections,
    isAuthenticatingGemini,
    isAuthenticatingOpenAI,
    openAiAuthStatus,
    googleAuthStatus,
    litellmTesting,
    litellmTestResult,
    ollamaModelsList,
    onAuthenticateGemini,
    onAuthenticateOpenAI,
    onRefreshOllamaKeys,
    onTestLiteLlm,
    onAddCustomCli,
    onRemoveCustomCli,
    onUpdateCustomCli,
    isConfigured
}) => {
    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <section className="space-y-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">AI Providers</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure your AI providers, local models, and authentication keys</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {/* Hosted API (Anthropic/Gemini) */}
                    <Card className={`border-2 transition-all ${isConfigured('hostedApi') ? 'border-primary/20' : 'border-gray-100'}`}>
                        <CardHeader className="p-4 cursor-pointer" onClick={() => toggleSection('hosted')}>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Server className={`w-4 h-4 ${isConfigured('hostedApi') ? 'text-primary' : 'text-gray-400'}`} />
                                Cloud API (Hosted)
                                {isConfigured('hostedApi') && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                                {!isConfigured('hostedApi') && <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${expandedSections.hosted ? 'rotate-180' : ''}`} />}
                            </CardTitle>
                        </CardHeader>
                        {expandedSections.hosted && (
                            <CardContent className="p-4 pt-0 space-y-4">
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
                            </CardContent>
                        )}
                    </Card>

                    {/* Ollama */}
                    <Card className={`border-2 transition-all ${isConfigured('ollama') ? 'border-primary/20' : 'border-gray-100'}`}>
                        <CardHeader className="p-4 cursor-pointer" onClick={() => toggleSection('ollama')}>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Zap className={`w-4 h-4 ${isConfigured('ollama') ? 'text-primary' : 'text-gray-400'}`} />
                                Ollama (Local)
                                {isConfigured('ollama') && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                                {!isConfigured('ollama') && <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${expandedSections.ollama ? 'rotate-180' : ''}`} />}
                            </CardTitle>
                        </CardHeader>
                        {expandedSections.ollama && (
                            <CardContent className="p-4 pt-0 space-y-4">
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
                            </CardContent>
                        )}
                    </Card>

                    {/* LiteLLM */}
                    <Card className={`border-2 transition-all ${isConfigured('liteLlm') ? 'border-primary/20' : 'border-gray-100'}`}>
                        <CardHeader className="p-4 cursor-pointer" onClick={() => toggleSection('liteLlm')}>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Link2 className={`w-4 h-4 ${isConfigured('liteLlm') ? 'text-primary' : 'text-gray-400'}`} />
                                LiteLLM Proxy / Gateway
                                {isConfigured('liteLlm') && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                                {!isConfigured('liteLlm') && <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${expandedSections.liteLlm ? 'rotate-180' : ''}`} />}
                            </CardTitle>
                        </CardHeader>
                        {expandedSections.liteLlm && (
                            <CardContent className="p-4 pt-0 space-y-4">
                                <div className="flex items-center justify-between mb-2">
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
                                        onClick={onTestLiteLlm}
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
                            </CardContent>
                        )}
                    </Card>

                    {/* Custom CLIs */}
                    <Card className={`border-2 transition-all ${isConfigured('custom') ? 'border-primary/20' : 'border-gray-100'}`}>
                        <CardHeader className="p-4 cursor-pointer" onClick={() => toggleSection('custom')}>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Cpu className={`w-4 h-4 ${isConfigured('custom') ? 'text-primary' : 'text-gray-400'}`} />
                                Custom Model CLIs
                                {isConfigured('custom') && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                                <div className="ml-auto flex items-center gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 px-2 text-primary hover:bg-primary/10"
                                    onClick={(e) => { e.stopPropagation(); onAddCustomCli(); }}
                                  >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    Add
                                  </Button>
                                  <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.custom ? 'rotate-180' : ''}`} />
                                </div>
                            </CardTitle>
                        </CardHeader>
                        {expandedSections.custom && (
                            <CardContent className="p-4 pt-0 space-y-4">
                                <div className="grid gap-3">
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
                                    <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-lg">
                                      <p className="text-2xs text-gray-400">No custom CLIs defined</p>
                                    </div>
                                  )}
                                </div>
                            </CardContent>
                        )}
                    </Card>
                </div>
            </section>
        </div>
    );
};
