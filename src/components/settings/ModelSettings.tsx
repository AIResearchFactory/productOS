import React from 'react';
import { Cpu, ShieldCheck, Zap, AlertCircle, Lock, Radio } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlobalSettings, ModelRouterConfig, ModelRouterMode, ModelRouterFallback, ProviderType } from '@/api/contracts';

interface ModelSettingsProps {
    settings: GlobalSettings;
    setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
    isCustomModel: boolean;
    setIsCustomModel: (v: boolean) => void;
}

const DEFAULT_ROUTER_CONFIG: ModelRouterConfig = {
    enabled: true,
    mode: 'auto',
    localProvider: 'ollama',
    cloudProvider: 'hostedApi',
    fallback: 'cloudRedacted',
    localTimeoutMs: 3000,
    backgroundTimeoutMs: 15000,
    defaultPrivacyLevel: 'workspace-private',
    logDecisions: true,
};

const MODE_DESCRIPTIONS: Record<ModelRouterMode, { label: string; description: string; icon: React.ReactNode }> = {
    auto: {
        label: 'Auto (Intelligent Routing)',
        description: 'Automatically balances speed, privacy, and quality. Uses local model for workspace data and cloud model for general queries.',
        icon: <Cpu className="w-4 h-4 text-primary" />,
    },
    privacyFirst: {
        label: 'Privacy First',
        description: 'Prefers local models for all workspace queries. Only uses cloud fallback if configured and explicitly allowed.',
        icon: <Lock className="w-4 h-4 text-green-500" />,
    },
    performanceFirst: {
        label: 'Performance First',
        description: 'Prefers high-performance cloud models for non-sensitive tasks for maximum response quality and speed.',
        icon: <Zap className="w-4 h-4 text-amber-500" />,
    },
    localOnly: {
        label: 'Local Only (Offline)',
        description: 'Strictly routes all requests to local provider (e.g. Ollama). Data never leaves your machine.',
        icon: <ShieldCheck className="w-4 h-4 text-blue-500" />,
    },
    cloudOnly: {
        label: 'Cloud Only',
        description: 'Strictly routes all requests to configured cloud provider. Fails if cloud provider is unreachable.',
        icon: <Radio className="w-4 h-4 text-purple-500" />,
    },
};

const FALLBACK_DESCRIPTIONS: Record<ModelRouterFallback, { label: string; description: string; badge?: string }> = {
    cloudRedacted: {
        label: 'Redacted Cloud Fallback (Recommended)',
        description: 'If the preferred model is unavailable, fall back to cloud after automatically redacting API keys, secret tokens, and sensitive credentials.',
        badge: 'Recommended',
    },
    cloud: {
        label: 'Direct Cloud Fallback',
        description: 'If preferred model is unavailable, fall back directly to cloud provider without prompt redaction.',
    },
    askUser: {
        label: 'Require User Approval',
        description: 'If preferred model is unavailable, pause execution and require explicit user approval before falling back to cloud.',
    },
    local: {
        label: 'Local Model Fallback',
        description: 'If preferred cloud provider fails, fall back to local provider.',
    },
    none: {
        label: 'No Fallback (Fail Fast)',
        description: 'Do not attempt fallback if preferred model is unavailable. Fail immediately with error.',
    },
};

