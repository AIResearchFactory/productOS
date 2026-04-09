// Cache-buster: v1.0.1
import { useState, useEffect, useRef } from 'react';
import {
  Cpu, Zap, Link2, Rocket, Info, Loader2, FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_CHANNEL_SETTINGS } from '@/lib/channelSettings';
import { DEFAULT_TEMPLATES } from '@/lib/artifact-templates';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  tauriApi, 
  GlobalSettings, 
  ProviderType, 
  CustomCliConfig,
  GeminiInfo, 
  ClaudeCodeInfo, 
  OllamaInfo, 
  OpenAiCliInfo,
  UsageStatistics, 
  Project,
  OpenAiAuthStatus, 
  GoogleAuthStatus
} from '../api/tauri';

// New Modular Components
import { SettingsLayout, SettingsNavItem } from '@/components/settings/SettingsLayout';
import { ProviderSettings } from '@/components/settings/ProviderSettings';
import { ModelSettings } from '@/components/settings/ModelSettings';
import { IntegrationSettings } from '@/components/settings/IntegrationSettings';
import { UsageSettings } from '@/components/settings/UsageSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import McpMarketplace from '@/components/settings/McpMarketplace';

// Artifact settings component inline
import ArtifactSettings from '../components/settings/ArtifactSettings';

type SettingsSection = 'general' | 'ai' | 'integrations' | 'mcp' | 'templates' | 'artifacts' | 'usage' | 'about';

interface IChannelSettings {
  enabled: boolean;
  telegramEnabled: boolean;
  whatsappEnabled: boolean;
  defaultProjectRouting: string;
  telegramBotToken: string;
  telegramDefaultChatId: string;
  whatsappAccessToken: string;
  whatsappPhoneNumberId: string;
  whatsappDefaultRecipient: string;
  notes: string;
}

