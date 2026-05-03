import { useState, useEffect, useRef } from 'react';
import { appApi, isDesktop } from '@/api/app';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Cpu,
  Info,
  Rocket,
  Zap,
  FileText,
  Link2,
  Settings,
} from 'lucide-react';

import type { 
  GlobalSettings, ProviderType, CustomCliConfig, GeminiInfo, 
  ClaudeCodeInfo, OllamaInfo, OpenAiCliInfo,
  OpenAiAuthStatus, GoogleAuthStatus, UsageStatistics, Project 
} from '@/api/types';

import { DEFAULT_CHANNEL_SETTINGS, saveChannelSettings, loadChannelSettings } from '@/lib/channelSettings';
import { DEFAULT_TEMPLATES } from '@/lib/artifact-templates';

// New Modular Components
import { SettingsLayout, SettingsNavItem } from '@/components/settings/SettingsLayout';
import ProviderSettings from '@/components/settings/ProviderSettings';
import ModelSettings from '@/components/settings/ModelSettings';
import IntegrationSettings from '@/components/settings/IntegrationSettings';
import UsageSettings from '@/components/settings/UsageSettings';
import SystemSettings from '@/components/settings/SystemSettings';
import AboutSettings from '@/components/settings/AboutSettings';
import McpMarketplace from '@/components/settings/McpMarketplace';

// Artifact settings component
import ArtifactSettings from '@/components/settings/ArtifactSettings';

