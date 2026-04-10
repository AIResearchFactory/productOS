// Cache-buster: v1.0.1
import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Cpu, Zap, Link2, Rocket, Info, Loader2, FileText
} from 'lucide-react';

import type { GlobalSettings, ProviderType, CustomCliConfig, GeminiInfo, 
  ClaudeCodeInfo, OllamaInfo, OpenAiCliInfo,LiteLlmConfig, OpenAiAuthStatus, 
  GoogleAuthStatus, UsageStatistics, Project
} from '@/api/tauri';
import { appApi } from '@/api/app';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_CHANNEL_SETTINGS, saveChannelSettings as saveToLocalStorage } from '@/lib/channelSettings';
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
                <div className="py-2" />
                <SettingsNavItem 
                    icon={Info} 
                    label="About" 
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
  );
}