export default function GlobalSettingsPage({ initialSection }: { initialSection?: SettingsSection }) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection || 'ai');

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<GlobalSettings>({} as GlobalSettings);
  const settingsRef = useRef<GlobalSettings>({} as GlobalSettings);
  const [apiKey, setApiKey] = useState('');
  const [customApiKeys, setCustomApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [localModels, setLocalModels] = useState<{
    ollama: OllamaInfo | null;
    claudeCode: ClaudeCodeInfo | null;
    gemini: GeminiInfo | null;
    openAiCli: OpenAiCliInfo | null;
  }>({ ollama: null, claudeCode: null, gemini: null, openAiCli: null });
  const [openAiAuthStatus, setOpenAiAuthStatus] = useState<OpenAiAuthStatus | null>(null);
  const [googleAuthStatus, setGoogleAuthStatus] = useState<GoogleAuthStatus | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState<string | null>(null);

  // All providers start collapsed
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hosted: false,
    ollama: false,
    claudeCode: false,
    geminiCli: false,
    openAiCli: false,
    liteLlm: false,
    custom: false
  });
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [ollamaModelsList, setOllamaModelsList] = useState<string[]>([]);
  const [appVersion, setAppVersion] = useState<string>('0.1.0');
  const [updateStatus, setUpdateStatus] = useState<{
    checking: boolean;
    available: boolean;
    error: string | null;
    updateInfo: any | null;
    lastChecked: Date | null;
  }>({
    checking: false,
    available: false,
    error: null,
    updateInfo: null,
    lastChecked: null,
  });
  const [installing, setInstalling] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const [usageStats, setUsageStats] = useState<UsageStatistics | null>(null);
  const [channelSettings, setChannelSettings] = useState<IChannelSettings>(DEFAULT_CHANNEL_SETTINGS as IChannelSettings);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [whatsappTesting, setWhatsappTesting] = useState(false);
  const [whatsappTestResult, setWhatsappTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [hasTelegramToken, setHasTelegramToken] = useState(false);
  const [hasWhatsappToken, setHasWhatsappToken] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        // If we already have settings, don't show the full page loader
        if (Object.keys(settings).length === 0) {
          setLoading(true);
        }
        
        // Load core settings first to unblock the UI
        const [gs, appV, chS] = await Promise.all([
          tauriApi.getGlobalSettings(),
          tauriApi.getAppVersion(),
          tauriApi.loadChannelSettings()
        ]);
        
        // Merge default templates
        const mergedSettings: GlobalSettings = {
          ...gs,
          artifactTemplates: {
            ...DEFAULT_TEMPLATES,
            ...(gs.artifactTemplates || {})
          }
        };

        setSettings(mergedSettings);
        settingsRef.current = mergedSettings;
        setAppVersion(appV);
        setChannelSettings(chS as unknown as IChannelSettings);
        setHasTelegramToken((chS as any).hasTelegramToken || false);
        setHasWhatsappToken((chS as any).hasWhatsappToken || false);
        setApiKey(gs.hosted?.apiKeySecretId ? '••••••••' : ''); 
        
        // Unblock UI after core settings are loaded
        setLoading(false);

        // Load background data without blocking
        Promise.all([
          tauriApi.getUsageStatistics(selectedProjectId === 'all' ? undefined : selectedProjectId),
          tauriApi.getAllProjects(),
          tauriApi.getOpenAIAuthStatus(),
          tauriApi.getGoogleAuthStatus()
        ]).then(([useS, projs, oaStatus, gStatus]) => {
          setUsageStats(useS);
          setProjectsList(projs);
          setOpenAiAuthStatus(oaStatus);
          setGoogleAuthStatus(gStatus);
        }).catch(console.error);

        // Check local model availability separately
        Promise.all([
          tauriApi.detectClaudeCode(),
          tauriApi.detectOllama(),
          tauriApi.detectGemini(),
          tauriApi.detectOpenAiCli()
        ]).then(async ([claude, ollama, gemini, openAiCli]) => {
          setLocalModels({ ollama, claudeCode: claude, gemini, openAiCli });
          
          if (ollama?.installed) {
            const models = await tauriApi.getOllamaModels();
            setOllamaModelsList(models);
          }
        }).catch(console.error);

      } catch (e) {
        console.error("Failed to load settings", e);
        toast({ title: 'Error', description: 'Failed to load settings.', variant: 'destructive' });
        setLoading(false);
      }
    };
    loadData();
  }, [selectedProjectId]);

  
  // Implement missing handlers for Custom CLIs
  const handleAddCustomCli = (config: CustomCliConfig) => {
    setSettings(prev => ({
      ...prev,
      customClis: [...(prev.customClis || []), config]
    }));
  };

  const handleRemoveCustomCli = (id: string) => {
    setSettings(prev => ({
      ...prev,
      customClis: (prev.customClis || []).filter(c => c.id !== id)
    }));
  };

  const handleUpdateCustomCli = (id: string, field: keyof CustomCliConfig, value: any) => {
    setSettings(prev => ({
      ...prev,
      customClis: (prev.customClis || []).map(c => 
        c.id === id ? { ...c, [field]: value } : c
      )
    }));
  };

  const handleTestLiteLlm = async (baseUrl: string, apiKeySecretId: string) => {
    try {
      const result = await tauriApi.testLitellmConnection(baseUrl, apiKeySecretId);
      toast({ title: 'LiteLLM Test Success', description: result });
    } catch (e) {
      toast({ title: 'LiteLLM Test Failed', description: String(e), variant: 'destructive' });
    }
  };

  // Sync ref with settings for unmount save
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Handle unmount flush
  useEffect(() => {
    return () => {
      if (settingsRef.current && Object.keys(settingsRef.current).length > 0) {
        tauriApi.saveGlobalSettings(settingsRef.current).catch(() => {});
      }
    };
  }, []);

  // Improved Auto-save logic for Global Settings (settings object)
  useEffect(() => {
    if (loading || !settings || Object.keys(settings).length === 0) return;
    
    // Skip if settings are identical to what we loaded (avoids redundant save on mount)
    // Basic check for one key property (defaultModel) to see if it's different from default
    // Or just let it save once, but slightly longer debounce for the first one.

    const timer = setTimeout(async () => {
        setSaving(true);
        try {
          await tauriApi.saveGlobalSettings(settings);
          setTimeout(() => setSaving(false), 1000);
        } catch (err) {
          console.error('[GlobalSettings] Failed to auto-save settings:', err);
          setSaving(false);
        }
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [settings, loading]);

  // Auto-save logic for Channel Settings
  useEffect(() => {
    if (loading || !channelSettings || Object.keys(channelSettings).length === 0) return;
    
    const timer = setTimeout(() => {
        tauriApi.saveChannelSettings(channelSettings).catch(err => {
          console.error('[GlobalSettings] Failed to auto-save channel settings:', err);
        });
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [channelSettings, loading]);

  // Auto-save logic for API Keys (Secrets) - THIS WAS MISSING
  useEffect(() => {
    if (loading || !apiKey) return;
    
    const timer = setTimeout(() => {
        // Save the current cloud API key (assume ANTHROPIC_API_KEY for now based on UI usage)
        tauriApi.saveSecret('ANTHROPIC_API_KEY', apiKey).catch(err => {
          console.error('[GlobalSettings] Failed to auto-save API key:', err);
        });
    }, 2000); // Longer debounce for keys
    
    return () => clearTimeout(timer);
  }, [apiKey, loading]);

  // Auto-save logic for Custom API Keys - THIS WAS MISSING
  useEffect(() => {
    if (loading || Object.keys(customApiKeys).length === 0) return;
    
    const timer = setTimeout(() => {
      // Save all custom keys
      Object.entries(customApiKeys).forEach(([key, value]) => {
        tauriApi.saveSecret(key, value).catch(err => {
          console.error(`[GlobalSettings] Failed to auto-save custom key ${key}:`, err);
        });
      });
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [customApiKeys, loading]);



  const handleRefreshUsage = async () => {
    const stats = await tauriApi.getUsageStatistics(selectedProjectId === 'all' ? undefined : selectedProjectId);
    setUsageStats(stats);
  };

  const handleTestTelegram = async () => {
    setTelegramTesting(true);
    try {
        const token = channelSettings.telegramBotToken.includes('•') ? undefined : channelSettings.telegramBotToken;
        await tauriApi.testTelegramConnection(token);
        await tauriApi.sendTelegramMessage(token, channelSettings.telegramDefaultChatId, '✅ *productOS* test message!');
        setTelegramTestResult({ ok: true, message: 'Connected and message sent!' });
    } catch (e) {
        setTelegramTestResult({ ok: false, message: String(e) });
    } finally {
        setTelegramTesting(false);
    }
  };

  const handleTestWhatsapp = async () => {
    setWhatsappTesting(true);
    try {
        const token = channelSettings.whatsappAccessToken.includes('•') ? undefined : channelSettings.whatsappAccessToken;
        await tauriApi.testWhatsAppConnection(token, channelSettings.whatsappPhoneNumberId);
        await tauriApi.sendWhatsAppMessage(token, channelSettings.whatsappPhoneNumberId, channelSettings.whatsappDefaultRecipient, '✅ *productOS* test message!');
        setWhatsappTestResult({ ok: true, message: 'Connected and message sent!' });
    } catch (e) {
        setWhatsappTestResult({ ok: false, message: String(e) });
    } finally {
        setWhatsappTesting(false);
    }
  };

  const handleCheckForUpdates = async () => {
      setUpdateStatus(prev => ({ ...prev, checking: true }));
      try {
          const update = await tauriApi.checkUpdate();
          setUpdateStatus({
              checking: false,
              available: !!update,
              error: null,
              updateInfo: update,
              lastChecked: new Date()
          });
      } catch (e) {
          setUpdateStatus(prev => ({ ...prev, checking: false, error: String(e) }));
      }
  };

  const handleInstallUpdate = async () => {
      setInstalling(true);
      setDownloadProgress(50);
      try {
          await tauriApi.runUpdateProcess();
          setDownloadProgress(100);
      } catch (e) {
          setUpdateStatus(prev => ({ ...prev, error: String(e) }));
          setInstalling(false);
      }
  };

  const handleFactoryReset = async () => {
    if (confirm("DANGER: This will delete everything! Are you sure?")) {
        await tauriApi.resetConfig();
        window.location.reload();
    }
  };

  const handleAuthenticateOpenAi = async () => {
    setIsAuthenticating('openai');
    try {
        const msg = await tauriApi.authenticateOpenAI();
        toast({ title: 'Authentication Started', description: msg });
    } catch (e) {
        toast({ title: 'Auth Error', description: String(e), variant: 'destructive' });
    } finally {
        setIsAuthenticating(null);
    }
  };

  const handleLogoutOpenAi = async () => {
    try {
        await tauriApi.logoutOpenAI();
        const status = await tauriApi.getOpenAIAuthStatus();
        setOpenAiAuthStatus(status);
        toast({ title: 'Logged Out', description: 'OpenAI session ended locally.' });
    } catch (e) {
        toast({ title: 'Logout Error', description: String(e), variant: 'destructive' });
    }
  };

  const handleAuthenticateGemini = async () => {
    setIsAuthenticating('gemini');
    try {
        const msg = await tauriApi.authenticateGemini();
        toast({ title: 'Authentication Started', description: msg });
    } catch (e) {
        toast({ title: 'Auth Error', description: String(e), variant: 'destructive' });
    } finally {
        setIsAuthenticating(null);
    }
  };

  const handleLogoutGoogle = async () => {
    try {
        await tauriApi.logoutGoogle();
        const status = await tauriApi.getGoogleAuthStatus();
        setGoogleAuthStatus(status);
        toast({ title: 'Logged Out', description: 'Google session ended locally.' });
    } catch (e) {
        toast({ title: 'Logout Error', description: String(e), variant: 'destructive' });
    }
  };

  const handleAuthenticateClaude = async () => {
    setIsAuthenticating('claudecode');
    try {
        const msg = await tauriApi.authenticateClaude();
        toast({ title: 'Authentication Started', description: msg });
    } catch (e) {
        toast({ title: 'Auth Error', description: String(e), variant: 'destructive' });
    } finally {
        setIsAuthenticating(null);
    }
  };

  const handleRefreshAuthStatus = async () => {
    try {
        const [oaStatus, gStatus] = await Promise.all([
            tauriApi.getOpenAIAuthStatus(),
            tauriApi.getGoogleAuthStatus()
        ]);
        setOpenAiAuthStatus(oaStatus);
        setGoogleAuthStatus(gStatus);
        toast({ title: 'Status Refreshed', description: 'Authentication states updated.' });
    } catch (e) {
        toast({ title: 'Refresh Error', description: String(e), variant: 'destructive' });
    }
  };

  const isConfigured = (provider: ProviderType) => {
    if (provider === 'hostedApi') return !!settings.hosted?.model && !!settings.hosted?.apiKeySecretId;
    if (provider === 'ollama') return !!localModels.ollama?.installed;
    if (provider === 'liteLlm') return !!settings.liteLlm?.enabled && !!settings.liteLlm?.baseUrl;
    
    if (provider === 'openAiCli') {
        return !!openAiAuthStatus?.connected || (!!settings.openAiCli?.apiKeyEnvVar);
    }
    if (provider === 'geminiCli') {
        return !!googleAuthStatus?.connected || (!!settings.geminiCli?.apiKeyEnvVar);
    }
    if (provider === 'claudeCode') {
        return !!localModels.claudeCode?.installed && !!localModels.claudeCode?.authenticated;
    }
    
    if (provider === 'custom') {
        return (settings.customClis?.length || 0) > 0;
    }
    return false;
  };

  const renderContent = () => {
    switch (activeSection) {
        case 'ai':
            return (
                <div className="space-y-12">
                    <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                <Zap className="w-5 h-5 flex-shrink-0" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Primary AI Provider</h3>
                                <p className="text-xs text-gray-500">The default brain used for all research and writing tasks.</p>
                            </div>
                        </div>

                        <Select 
                            value={settings.activeProvider || ''} 
                            onValueChange={(v) => setSettings(prev => ({ ...prev, activeProvider: v as ProviderType }))}
                        >
                            <SelectTrigger className="w-full h-12 bg-white dark:bg-gray-900 border-primary/20 shadow-sm transition-all focus:ring-primary/30">
                                <SelectValue placeholder="Choose your primary brain..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="geminiCli" disabled={!isConfigured('geminiCli')}>Google Gemini (CLI)</SelectItem>
                                <SelectItem value="claudeCode" disabled={!isConfigured('claudeCode')}>Anthropic Claude (CLI)</SelectItem>
                                <SelectItem value="openAiCli" disabled={!isConfigured('openAiCli')}>OpenAI Codex (CLI)</SelectItem>
                                <SelectItem value="ollama" disabled={!isConfigured('ollama')}>Local Ollama (Llama 3)</SelectItem>
                                <SelectItem value="hostedApi" disabled={!isConfigured('hostedApi')}>Direct Anthropic (Cloud API)</SelectItem>
                                <SelectItem value="liteLlm" disabled={!isConfigured('liteLlm')}>LiteLLM Proxy</SelectItem>
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-2 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-primary/5">
                            <Info className="w-3.5 h-3.5 text-primary/60" />
                            <p className="text-[11px] text-gray-500 italic leading-snug">
                                {settings.activeProvider === 'ollama' 
                                    ? "Ollama is currently selected. Ensure the server is running on localhost:11434." 
                                    : "Individual providers can still be configured below regardless of the active selection."}
                            </p>
                        </div>
                    </div>

                    <ProviderSettings 
                        settings={settings}
                        setSettings={setSettings}
                        apiKey={apiKey}
                        setApiKey={setApiKey}
                        customApiKeys={customApiKeys}
                        setCustomApiKeys={setCustomApiKeys}
                        localModels={localModels}
                        expandedSections={expandedSections}
                        setExpandedSections={setExpandedSections}
                        litellmTesting={false}
                        litellmTestResult={null}
                        ollamaModelsList={ollamaModelsList}
                        onRefreshOllamaKeys={handleRefreshUsage}
                        onTestLiteLlm={handleTestLiteLlm}
                        onAddCustomCli={handleAddCustomCli}
                        onRemoveCustomCli={handleRemoveCustomCli}
                        onUpdateCustomCli={handleUpdateCustomCli}
                        isConfigured={isConfigured}
                        openAiAuthStatus={openAiAuthStatus}
                        googleAuthStatus={googleAuthStatus}
                        onAuthenticateOpenAi={handleAuthenticateOpenAi}
                        onLogoutOpenAi={handleLogoutOpenAi}
                        onAuthenticateGemini={handleAuthenticateGemini}
                        onLogoutGoogle={handleLogoutGoogle}
                        onAuthenticateClaude={handleAuthenticateClaude}
                        onRefreshAuthStatus={handleRefreshAuthStatus}
                        isAuthenticating={isAuthenticating}
                    />
                    <ModelSettings 
                        settings={settings}
                        setSettings={setSettings}
                        isCustomModel={isCustomModel}
                        setIsCustomModel={setIsCustomModel}
                    />
                </div>
            );
        case 'integrations':
            return (
                <IntegrationSettings 
                    channelSettings={channelSettings}
                    setChannelSettings={setChannelSettings}
                    hasTelegramToken={hasTelegramToken}
                    hasWhatsappToken={hasWhatsappToken}
                    onTestTelegram={handleTestTelegram}
                    onTestWhatsapp={handleTestWhatsapp}
                    telegramTesting={telegramTesting}
                    whatsappTesting={whatsappTesting}
                    telegramTestResult={telegramTestResult}
                    whatsappTestResult={whatsappTestResult}
                />
            );
        case 'mcp':
            return <McpMarketplace />;

        case 'artifacts':
            return (
                <ArtifactSettings 
                    settings={settings}
                    setSettings={setSettings}
                />
            );

        case 'usage':
            return (
                <UsageSettings 
                    usageStats={usageStats}
                    projectsList={projectsList}
                    selectedProjectId={selectedProjectId}
                    onProjectIdChange={setSelectedProjectId}
                    onRefresh={handleRefreshUsage}
                />
            );
        case 'about':
            return (
                <GeneralSettings 
                    appVersion={appVersion}
                    updateStatus={updateStatus}
                    installing={installing}
                    downloadProgress={downloadProgress}
                    onCheckForUpdates={handleCheckForUpdates}
                    onInstallUpdate={handleInstallUpdate}
                    onFactoryReset={handleFactoryReset}
                />
            );
        default:
            return <div className="p-8 text-center text-gray-400 italic">Select a category from the sidebar</div>;
    }
  };

  const getSectionTitle = () => {
    switch (activeSection) {
        case 'ai': return (
            <span className="flex items-center gap-3">
                AI & Models
                {saving && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/5 border border-primary/20 text-[10px] font-bold text-primary animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                        SAVING
                    </span>
                )}
            </span>
        );
        case 'integrations': return 'Integrations';
        case 'mcp': return 'MCP Tools Marketplace';
        case 'artifacts': return 'Artifact Templates';
        case 'usage': return 'Billing & Usage';
        case 'general': return 'System Settings';
        case 'about': return 'About productOS';
        default: return 'Settings';
    }
  };

  const getSectionDescription = () => {
    switch (activeSection) {
        case 'ai': return 'Manage LLM models, API keys, and local inference engines.';
        case 'integrations': return 'Connect to Telegram, WhatsApp and other external channels.';
        case 'mcp': return 'Install and manage Model Context Protocol tools.';
        case 'artifacts': return 'Configure default Markdown templates for each artifact type. Templates set here are the global defaults — projects can override them individually.';
        case 'usage': return 'Track your AI costs, token usage, and efficiency metrics.';
        case 'general': return 'Application updates, versioning, and system maintenance.';
        case 'about': return 'Application version, updates, and system information.';
        default: return '';
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full bg-white dark:bg-gray-950">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-gray-500">Initializing settings engine...</p>
            </div>
        </div>
    );
  }

  return (
    <SettingsLayout
        title={getSectionTitle()}
        description={getSectionDescription()}
        sidebar={
            <>
                <SettingsNavItem 
                    icon={Cpu} 
                    label="AI & Models" 
                    isActive={activeSection === 'ai'} 
                    onClick={() => setActiveSection('ai')} 
                />
                <SettingsNavItem 
                    icon={Link2} 
                    label="Integrations" 
                    isActive={activeSection === 'integrations'} 
                    onClick={() => setActiveSection('integrations')} 
                />
                <SettingsNavItem 
                    icon={Rocket} 
                    label="Marketplace" 
                    isActive={activeSection === 'mcp'} 
                    onClick={() => setActiveSection('mcp')} 
                    badge="NEW"
                />
                <SettingsNavItem 
                    icon={FileText} 
                    label="Artifacts" 
                    isActive={activeSection === 'artifacts'} 
                    onClick={() => setActiveSection('artifacts')} 
                />
                <SettingsNavItem 
                    icon={Zap} 
                    label="Billing & Usage" 
                    isActive={activeSection === 'usage'} 
                    onClick={() => setActiveSection('usage')} 
                />
                <div className="py-2" />
                <SettingsNavItem 
                    icon={Info} 
                    label="About" 
                    isActive={activeSection === 'about'} 
                    onClick={() => setActiveSection('about')} 
                />
            </>
        }
    >
        <div className="pb-20">
            {renderContent()}
        </div>
    </SettingsLayout>
  );
}