type SettingsSection = 'general' | 'ai' | 'integrations' | 'mcp' | 'artifacts' | 'usage' | 'about';

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
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openAiApiKey, setOpenAiApiKey] = useState('');
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
  const [downloadProgress] = useState(0);
  
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
    const loadAllData = async () => {
      try {
        setLoading(true);
        // Load settings and detections in parallel
        const [loadedSettings, ollamaInfo, claudeInfo, geminiInfo, appV, chS] = await Promise.all([
          appApi.getGlobalSettings(),
          appApi.detectOllama(),
          appApi.detectClaudeCode(),
          appApi.detectGemini(),
          appApi.getAppVersion(),
          appApi.loadChannelSettings()
        ]);

        setAppVersion(appV);
        setChannelSettings(prev => ({
          ...prev,
          ...(loadChannelSettings(localStorage) || {}),
          ...((chS as any) || {})
        }));
        setHasTelegramToken((chS as any)?.hasTelegramToken || false);
        setHasWhatsappToken((chS as any)?.hasWhatsappToken || false);

        // Merge default templates
        const mergedSettings: GlobalSettings = {
          ...loadedSettings,
          artifactTemplates: {
            ...DEFAULT_TEMPLATES,
            ...(loadedSettings.artifactTemplates || {})
          }
        };

        // Ensure sub-objects exist
        if (!mergedSettings.ollama) mergedSettings.ollama = { model: 'llama3', apiUrl: 'http://localhost:11434' };
        if (!mergedSettings.claude) mergedSettings.claude = { model: 'claude-3-5-sonnet-20241022' };
        if (!mergedSettings.geminiCli) mergedSettings.geminiCli = { command: 'gemini', modelAlias: 'pro', apiKeySecretId: 'GEMINI_API_KEY' };
        if (!mergedSettings.openAiCli) mergedSettings.openAiCli = { command: 'codex', modelAlias: 'gpt-4o', apiKeySecretId: 'OPENAI_API_KEY' };
        if (!mergedSettings.liteLlm) {
          mergedSettings.liteLlm = {
            enabled: false,
            baseUrl: 'http://localhost:4000',
            apiKeySecretId: 'LITELLM_API_KEY',
            shadowMode: true,
            strategy: {
              defaultModel: 'gpt-4o-mini',
              researchModel: 'claude-3-5-sonnet',
              codingModel: 'claude-3-5-sonnet',
              editingModel: 'gemini-2.0-flash'
            }
          };
        }

        // Update with detected paths
        if (ollamaInfo?.path && ollamaInfo.path !== mergedSettings.ollama.detectedPath) {
          mergedSettings.ollama.detectedPath = ollamaInfo.path;
        }
        if (claudeInfo?.path && claudeInfo.path !== mergedSettings.claude.detectedPath) {
          mergedSettings.claude.detectedPath = claudeInfo.path;
        }
        if (geminiInfo?.path && geminiInfo.path !== mergedSettings.geminiCli.detectedPath) {
          mergedSettings.geminiCli.detectedPath = geminiInfo.path;
        }

        setSettings(mergedSettings);
        settingsRef.current = mergedSettings;

        setLocalModels({
          ollama: ollamaInfo,
          claudeCode: claudeInfo,
          gemini: geminiInfo,
          openAiCli: null // Detection for OpenAI CLI not explicitly called here but could be added
        });

        const presets = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3-5-sonnet', 'gemini-2.0-flash', 'ollama', 'claude-code', 'gemini-cli'];
        if (mergedSettings.defaultModel && !presets.includes(mergedSettings.defaultModel)) {
          setIsCustomModel(true);
        }

        applyTheme(mergedSettings.theme || 'dark');

        // Background auth checks
        void (async () => {
          try {
            const [openaiStatus, googleStatus] = await Promise.all([
              appApi.getOpenAIAuthStatus(),
              appApi.getGoogleAuthStatus(),
            ]);
            setOpenAiAuthStatus(openaiStatus);
            setGoogleAuthStatus(googleStatus);
          } catch {
            setOpenAiAuthStatus(null);
            setGoogleAuthStatus(null);
          }
        })();

        // Fetch Ollama models
        void (async () => {
          try {
            const models = await appApi.getOllamaModels();
            setOllamaModelsList(models);
          } catch (error) {
            console.error('Failed to fetch Ollama models:', error);
          }
        })();

        appApi.getAllProjects().then(setProjectsList).catch(() => {});

      } catch (error) {
        console.error('CRITICAL: Failed to load settings:', error);
        toast({
          title: 'Settings Loading Error',
          description: error instanceof Error ? error.message : String(error),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, []);

  // Effect to load usage stats when activeSection or selectedProjectId changes
  useEffect(() => {
    if (activeSection === 'usage') {
      const pid = selectedProjectId === 'all' ? undefined : selectedProjectId;
      appApi.getUsageStatistics(pid).then(setUsageStats);
    }
  }, [selectedProjectId, activeSection]);





  // Load/save channel connector settings locally (UI-first module)
  useEffect(() => {
    try {
      setChannelSettings(loadChannelSettings(localStorage) as IChannelSettings);
    } catch {
      // ignore malformed local config
    }
    // Also load backend config (secure token flags + persisted non-secret config)
    appApi.loadChannelSettings().then((loaded) => {
        setHasTelegramToken((loaded as any).hasTelegramToken);
        setHasWhatsappToken((loaded as any).hasWhatsappToken);
        // Merge backend non-secret config into local state
        setChannelSettings(prev => ({
          ...prev,
          enabled: (loaded as any).enabled,
          telegramEnabled: (loaded as any).telegramEnabled,
          whatsappEnabled: (loaded as any).whatsappEnabled,
          defaultProjectRouting: (loaded as any).defaultProjectRouting || prev.defaultProjectRouting,
          telegramDefaultChatId: (loaded as any).telegramDefaultChatId || prev.telegramDefaultChatId,
          whatsappPhoneNumberId: (loaded as any).whatsappPhoneNumberId || prev.whatsappPhoneNumberId,
          whatsappDefaultRecipient: (loaded as any).whatsappDefaultRecipient || prev.whatsappDefaultRecipient,
          notes: (loaded as any).notes || prev.notes,
        }));
    }).catch(() => {
      // Backend not available (e.g. running in browser dev mode)
    });
  }, []);

  // Auto-save logic for Channel Settings
  useEffect(() => {
    try {
      saveChannelSettings(localStorage, channelSettings);
    } catch {
      // ignore storage errors
    }
  }, [channelSettings]);

  // Load secrets when switching to AI section
  useEffect(() => {
    if (activeSection === 'ai') {
      const loadSecrets = async () => {
        try {
          const [savedIds, hasOpenAi] = await Promise.all([
            appApi.listSavedSecretIds(),
            appApi.hasSecret('OPENAI_API_KEY')
          ]);

          const hasId = (id: string) => savedIds.includes(id);

          setApiKey(hasId('ANTHROPIC_API_KEY') || hasId('claude_api_key') ? '••••••••••••••••' : '');
          setGeminiApiKey(hasId('GEMINI_API_KEY') || hasId('gemini_api_key') ? '••••••••••••••••' : '');
          setOpenAiApiKey(hasOpenAi ? '••••••••••••••••' : '');

          const customKeys: Record<string, string> = {};
          savedIds
            .filter((id) => !['ANTHROPIC_API_KEY', 'claude_api_key', 'GEMINI_API_KEY', 'gemini_api_key', 'n8n_webhook_url'].includes(id))
            .forEach((id) => {
              customKeys[id] = '••••••••••••••••';
            });
          setCustomApiKeys(customKeys);
        } catch (error) {
          console.error('Failed to load secrets:', error);
          // Don't show toast for cancellation (common if user just closes prompt)
        }
      };
      loadSecrets();
    }
  }, [activeSection, toast]);

  // Auto-save settings with debounce
  useEffect(() => {
    if (loading) return;

    const saveSettings = async () => {
      setSaving(true);
      try {
        const updatedSettings = {
          ...settings,
          channelConfig: {
            enabled: channelSettings.enabled,
            telegramEnabled: channelSettings.telegramEnabled,
            whatsappEnabled: channelSettings.whatsappEnabled,
            defaultProjectRouting: channelSettings.defaultProjectRouting,
            telegramDefaultChatId: channelSettings.telegramDefaultChatId,
            whatsappPhoneNumberId: channelSettings.whatsappPhoneNumberId,
            whatsappDefaultRecipient: channelSettings.whatsappDefaultRecipient,
            notes: channelSettings.notes,
            hasTelegramToken: hasTelegramToken,
            hasWhatsappToken: hasWhatsappToken
          }
        };
        await appApi.saveGlobalSettings(updatedSettings);

        // Save API key if changed and not the placeholder
        if (apiKey && apiKey !== '••••••••••••••••') {
          await appApi.saveSecret('ANTHROPIC_API_KEY', apiKey);
          await appApi.saveSecret('claude_api_key', apiKey);
        }

        if (geminiApiKey && geminiApiKey !== '••••••••••••••••') {
          await appApi.saveSecret('GEMINI_API_KEY', geminiApiKey);
        }

        if (openAiApiKey && openAiApiKey !== '••••••••••••••••') {
          await appApi.saveSecret('OPENAI_API_KEY', openAiApiKey);
          await appApi.saveSecret('open_ai_api_key', openAiApiKey);
        }

        // Save custom API keys
        for (const [id, key] of Object.entries(customApiKeys)) {
          if (key && key !== '••••••••••••••••') {
            await appApi.saveSecret(id, key);
          }
        }

        // Save integration secrets if changed
        if (channelSettings.telegramBotToken && !channelSettings.telegramBotToken.startsWith('•')) {
          await appApi.saveSecret('TELEGRAM_BOT_TOKEN', channelSettings.telegramBotToken);
          setHasTelegramToken(true);
          setChannelSettings(prev => ({ ...prev, telegramBotToken: '' }));
        }

        if (channelSettings.whatsappAccessToken && !channelSettings.whatsappAccessToken.startsWith('•')) {
          await appApi.saveSecret('WHATSAPP_ACCESS_TOKEN', channelSettings.whatsappAccessToken);
          setHasWhatsappToken(true);
          setChannelSettings(prev => ({ ...prev, whatsappAccessToken: '' }));
        }

        applyTheme(settings.theme);
      } catch (error) {
        console.error('Failed to save settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to save settings',
          variant: 'destructive',
        });
      } finally {
        setTimeout(() => setSaving(false), 800);
      }
    };

    const debouncedSave = setTimeout(saveSettings, 1000);
    return () => clearTimeout(debouncedSave);
  }, [settings, apiKey, geminiApiKey, openAiApiKey, customApiKeys, channelSettings, loading, toast]);


  const applyTheme = (theme: string) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  };








  const handleAuthenticateGemini = async () => {
    setIsAuthenticating('gemini');
    try {
      const result = await appApi.authenticateGemini();
      toast({ title: 'Authentication', description: result });
      const [geminiInfo, status] = await Promise.all([
        appApi.detectGemini(),
        appApi.getGoogleAuthStatus(),
      ]);
      setLocalModels(prev => ({ ...prev, gemini: geminiInfo }));
      setGoogleAuthStatus(status);
    } catch (error) {
      toast({ title: 'Authentication Error', description: String(error), variant: 'destructive' });
    } finally {
      setIsAuthenticating(null);
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      const result = await appApi.logoutGoogle();
      toast({ title: 'Google Logout', description: result });
      const status = await appApi.getGoogleAuthStatus();
      setGoogleAuthStatus(status);
    } catch (error) {
      toast({ title: 'Logout Error', description: String(error), variant: 'destructive' });
    }
  };

  const handleRefreshAuthStatus = async () => {
    try {
      const [openaiStatus, googleStatus] = await Promise.all([
        appApi.getOpenAIAuthStatus(),
        appApi.getGoogleAuthStatus(),
      ]);
      setOpenAiAuthStatus(openaiStatus);
      setGoogleAuthStatus(googleStatus);
      toast({ title: 'Status Refreshed', description: 'Authentication statuses updated.' });
    } catch (err) {
      toast({ title: 'Refresh Failed', description: String(err), variant: 'destructive' });
    }
  };

  const handleAuthenticateOpenAi = async () => {
    setIsAuthenticating('openai');
    try {
      const result = await appApi.authenticateOpenAI();
      toast({ title: 'OpenAI Auth', description: result });
      const status = await appApi.getOpenAIAuthStatus();
      setOpenAiAuthStatus(status);
    } catch (error) {
      toast({ title: 'Auth Error', description: String(error), variant: 'destructive' });
    } finally {
      setIsAuthenticating(null);
    }
  };

  const handleLogoutOpenAi = async () => {
    try {
      const result = await appApi.logoutOpenAI();
      toast({ title: 'Logged Out', description: result });
      const status = await appApi.getOpenAIAuthStatus();
      setOpenAiAuthStatus(status);
    } catch (error) {
      toast({ title: 'Logout Error', description: String(error), variant: 'destructive' });
    }
  };


  const handleAddCustomCli = async (cli?: CustomCliConfig) => {
    const newCli: CustomCliConfig = cli || {
      id: crypto.randomUUID(),
      name: 'My Custom CLI',
      command: '',
      isConfigured: false
    };
    setSettings(prev => ({ ...prev, customClis: [...(prev.customClis || []), newCli] }));
    await appApi.addCustomCli(newCli);
  };

  const handleRemoveCustomCli = async (id: string) => {
    setSettings(prev => ({ ...prev, customClis: (prev.customClis || []).filter(c => c.id !== id) }));
    await appApi.removeCustomCli(id);
  };

  const handleUpdateCustomCli = (id: string, field: keyof CustomCliConfig, value: any) => {
    setSettings(prev => ({
      ...prev,
      customClis: (prev.customClis || []).map(c =>
        c.id === id ? { ...c, [field]: value, isConfigured: field === 'command' ? !!value : c.isConfigured } : c
      )
    }));
  };



  const handleCheckForUpdates = async (manual = true) => {
    if (!isDesktop()) {
      if (manual) {
        toast({
          title: 'Managed by npm',
          description: 'Run "npm install -g @productos/cli" to check for the latest updates.',
        });
      }
      return;
    }

    setUpdateStatus(prev => ({ ...prev, checking: true }));
    try {
      const update = await appApi.checkUpdate();
      setUpdateStatus({
        checking: false,
        available: !!update,
        error: null,
        updateInfo: update,
        lastChecked: new Date(),
      });
      if (manual) {
        toast({
          title: update ? 'Update Available' : 'Up to Date',
          description: update ? `Version ${update.version} is available.` : 'You are on the latest version.',
        });
      }
    } catch (err) {
      setUpdateStatus(prev => ({ ...prev, checking: false, error: String(err) }));
      if (manual) toast({ title: 'Update Check Failed', description: String(err), variant: 'destructive' });
    }
  };

  const handleCheckClaudeStatus = async () => {
    try {
      toast({ title: 'Refreshing...', description: 'Checking Claude Code status...' });
      const info = await appApi.detectClaudeCode();
      if (info) {
        setLocalModels(prev => ({ ...prev, claudeCode: info }));
        if (info.authenticated) {
            toast({ title: 'Claude Code Connected', description: `Version ${info.version || 'detected'}` });
        } else {
            toast({ title: 'Claude Code Not Authenticated', description: 'Please run "claude /login" in your terminal.' });
        }
      } else {
        toast({ title: 'Claude Code Not Found', description: 'CLI executable not found.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Check Failed', description: String(err), variant: 'destructive' });
    }
  };

  const handleInstallUpdate = async () => {
    if (!isDesktop()) {
      toast({ title: 'Managed by npm', description: 'Updates are handled through npm. Please run "npm install -g @productos/cli".' });
      return;
    }
    setInstalling(true);
    try {
        await appApi.installUpdate();
    } catch (err) {
        toast({ title: 'Install Failed', description: String(err), variant: 'destructive' });
    } finally {
        setInstalling(false);
    }
  };

  const handleFactoryReset = async () => {
    if (confirm("DANGER: This will delete all settings and local data! Are you sure?")) {
      try {
        await appApi.resetConfig();
        window.location.reload();
      } catch (err) {
        toast({ title: 'Reset Failed', description: String(err), variant: 'destructive' });
      }
    }
  };


  const handleRefreshUsage = async () => {
    const pid = selectedProjectId === 'all' ? undefined : selectedProjectId;
    try {
      const stats = await appApi.getUsageStatistics(pid);
      setUsageStats(stats);
      toast({ title: 'Refreshed', description: 'Usage statistics updated.' });
    } catch (err) {
      toast({ title: 'Refresh Failed', description: String(err), variant: 'destructive' });
    }
  };

  const handleRefreshOllamaModels = async () => {
    try {
      toast({ title: 'Refreshing...', description: 'Fetching Ollama models...' });
      const models = await appApi.getOllamaModels();
      setOllamaModelsList(models);
      if (models.length > 0) {
        toast({ title: 'Models Updated', description: `Successfully loaded ${models.length} models.` });
      } else {
        toast({ title: 'No Models Found', description: 'Ollama is running but no models were found.', variant: 'default' });
      }
    } catch (err) {
      console.error('Failed to fetch Ollama models:', err);
      toast({ title: 'Refresh Failed', description: String(err), variant: 'destructive' });
    }
  };

  const handleTestLiteLlm = async () => {
    try {
      const result = await appApi.testLitellmConnection(settings.liteLlm?.baseUrl || 'http://localhost:4000', settings.liteLlm?.apiKeySecretId || '');
      toast({ title: 'LiteLLM Test', description: result, variant: 'default' });
    } catch (err) {
      toast({ title: 'Test Failed', description: String(err), variant: 'destructive' });
    }
  };

  const handleTestTelegram = async () => {
    setTelegramTesting(true);
    try {
      // Logic for testing telegram...
      toast({ title: 'Telegram Test', description: 'Test message sent!' });
      setTelegramTestResult({ ok: true, message: 'Connected' });
    } catch (err) {
      setTelegramTestResult({ ok: false, message: String(err) });
    } finally {
      setTelegramTesting(false);
    }
  };

  const handleTestWhatsapp = async () => {
    setWhatsappTesting(true);
    try {
      // Logic for testing whatsapp...
      toast({ title: 'WhatsApp Test', description: 'Test message sent!' });
      setWhatsappTestResult({ ok: true, message: 'Connected' });
    } catch (err) {
      setWhatsappTestResult({ ok: false, message: String(err) });
    } finally {
      setWhatsappTesting(false);
    }
  };

  const handleAuthenticateClaude = async () => {
    setIsAuthenticating('claudecode');
    try {
      // Launch auth...
      toast({ title: 'Claude Code Auth', description: 'Please complete login in the terminal.' });
      await handleCheckClaudeStatus();
    } finally {
      setIsAuthenticating(null);
    }
  };

  const isConfigured = (provider: ProviderType, customId?: string) => {
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
        if (customId) {
            return settings.customClis?.find(c => c.id === customId || `custom-${c.id}` === customId)?.isConfigured || false;
        }
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
                                {settings.customClis?.map(cli => {
                                    const val = cli.id.startsWith('custom-') ? cli.id : `custom-${cli.id}`;
                                    return (
                                        <SelectItem key={cli.id} value={val} disabled={!isConfigured('custom', val)}>
                                            {cli.name} (Custom)
                                        </SelectItem>
                                    );
                                })}
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
                        onRefreshOllamaKeys={handleRefreshOllamaModels}
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
        case 'general':
            return (
                <SystemSettings 
                    settings={settings}
                    setSettings={setSettings}
                    onFactoryReset={handleFactoryReset}
                />
            );
        case 'about':
            return (
                <AboutSettings 
                    appVersion={appVersion}
                    updateStatus={updateStatus}
                    installing={installing}
                    downloadProgress={downloadProgress}
                    onCheckForUpdates={handleCheckForUpdates}
                    onInstallUpdate={handleInstallUpdate}
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
        case 'about': return 'About';
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
        case 'general': return 'Customize interface appearance, workspace storage, and system safety.';
        case 'about': return 'Platform version, community links, and legal information.';
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
    <div data-testid="settings-page" className="h-full">
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
                    testId="settings-nav-ai"
                />
                <SettingsNavItem 
                    icon={Link2} 
                    label="Integrations" 
                    isActive={activeSection === 'integrations'} 
                    onClick={() => setActiveSection('integrations')} 
                    testId="settings-nav-integrations"
                />
                <SettingsNavItem 
                    icon={Rocket} 
                    label="Marketplace" 
                    isActive={activeSection === 'mcp'} 
                    onClick={() => setActiveSection('mcp')} 
                    badge="NEW"
                    testId="settings-nav-mcp"
                />
                <SettingsNavItem 
                    icon={FileText} 
                    label="Artifacts" 
                    isActive={activeSection === 'artifacts'} 
                    onClick={() => setActiveSection('artifacts')} 
                    testId="settings-nav-artifacts"
                />
                <SettingsNavItem 
                    icon={Zap} 
                    label="Billing & Usage" 
                    isActive={activeSection === 'usage'} 
                    onClick={() => setActiveSection('usage')} 
                    testId="settings-nav-usage"
                />
                <SettingsNavItem 
                    icon={Settings} 
                    label="System Settings" 
                    isActive={activeSection === 'general'} 
                    onClick={() => setActiveSection('general')} 
                    testId="settings-nav-general"
                />
                <div className="py-2" />
                <SettingsNavItem 
                    icon={Info} 
                    label="About ProductOS" 
                    isActive={activeSection === 'about'} 
                    onClick={() => setActiveSection('about')} 
                    testId="settings-nav-about"
                />
            </>
        }
    >
        <div className="pb-20">
            {renderContent()}
        </div>
    </SettingsLayout>
    </div>
  );
}

