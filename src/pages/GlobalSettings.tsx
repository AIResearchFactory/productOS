import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Layout, Cpu, Zap, Link2, Rocket, FileText, Info
} from 'lucide-react';

import type { GlobalSettings, ProviderType, CustomCliConfig, GeminiInfo, 
  ClaudeCodeInfo, OllamaInfo, LiteLlmConfig, OpenAiAuthStatus, 
  GoogleAuthStatus, UsageStatistics, Project 
} from '@/api/tauri';
import { appApi } from '@/api/app';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_CHANNEL_SETTINGS, loadChannelSettings, saveChannelSettings } from '@/lib/channelSettings';

// New Modular Components
import { SettingsLayout, SettingsNavItem } from '@/components/settings/SettingsLayout';
import { ProviderSettings } from '@/components/settings/ProviderSettings';
import { ModelSettings } from '@/components/settings/ModelSettings';
import { IntegrationSettings } from '@/components/settings/IntegrationSettings';
import { UsageSettings } from '@/components/settings/UsageSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import McpMarketplace from '@/components/settings/McpMarketplace';

type SettingsSection = 'general' | 'ai' | 'integrations' | 'mcp' | 'templates' | 'usage' | 'about';

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
  const [settings, setSettings] = useState<GlobalSettings>({} as GlobalSettings);
  const [apiKey, setApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [customApiKeys, setCustomApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localModels, setLocalModels] = useState<{
    ollama: OllamaInfo | null;
    claudeCode: ClaudeCodeInfo | null;
    gemini: GeminiInfo | null
  }>({ ollama: null, claudeCode: null, gemini: null });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hosted: true,
    ollama: false,
    claudeCode: false,
    geminiCli: false,
    openAiCli: false,
    liteLlm: false,
    custom: false
  });
  const [isAuthenticatingGemini, setIsAuthenticatingGemini] = useState(false);
  const [isAuthenticatingOpenAI, setIsAuthenticatingOpenAI] = useState(false);
  const [openAiAuthStatus, setOpenAiAuthStatus] = useState<OpenAiAuthStatus | null>(null);
  const [googleAuthStatus, setGoogleAuthStatus] = useState<GoogleAuthStatus | null>(null);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [ollamaModelsList, setOllamaModelsList] = useState<string[]>([]);
  const [appVersion, setAppVersion] = useState<string>('0.1.0');
  const [updateStatus, _setUpdateStatus] = useState<{
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
  const [installing, _setInstalling] = useState(false);
  const [downloadProgress, _setDownloadProgress] = useState(0);
  const [litellmTesting, _setLitellmTesting] = useState(false);
  const [litellmTestResult, _setLitellmTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState('roadmap');
  
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
        setLoading(true);
        const [gs, useS, projs, appV, chS] = await Promise.all([
          tauriApi.getGlobalSettings(),
          tauriApi.getUsageStats(selectedProjectId === 'all' ? undefined : selectedProjectId),
          tauriApi.getProjects(),
          tauriApi.getAppVersion(),
          loadChannelSettings()
        ]);
        
        setSettings(gs);
        setUsageStats(useS);
        setProjectsList(projs);
        setAppVersion(appV);
        setChannelSettings(chS as IChannelSettings);
        
        const [loadedSettings, ollamaInfo, claudeInfo, geminiInfo] = await Promise.all([
          appApi.getGlobalSettings(),
          appApi.detectOllama(),
          appApi.detectClaudeCode(),
          appApi.detectGemini()
        ]);

        setSettings(loadedSettings);

        // Secrets will be loaded when switching to AI section
        // Secrets generally loaded when switching to AI section


        // Check if current model is one of the presets
        const presets = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3-5-sonnet', 'gemini-2.0-flash', 'ollama', 'claude-code', 'gemini-cli'];
        if (loadedSettings.defaultModel && !presets.includes(loadedSettings.defaultModel)) {
          setIsCustomModel(true);
        }

        setLocalModels({
          ollama: ollamaInfo,
          claudeCode: claudeInfo,
          gemini: geminiInfo
        });

        // Do not block settings page loading on auth status probes.
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

        // Update settings with detected paths if they changed
        let updated = false;
        const newSettings = { ...loadedSettings };

        // Ensure sub-objects exist
        if (!newSettings.ollama) newSettings.ollama = { model: 'llama3', apiUrl: 'http://localhost:11434' };
        if (!newSettings.claude) newSettings.claude = { model: 'claude-3-5-sonnet-20241022' };
        if (!newSettings.geminiCli) newSettings.geminiCli = { command: 'gemini', modelAlias: 'pro', apiKeySecretId: 'GEMINI_API_KEY' };
        if (!newSettings.openAiCli) newSettings.openAiCli = { command: 'codex', modelAlias: 'gpt-4o', apiKeySecretId: 'OPENAI_API_KEY' };
        if (!newSettings.liteLlm) {
          newSettings.liteLlm = {
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

        if (ollamaInfo?.path && ollamaInfo.path !== newSettings.ollama.detectedPath) {
          newSettings.ollama = { ...newSettings.ollama, detectedPath: ollamaInfo.path };
          updated = true;
        }
        if (claudeInfo?.path && claudeInfo.path !== newSettings.claude.detectedPath) {
          newSettings.claude = { ...newSettings.claude, detectedPath: claudeInfo.path };
          updated = true;
        }
        if (geminiInfo?.path && geminiInfo.path !== newSettings.geminiCli.detectedPath) {
          newSettings.geminiCli = { ...newSettings.geminiCli, detectedPath: geminiInfo.path };
          updated = true;
        }

        if (updated) {
          setSettings(newSettings);
          await appApi.saveGlobalSettings(newSettings);
        }

        applyTheme(loadedSettings.theme || 'dark');
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

    const fetchOllamaModels = async () => {
      try {
        const models = await appApi.getOllamaModels();
        setOllamaModelsList(models);
      } catch (error) {
        console.error('Failed to fetch Ollama models:', error);
      }
    };

    loadSettings();
    fetchOllamaModels();

    // Load app version
    appApi.getAppVersion().then(setAppVersion);
    // Load projects for usage filter
    appApi.getAllProjects().then(setProjectsList);
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

  const openExternal = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

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

  const handleDataDirChange = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        if (handle) {
          setSettings(prev => ({
            ...prev,
            projectsPath: `/browser-runtime/${handle.name}`
          }));
          toast({
            title: 'Mock Directory Selected',
            description: `Data will be stored in virtual path: /browser-runtime/${handle.name}`,
          });
        }
      } catch (err) {
        console.log('User cancelled directory picker', err);
      }
    } else {
      toast({
        title: 'Not available in browser mode',
        description: 'Your browser does not support directory selection. Paths are simulated in local storage.',
      });
    }
  };

  const handleProviderChange = async (value: string) => {
    setSettings(prev => ({ ...prev, activeProvider: value as ProviderType }));

    if (value === 'openAiCli') {
      try {
        const status = await appApi.getOpenAIAuthStatus();
        setOpenAiAuthStatus(status);
        if (!status.connected) {
          toast({
            title: 'OpenAI not connected yet',
            description: 'Go to OpenAI (ChatGPT Login) and click Login / Refresh Session, or set OPENAI_API_KEY.',
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'OpenAI status check failed',
          description: 'Please authenticate in OpenAI (ChatGPT Login) settings before sending messages.',
          variant: 'destructive',
        });
      }
    }

    if (value === 'geminiCli') {
      try {
        const status = await appApi.getGoogleAuthStatus();
        setGoogleAuthStatus(status);
        if (!status.connected) {
          toast({
            title: 'Google not connected yet',
            description: 'Open Google (Antigravity Login) and click Login / Change Method, or set GEMINI_API_KEY.',
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'Google status check failed',
          description: 'Please authenticate in Google (Antigravity Login) settings before sending messages.',
          variant: 'destructive',
        });
      }
    }
  };

  const getLiteLlmMode = (): 'off' | 'silent' | 'active' => {
    if (!settings.liteLlm?.enabled) return 'off';
    if (settings.liteLlm?.shadowMode) return 'silent';
    return 'active';
  };

  const LITELLM_DEFAULTS: LiteLlmConfig = {
    enabled: false,
    baseUrl: 'http://localhost:4000',
    apiKeySecretId: 'LITELLM_API_KEY',
    shadowMode: true,
    strategy: {
      defaultModel: 'gpt-4.1-mini',
      researchModel: 'claude-sonnet-4-20250514',
      codingModel: 'claude-sonnet-4-20250514',
      editingModel: 'gemini-2.5-flash',
    },
  };

  const handleLiteLlmModeChange = (mode: 'off' | 'silent' | 'active') => {
    setSettings(prev => {
      const wasOff = !prev.liteLlm?.enabled;
      // When turning on for the first time, auto-populate strategy with modern defaults
      const strategy = (wasOff && mode !== 'off')
        ? LITELLM_DEFAULTS.strategy
        : (prev.liteLlm?.strategy || LITELLM_DEFAULTS.strategy);

      const next = {
        ...prev,
        liteLlm: {
          ...(prev.liteLlm || LITELLM_DEFAULTS),
          enabled: mode !== 'off',
          shadowMode: mode === 'silent',
          strategy,
        }
      } as GlobalSettings;

      if (mode === 'active') next.activeProvider = 'liteLlm';
      if (mode === 'off' && prev.activeProvider === 'liteLlm') next.activeProvider = 'hostedApi';

      return next;
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleAuthenticateGemini = async () => {
    setIsAuthenticatingGemini(true);
    try {
      const result = await appApi.authenticateGemini();
      toast({
        title: 'Authentication',
        description: result,
      });
      // Refresh gemini info + auth status
      const [geminiInfo, status] = await Promise.all([
        appApi.detectGemini(),
        appApi.getGoogleAuthStatus(),
      ]);
      setLocalModels(prev => ({ ...prev, gemini: geminiInfo }));
      setGoogleAuthStatus(status);
    } catch (error) {
      toast({
        title: 'Authentication Error',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
        setTelegramTesting(false);
    }
  };

  const handleLogoutGoogle = async () => {

    try {
      const result = await appApi.logoutGoogle();
      toast({ title: 'Google Logout', description: result });
      const status = await appApi.getGoogleAuthStatus();
      setGoogleAuthStatus(status);
    } catch (error) {
      toast({
        title: 'Google Logout Error',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleTestGoogleAuth = async () => {

    try {
      const status = await appApi.getGoogleAuthStatus();
      setGoogleAuthStatus(status);
      toast({
        title: 'Google Status Check',
        description: status.connected ? 'Connected' : status.details,
        variant: status.connected ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({
        title: 'Google Status Check Error',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleAuthenticateOpenAI = async () => {
    setIsAuthenticatingOpenAI(true);
    try {
      const result = await appApi.authenticateOpenAI();
      toast({
        title: 'OpenAI Authentication',
        description: result,
      });
      const status = await appApi.getOpenAIAuthStatus();
      setOpenAiAuthStatus(status);
    } catch (error) {
      toast({
        title: 'OpenAI Authentication Error',
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticatingOpenAI(false);
    }
  };

  const handleLogoutOpenAI = async () => {

    try {
      const result = await appApi.logoutOpenAI();
      toast({ title: 'OpenAI Logout', description: result });
      const status = await appApi.getOpenAIAuthStatus();
      setOpenAiAuthStatus(status);
    } catch (error) {
      toast({
        title: 'OpenAI Logout Error',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleTestOpenAIAuth = async () => {

    try {
      const status = await appApi.getOpenAIAuthStatus();
      setOpenAiAuthStatus(status);
      toast({
        title: 'OpenAI Status Check',
        description: status.connected ? 'Connected' : status.details,
        variant: status.connected ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({
        title: 'OpenAI Status Check Error',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  const handleRedetect = async () => {
    setLoading(true);
    try {
      await appApi.clearAllCliDetectionCaches();
      const [ollamaInfo, claudeInfo, geminiInfo] = await Promise.all([
        appApi.detectOllama(),
        appApi.detectClaudeCode(),
        appApi.detectGemini()
      ]);

      setLocalModels({
        ollama: ollamaInfo,
        claudeCode: claudeInfo,
        gemini: geminiInfo
      });

      toast({
        title: 'Environment Scanned',
        description: 'Updated detection of local models'
      });
    } catch (e) {
        setWhatsappTestResult({ ok: false, message: String(e) });
    } finally {
      setLoading(false);
    }
  }

  const handleAddCustomCli = async () => {
    const newCli: CustomCliConfig = {
      id: crypto.randomUUID(),
      name: 'My Custom CLI',
      command: '',
      isConfigured: false
    };
    const updatedClis = [...(settings.customClis || []), newCli];
    setSettings(prev => ({ ...prev, customClis: updatedClis }));
    await appApi.addCustomCli(newCli);
  };

  const handleRemoveCustomCli = async (id: string) => {
    const updatedClis = (settings.customClis || []).filter(c => c.id !== id);
    setSettings(prev => ({ ...prev, customClis: updatedClis }));
    await appApi.removeCustomCli(id);
  };

  const handleUpdateCustomCli = (id: string, field: keyof CustomCliConfig, value: any) => {
    const updatedClis = (settings.customClis || []).map(c =>
      c.id === id ? { ...c, [field]: value, isConfigured: field === 'command' ? !!value : c.isConfigured } : c
    );
    setSettings(prev => ({ ...prev, customClis: updatedClis }));
  };

  const handleThemeChange = (value: string) => {
    setSettings(prev => ({ ...prev, theme: value }));
    applyTheme(value);
  }

  const handleModelChange = (value: string) => {
    const isOllamaModel = ollamaModelsList.includes(value);
    const isClaudeCode = value === 'claude-code';
    const isGeminiCli = value === 'gemini-cli' || value === 'auto-gemini-2.5' || value.startsWith('gemini-');
    const isHosted = !isOllamaModel && !isClaudeCode && !isGeminiCli;

    setSettings(prev => {
      let newSettings = { ...prev, defaultModel: value };

      if (isOllamaModel) {
        newSettings.activeProvider = 'ollama';
        newSettings.ollama = { ...prev.ollama, model: value };
      } else if (isClaudeCode) {
        newSettings.activeProvider = 'claudeCode';
      } else if (isGeminiCli) {
        newSettings.activeProvider = 'geminiCli';
        // If it's a specific Gemini model id (not the provider name itself), set it as the alias
        if (value.startsWith('gemini-') && value !== 'gemini-cli') {
          newSettings.geminiCli = { ...prev.geminiCli, modelAlias: value };
        }
      } else if (isHosted) {
        newSettings.activeProvider = 'hostedApi';
        newSettings.hosted = { ...prev.hosted, model: value };
      }

      return newSettings;
    });
  };

  const handleCheckUpdate = async (manual = true) => {
    if (manual) {
      toast({
        title: 'Not available in browser',
        description: 'Please refresh the page to check for new web updates.',
      });
    }
  };

  const handleCheckClaudeStatus = async () => {
    try {
      toast({
        title: 'Refreshing browser runtime...',
        description: 'Refreshing runtime provider info...'
      });
      const info = await appApi.detectClaudeCode();
      if (info) {
        setLocalModels(prev => ({ ...prev, claudeCode: info }));
        if (info.authenticated) {
          toast({ title: 'Claude Code CLI Connected', description: `Version ${info.version || 'detected'} - Authenticated` });
        } else {
          toast({
            title: 'Claude Code CLI Not Connected',
            description: 'Please run "claude /login" in your terminal to authenticate.',
          });
        }
      } else {
        toast({ title: 'Claude Code Not Found', description: 'CLI executable could not be located.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Failed to check Claude status:', err);
      toast({ title: 'Check Failed', description: 'Failed to communicate with Claude Code CLI.', variant: 'destructive' });
    }
  };

  const handleInstallUpdate = async () => {
    toast({
      title: 'Not available in browser',
      description: 'Application updates are not supported in browser mode. Please refresh the page instead.',
    });
  };

  const handleFactoryReset = async () => {
    if (confirm("DANGER: This will delete everything! Are you sure?")) {
        await tauriApi.factoryReset();
        window.location.reload();
    }
  };

  const isConfigured = (provider: ProviderType, customId?: string) => {
    // Basic logic for indicator dots
    if (provider === 'hostedApi') return !!settings.hosted?.model;
    if (provider === 'ollama') return !!localModels.ollama?.installed;
    if (provider === 'liteLlm') return !!settings.liteLlm?.enabled;
    return false;
  };

  const renderContent = () => {
    switch (activeSection) {
        case 'ai':
            return (
                <div className="space-y-12">
                    <ProviderSettings 
                        settings={settings}
                        setSettings={setSettings}
                        apiKey={apiKey}
                        setApiKey={setApiKey}
                        geminiApiKey={geminiApiKey}
                        setGeminiApiKey={setGeminiApiKey}
                        openAiApiKey={openAiApiKey}
                        setOpenAiApiKey={setOpenAiApiKey}
                        customApiKeys={customApiKeys}
                        setCustomApiKeys={setCustomApiKeys}
                        localModels={localModels}
                        expandedSections={expandedSections}
                        setExpandedSections={setExpandedSections}
                        isAuthenticatingGemini={isAuthenticatingGemini}
                        isAuthenticatingOpenAI={isAuthenticatingOpenAI}
                        openAiAuthStatus={openAiAuthStatus}
                        googleAuthStatus={googleAuthStatus}
                        litellmTesting={litellmTesting}
                        litellmTestResult={litellmTestResult}
                        ollamaModelsList={ollamaModelsList}
                        onAuthenticateGemini={() => {}}
                        onAuthenticateOpenAI={() => {}}
                        onRefreshOllamaKeys={() => {}}
                        onTestLiteLlm={() => {}}
                        onAddCustomCli={() => {}}
                        onRemoveCustomCli={() => {}}
                        onUpdateCustomCli={() => {}}
                        isConfigured={isConfigured}
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
        case 'ai': return 'AI & Providers';
        case 'integrations': return 'Integrations';
        case 'mcp': return 'MCP Tools Marketplace';
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
        case 'usage': return 'Track your AI costs, token usage, and efficiency metrics.';
        case 'general': return 'Application updates, versioning, and system maintenance.';
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
                    icon={Zap} 
                    label="Billing & Usage" 
                    isActive={activeSection === 'usage'} 
                    onClick={() => setActiveSection('usage')} 
                />
                <div className="py-2" />
                <SettingsNavItem 
                    icon={Layout} 
                    label="System" 
                    isActive={activeSection === 'general'} 
                    onClick={() => setActiveSection('general')} 
                />
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
            
            {/* Simple Save Footer for persistent sections */}
            {['ai', 'integrations'].includes(activeSection) && (
                 <div className="fixed bottom-0 right-0 left-64 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-t border-gray-100 dark:border-gray-900 p-4 flex items-center justify-end px-12 z-10">
                    <Button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="min-w-[120px]"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                        Save Changes
                    </Button>
                 </div>
            )}
        </div>
    </SettingsLayout>
  );
}

// Internal Helper
const Check = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
);