const ModelSettings: React.FC<ModelSettingsProps> = ({
    settings,
    setSettings,
    isCustomModel,
    setIsCustomModel
}) => {
    const routerConfig: ModelRouterConfig = {
        ...DEFAULT_ROUTER_CONFIG,
        ...(settings.modelRouter || {})
    };

    const updateRouterConfig = (updates: Partial<ModelRouterConfig>) => {
        setSettings(prev => ({
            ...prev,
            modelRouter: {
                ...DEFAULT_ROUTER_CONFIG,
                ...(prev.modelRouter || {}),
                ...updates
            }
        }));
    };

    // Gather available local and cloud providers
    const customLocalClis = (settings.customClis || []).filter(c => c.isCloud === false);
    const customCloudClis = (settings.customClis || []).filter(c => c.isCloud !== false);

    const localProviders = [
        { value: 'ollama', label: 'Ollama (Local Server)' },
        ...customLocalClis.map(c => ({ value: c.id, label: `${c.name} (Custom Local)` }))
    ];

    const cloudProviders = [
        { value: 'hostedApi', label: 'Hosted API' },
        { value: 'claudeCode', label: 'Claude Code CLI' },
        { value: 'geminiCli', label: 'Google / Antigravity CLI' },
        { value: 'openAiCli', label: 'OpenAI / Codex CLI' },
        ...customCloudClis.map(c => ({ value: c.id, label: `${c.name} (Custom Cloud)` }))
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <section className="space-y-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">Model Configuration</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure default model identifiers and automated model routing behavior</p>
                </div>

                {/* Default Model Selection */}
                <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="default-model" className="text-sm font-medium">Default Model ID</Label>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Custom ID</span>
                            <Switch
                                checked={isCustomModel}
                                onCheckedChange={setIsCustomModel}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Input
                            id="default-model"
                            value={settings.defaultModel || ''}
                            onChange={(e) => setSettings(prev => ({ ...prev, defaultModel: e.target.value }))}
                            placeholder={isCustomModel ? "e.g. gpt-4-turbo" : "Select or type a model ID"}
                            className="font-mono text-sm"
                        />
                        <p className="text-2xs text-gray-500">
                            Enter exact model identifier. This ID is used across all research and workflow tasks.
                        </p>
                    </div>
                </div>

                {/* Model Routing Section */}
                <div className="space-y-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <Cpu className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Model Routing & Fallback</h4>
                                <p className="text-xs text-muted-foreground">Manage execution modes and preferred fallback actions when models fail or are unreachable</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-medium">
                                {routerConfig.enabled ? 'Enabled' : 'Disabled'}
                            </span>
                            <Switch
                                checked={routerConfig.enabled}
                                onCheckedChange={(enabled) => updateRouterConfig({ enabled })}
                            />
                        </div>
                    </div>

                    {/* Explanatory Banner */}
                    <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                            <p className="font-semibold text-blue-900 dark:text-blue-200">
                                How Model Routing Works
                            </p>
                            <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
                                Model Routing automatically handles situations where your preferred primary model is unavailable, rate-limited, timed out, or offline.
                                Configure your preferred routing policy and fallback action below so productOS can maintain continuous operation.
                            </p>
                        </div>
                    </div>

                    {routerConfig.enabled && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Routing Mode */}
                            <div className="space-y-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Routing Mode</Label>
                                <Select
                                    value={routerConfig.mode}
                                    onValueChange={(value: ModelRouterMode) => updateRouterConfig({ mode: value })}
                                >
                                    <SelectTrigger className="h-11 border-gray-200 dark:border-gray-800">
                                        <SelectValue placeholder="Select Routing Mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.keys(MODE_DESCRIPTIONS) as ModelRouterMode[]).map((modeKey) => (
                                            <SelectItem key={modeKey} value={modeKey}>
                                                <div className="flex items-center gap-2 py-0.5">
                                                    {MODE_DESCRIPTIONS[modeKey].icon}
                                                    <span className="font-medium">{MODE_DESCRIPTIONS[modeKey].label}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                    {MODE_DESCRIPTIONS[routerConfig.mode]?.description}
                                </p>
                            </div>

                            {/* Preferred Fallback Action */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        Fallback Action (When Preferred Model Unresponsive)
                                    </Label>
                                </div>
                                <Select
                                    value={routerConfig.fallback}
                                    onValueChange={(value: ModelRouterFallback) => updateRouterConfig({ fallback: value })}
                                >
                                    <SelectTrigger className="h-11 border-gray-200 dark:border-gray-800">
                                        <SelectValue placeholder="Select Fallback Action" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.keys(FALLBACK_DESCRIPTIONS) as ModelRouterFallback[]).map((fallbackKey) => (
                                            <SelectItem key={fallbackKey} value={fallbackKey}>
                                                <div className="flex items-center justify-between w-full gap-3 py-0.5">
                                                    <span className="font-medium">{FALLBACK_DESCRIPTIONS[fallbackKey].label}</span>
                                                    {FALLBACK_DESCRIPTIONS[fallbackKey].badge && (
                                                        <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
                                                            {FALLBACK_DESCRIPTIONS[fallbackKey].badge}
                                                        </span>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                                    {FALLBACK_DESCRIPTIONS[routerConfig.fallback]?.description}
                                </p>
                            </div>

                            {/* Preferred Providers */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="space-y-2 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30">
                                    <Label className="text-xs font-medium flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-green-500" />
                                        Preferred Local Provider
                                    </Label>
                                    <Select
                                        value={routerConfig.localProvider}
                                        onValueChange={(value: ProviderType) => updateRouterConfig({ localProvider: value })}
                                    >
                                        <SelectTrigger className="h-9 text-xs border-gray-200 dark:border-gray-800 bg-background">
                                            <SelectValue placeholder="Select Local Provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {localProviders.map(p => (
                                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-muted-foreground">Used for offline execution and private workspace operations.</p>
                                </div>

                                <div className="space-y-2 p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30">
                                    <Label className="text-xs font-medium flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                        Preferred Cloud Provider
                                    </Label>
                                    <Select
                                        value={routerConfig.cloudProvider}
                                        onValueChange={(value: ProviderType) => updateRouterConfig({ cloudProvider: value })}
                                    >
                                        <SelectTrigger className="h-9 text-xs border-gray-200 dark:border-gray-800 bg-background">
                                            <SelectValue placeholder="Select Cloud Provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {cloudProviders.map(p => (
                                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-muted-foreground">Used for cloud queries and fallback when local model fails.</p>
                                </div>
                            </div>

                            {/* Execution Timeout Settings */}
                            <div className="space-y-3 pt-2">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Execution Timeout Thresholds</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-2xs text-gray-500">Local Timeout (ms)</Label>
                                        <Input
                                            type="number"
                                            value={routerConfig.localTimeoutMs}
                                            onChange={(e) => updateRouterConfig({ localTimeoutMs: parseInt(e.target.value, 10) || 3000 })}
                                            className="h-8 text-xs font-mono"
                                            placeholder="3000"
                                        />
                                        <p className="text-[10px] text-gray-400">Time to wait for local model before triggering fallback.</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-2xs text-gray-500">Background Task Timeout (ms)</Label>
                                        <Input
                                            type="number"
                                            value={routerConfig.backgroundTimeoutMs}
                                            onChange={(e) => updateRouterConfig({ backgroundTimeoutMs: parseInt(e.target.value, 10) || 15000 })}
                                            className="h-8 text-xs font-mono"
                                            placeholder="15000"
                                        />
                                        <p className="text-[10px] text-gray-400">Timeout threshold for background enrichment and knowledge tasks.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default ModelSettings;
