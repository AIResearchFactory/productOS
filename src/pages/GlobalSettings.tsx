import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check, Loader2,
  FolderOpen, Layout, Cpu,
  ChevronDown, ChevronUp, Plus, Trash2, Key, Info,
  AlertTriangle,
  RefreshCcw,
  HelpCircle,
  Rocket,
  Server,
  Zap,
  FileText
} from 'lucide-react';
import { tauriApi, GlobalSettings, ProviderType, CustomCliConfig, GeminiInfo, ClaudeCodeInfo, OllamaInfo, LiteLlmConfig, OpenAiAuthStatus, GoogleAuthStatus, UsageStatistics } from '../api/tauri';
import { useToast } from '@/hooks/use-toast';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Logo from '@/components/ui/Logo';

import McpMarketplace from '@/components/settings/McpMarketplace';

type SettingsSection = 'general' | 'ai' | 'mcp' | 'templates' | 'usage' | 'about';

export default function GlobalSettingsPage({ initialSection }: { initialSection?: SettingsSection }) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection || 'general');
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
    hosted: false,
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
  const [appVersion, setAppVersion] = useState<string>('');
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
  const [litellmTesting, setLitellmTesting] = useState(false);
  const [litellmTestResult, setLitellmTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState('insight');

  const [totalCost, setTotalCost] = useState<number | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStatistics | null>(null);

  // Status check helper
  const isConfigured = (provider: ProviderType, customId?: string) => {
    switch (provider) {
      case 'hostedApi':
        return !!apiKey && !!settings.hosted?.model;
      case 'ollama':
        return !!localModels.ollama?.installed;
      case 'claudeCode':
        return !!localModels.claudeCode?.installed && !!localModels.claudeCode?.authenticated;
      case 'geminiCli':
        return !!localModels.gemini?.installed;
      case 'openAiCli':
        return !!settings.openAiCli?.command;
      case 'liteLlm':
        return !!settings.liteLlm?.enabled && !!settings.liteLlm?.baseUrl;
      case 'custom':
        const custom = settings.customClis?.find(c => c.id === customId);
        return custom?.isConfigured;
      default:
        return false;
    }
  };

  const { toast } = useToast();

  // Load initial settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [loadedSettings, ollamaInfo, claudeInfo, geminiInfo] = await Promise.all([
          tauriApi.getGlobalSettings(),
          tauriApi.detectOllama(),
          tauriApi.detectClaudeCode(),
          tauriApi.detectGemini()
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
              tauriApi.getOpenAIAuthStatus(),
              tauriApi.getGoogleAuthStatus(),
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
          await tauriApi.saveGlobalSettings(newSettings);
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
        const models = await tauriApi.getOllamaModels();
        setOllamaModelsList(models);
      } catch (error) {
        console.error('Failed to fetch Ollama models:', error);
      }
    };

    loadSettings();
    fetchOllamaModels();

    // Get app version
    tauriApi.getAppVersion().then(setAppVersion);

    // Listen for menu check update event
    let unlistenMenu: (() => void) | undefined;
    let unlistenOpenAiAuth: (() => void) | undefined;
    const setupMenuListener = async () => {
      unlistenMenu = await listen('menu:check-for-updates', () => {
        setActiveSection('about');
        handleCheckUpdate();
      });

      // Also listen for OpenAI auth updates (from PKCE flow)
      unlistenOpenAiAuth = await listen('openai-auth-updated', () => {
        handleTestOpenAIAuth();
      });
    };
    setupMenuListener();

    return () => {
      if (unlistenMenu) unlistenMenu();
      if (unlistenOpenAiAuth) unlistenOpenAiAuth();
    };
  }, [toast]);

  // Load secrets when switching to AI section
  useEffect(() => {
    if (activeSection === 'ai') {
      const loadSecrets = async () => {
        try {
          const [savedIds, hasOpenAi] = await Promise.all([
            tauriApi.listSavedSecretIds(),
            tauriApi.hasSecret('OPENAI_API_KEY')
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
    } else if (activeSection === 'usage') {
      const loadUsage = async () => {
        try {
          const stats = await tauriApi.getUsageStatistics();
          setUsageStats(stats);
          setTotalCost(stats.totalCostUsd);
        } catch (error) {
          console.error('Failed to load usage data:', error);
          setUsageStats(null);
          setTotalCost(0);
        }
      };

      loadUsage();
    }
  }, [activeSection]);

  // Auto-save settings with debounce
  useEffect(() => {
    if (loading) return;

    const saveSettings = async () => {
      setSaving(true);
      try {
        await tauriApi.saveGlobalSettings(settings);

        // Save API key if changed and not the placeholder
        if (apiKey && apiKey !== '••••••••••••••••') {
          await tauriApi.saveSecret('ANTHROPIC_API_KEY', apiKey);
          await tauriApi.saveSecret('claude_api_key', apiKey);
        }

        if (geminiApiKey && geminiApiKey !== '••••••••••••••••') {
          await tauriApi.saveSecret('GEMINI_API_KEY', geminiApiKey);
        }

        if (openAiApiKey && openAiApiKey !== '••••••••••••••••') {
          await tauriApi.saveSecret('OPENAI_API_KEY', openAiApiKey);
          await tauriApi.saveSecret('open_ai_api_key', openAiApiKey);
        }

        // Save custom API keys
        for (const [id, key] of Object.entries(customApiKeys)) {
          if (key && key !== '••••••••••••••••') {
            await tauriApi.saveSecret(id, key);
          }
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
  }, [settings, apiKey, geminiApiKey, openAiApiKey, customApiKeys, loading, toast]);

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
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Data Directory',
      });

      if (selected) {
        setSettings(prev => ({
          ...prev,
          projectsPath: selected as string
        }));
      }
    } catch (err) {
      console.error('Failed to pick directory:', err);
    }
  };

  const handleProviderChange = async (value: string) => {
    setSettings(prev => ({ ...prev, activeProvider: value as ProviderType }));

    if (value === 'openAiCli') {
      try {
        const status = await tauriApi.getOpenAIAuthStatus();
        setOpenAiAuthStatus(status);
        if (!status.connected) {
          toast({
            title: 'OpenAI not connected yet',
            description: 'Go to OpenAI (ChatGPT Login) and click Login / Refresh Session, or set OPENAI_API_KEY.',
            variant: 'destructive',
          });
        }
      } catch {
        // keep selection but show guidance
        toast({
          title: 'OpenAI status check failed',
          description: 'Please authenticate in OpenAI (ChatGPT Login) settings before sending messages.',
          variant: 'destructive',
        });
      }
    }

    if (value === 'geminiCli') {
      try {
        const status = await tauriApi.getGoogleAuthStatus();
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
      const result = await tauriApi.authenticateGemini();
      toast({
        title: 'Authentication',
        description: result,
      });
      // Refresh gemini info + auth status
      const [geminiInfo, status] = await Promise.all([
        tauriApi.detectGemini(),
        tauriApi.getGoogleAuthStatus(),
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
      setIsAuthenticatingGemini(false);
    }
  };

  const handleLogoutGoogle = async () => {
    try {
      const result = await tauriApi.logoutGoogle();
      toast({ title: 'Google Logout', description: result });
      const status = await tauriApi.getGoogleAuthStatus();
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
      const status = await tauriApi.getGoogleAuthStatus();
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
      const result = await tauriApi.authenticateOpenAI();
      toast({
        title: 'OpenAI Authentication',
        description: result,
      });
      const status = await tauriApi.getOpenAIAuthStatus();
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
      const result = await tauriApi.logoutOpenAI();
      toast({ title: 'OpenAI Logout', description: result });
      const status = await tauriApi.getOpenAIAuthStatus();
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
      const status = await tauriApi.getOpenAIAuthStatus();
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
      await tauriApi.clearAllCliDetectionCaches();
      const [ollamaInfo, claudeInfo, geminiInfo] = await Promise.all([
        tauriApi.detectOllama(),
        tauriApi.detectClaudeCode(),
        tauriApi.detectGemini()
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
      toast({
        title: 'Error',
        description: 'Failed to redetect environment',
        variant: 'destructive'
      });
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
    await tauriApi.addCustomCli(newCli);
  };

  const handleRemoveCustomCli = async (id: string) => {
    const updatedClis = (settings.customClis || []).filter(c => c.id !== id);
    setSettings(prev => ({ ...prev, customClis: updatedClis }));
    await tauriApi.removeCustomCli(id);
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
    setUpdateStatus(prev => ({ ...prev, checking: true, error: null }));
    try {
      const update = await tauriApi.checkUpdate();
      if (update) {
        setUpdateStatus({
          checking: false,
          available: true,
          error: null,
          updateInfo: update,
          lastChecked: new Date(),
        });
        if (manual) {
          toast({
            title: 'Update Available',
            description: `Version ${update.version} is now available.`,
          });
        }
      } else {
        setUpdateStatus({
          checking: false,
          available: false,
          error: null,
          updateInfo: null,
          lastChecked: new Date(),
        });
        if (manual) {
          toast({
            title: 'Up to Date',
            description: 'You are running the latest version of productOS.',
          });
        }
      }
    } catch (error) {
      console.error('Update check failed:', error);
      setUpdateStatus(prev => ({
        ...prev,
        checking: false,
        error: String(error),
        available: false
      }));
      if (manual) {
        toast({
          title: 'Update Check Failed',
          description: String(error),
          variant: 'destructive',
        });
      }
    }
  };

  const handleCheckClaudeStatus = async () => {
    try {
      toast({ title: 'Updating status...', description: 'Probing Claude Code CLI...' });
      const info = await tauriApi.detectClaudeCode();
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
    if (!updateStatus.updateInfo) return;

    setInstalling(true);
    setDownloadProgress(0);

    try {
      // In Tauri v2, we download and then install
      // Actually, downloadAndInstall() does both.
      // We can also subscribe to download progress if the plugin supports it.
      // For now, let's just run it.
      await updateStatus.updateInfo.downloadAndInstall((progress: any) => {
        if (progress.event === 'Started') {
          console.log('Update download started');
        } else if (progress.event === 'Progress') {
          const percent = (progress.data.chunkLength / progress.data.contentLength) * 100;
          setDownloadProgress(Math.round(percent));
        } else if (progress.event === 'Finished') {
          console.log('Update download finished');
        }
      });

      toast({
        title: 'Update Installed',
        description: 'The update has been installed. The application will now restart.',
      });

      // Restart is usually handled by the plugin or we can call process plugin
      // But downloadAndInstall in Tauri v2 doesn't always restart automatically depending on OS
      // Let's use relaunch if needed.
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (error) {
      console.error('Update installation failed:', error);
      toast({
        title: 'Update Failed',
        description: String(error),
        variant: 'destructive',
      });
      setInstalling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Settings Navigation Sidebar */}
      <div className="w-64 border-r border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/10 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-tight">Settings</h2>
          <p className="text-xs text-gray-500 mt-1 truncate">Global Configuration</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <button
              onClick={() => setActiveSection('general')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === 'general'
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
            >
              <Layout className="w-4 h-4" />
              General
            </button>
            <button
              onClick={() => setActiveSection('ai')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === 'ai'
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
            >
              <Cpu className="w-4 h-4" />
              AI & Models
            </button>
            <button
              onClick={() => setActiveSection('mcp')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === 'mcp'
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
            >
              <Server className="w-4 h-4" />
              MCP Servers
            </button>
            <button
              onClick={() => setActiveSection('templates')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === 'templates'
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
            >
              <FileText className="w-4 h-4" />
              Artifact Templates
            </button>
            <button
              onClick={() => setActiveSection('usage')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === 'usage'
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
            >
              <Zap className="w-4 h-4" />
              Billing & Usage
            </button>
            <button
              onClick={() => setActiveSection('about')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeSection === 'about'
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
            >
              <HelpCircle className="w-4 h-4" />
              About
            </button>
          </div>
        </ScrollArea>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 mt-4">
          <div className="flex items-center gap-2 text-xs text-gray-500 px-2">
            {saving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Saving changes...</span>
              </>
            ) : (
              <>
                <Check className="w-3 h-3 text-green-500" />
                <span>All changes saved</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Settings Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-950">
        <ScrollArea className="flex-1">
          <div className={`${activeSection === 'mcp' ? 'max-w-6xl' : 'max-w-3xl'} p-8 space-y-12`}>

            {/* General Section */}
            {activeSection === 'general' && (
              <div className="space-y-10">
                {/* Theme */}
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Appearance</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Customize how the application looks</p>
                  </div>

                  <div className="grid gap-2 max-w-md">
                    <Label htmlFor="theme" className="text-sm font-medium">Application Theme</Label>
                    <Select value={settings.theme} onValueChange={handleThemeChange}>
                      <SelectTrigger id="theme" className="w-full bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </section>

                {/* Storage */}
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Storage</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage where your data is stored</p>
                  </div>

                  <div className="grid gap-2 max-w-md">
                    <Label htmlFor="data-dir" className="text-sm font-medium">Data Directory</Label>
                    <div className="flex gap-2">
                      <Input
                        id="data-dir"
                        value={settings.projectsPath || ''}
                        readOnly
                        className="bg-gray-50/50 dark:bg-gray-900/50 font-mono text-xs text-gray-900 dark:text-gray-100"
                      />
                      <Button variant="outline" size="icon" onClick={handleDataDirChange} title="Change Directory">
                        <FolderOpen className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400">
                      Location where all projects and data are stored
                    </p>
                  </div>
                </section>

                {/* Notifications */}
                <section className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Control application alerts</p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 max-w-md">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Enable Notifications</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mr-8">
                        Get notified about important events
                      </p>
                    </div>
                    <Switch
                      checked={settings.notificationsEnabled}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, notificationsEnabled: checked }))}
                    />
                  </div>
                </section>
              </div>
            )}

            {/* AI Section */}
            {activeSection === 'ai' && (
              <div className="space-y-8">
                {/* Active Provider */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Active Provider</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select your default AI model provider</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRedetect}
                      className="gap-2 text-xs h-8 border-gray-200 dark:border-gray-800"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      Scan Environment
                    </Button>
                  </div>
                  <div className="grid gap-2 max-w-md">
                    <Select value={settings.activeProvider} onValueChange={handleProviderChange}>
                      <SelectTrigger className="w-full min-h-11 text-sm bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent className="min-w-[360px]">

                        <SelectItem value="ollama" disabled={!localModels.ollama?.installed}>
                          <div className="flex items-center gap-2">
                            <span>Ollama</span>
                            {localModels.ollama?.installed ? <Check className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-gray-400" />}
                          </div>
                        </SelectItem>
                        <SelectItem value="claudeCode" disabled={!isConfigured('claudeCode')}>
                          <div className="flex items-center gap-2">
                            <span>Claude Code CLI</span>
                            {isConfigured('claudeCode') ? <Check className="w-3 h-3 text-green-500" /> : <Info className="w-3 h-3 text-amber-500" />}
                          </div>
                        </SelectItem>
                        <SelectItem value="geminiCli" disabled={!localModels.gemini?.installed}>
                          <div className="flex items-center gap-2">
                            <span>Google (Antigravity Login)</span>
                            {localModels.gemini?.installed ? <Check className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-gray-400" />}
                          </div>
                        </SelectItem>
                        <SelectItem value="openAiCli" disabled={!isConfigured('openAiCli')}>
                          <div className="flex items-center gap-2">
                            <span>OpenAI (ChatGPT Login)</span>
                            {isConfigured('openAiCli') ? <Check className="w-3 h-3 text-green-500" /> : <Info className="w-3 h-3 text-amber-500" />}
                          </div>
                        </SelectItem>
                        <SelectItem value="hostedApi">
                          <div className="flex items-center gap-2">
                            <span>Hosted Claude (API)</span>
                            {isConfigured('hostedApi') ? <Check className="w-3 h-3 text-green-500" /> : <Info className="w-3 h-3 text-amber-500" />}
                          </div>
                        </SelectItem>
                        <SelectItem value="liteLlm" disabled={!isConfigured('liteLlm')}>
                          <div className="flex items-center gap-2">
                            <span>LiteLLM Router</span>
                            {isConfigured('liteLlm') ? <Check className="w-3 h-3 text-green-500" /> : <Info className="w-3 h-3 text-amber-500" />}
                          </div>
                        </SelectItem>
                        {settings.customClis?.map(cli => (
                          <SelectItem key={cli.id} value={`custom-${cli.id}`} disabled={!cli.isConfigured}>
                            <div className="flex items-center gap-2">
                              <span>{cli.name}</span>
                              {cli.isConfigured ? <Check className="w-3 h-3 text-green-500" /> : <Info className="w-3 h-3 text-amber-500" />}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isConfigured(settings.activeProvider) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" /> Selected provider is not fully configured
                      </p>
                    )}
                  </div>
                </section>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Models & Providers</h3>



                  {/* Ollama Card */}
                  <Card className={`border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden transition-all ${!localModels.ollama?.installed ? 'opacity-60 bg-gray-50/50 dark:bg-gray-950' : ''}`}>
                    <CardHeader className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={() => toggleSection('ollama')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${localModels.ollama?.installed ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">Ollama</CardTitle>
                            <CardDescription className="text-xs">Run local open-source models</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {localModels.ollama?.installed ?
                            <span className="text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800 font-medium">DETECTED</span> :
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-medium">NOT DETECTED</span>
                          }
                          {expandedSections.ollama ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>
                    </CardHeader>
                    {expandedSections.ollama && (
                      <CardContent className="p-4 pt-0 border-t border-gray-100 dark:border-gray-800 space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">API URL</Label>
                          <Input
                            value={settings.ollama?.apiUrl || 'http://localhost:11434'}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              ollama: {
                                ...(prev.ollama || { model: 'llama3', apiUrl: 'http://localhost:11434', detectedPath: undefined }),
                                apiUrl: e.target.value
                              }
                            }))}
                            className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                            disabled={!localModels.ollama?.installed}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Default Model</Label>
                          <Input
                            value={settings.ollama?.model || ''}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              ollama: {
                                ...(prev.ollama || { model: 'llama3', apiUrl: 'http://localhost:11434', detectedPath: undefined }),
                                model: e.target.value
                              }
                            }))}
                            placeholder="llama3"
                            className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                            disabled={!localModels.ollama?.installed}
                          />
                        </div>
                        {!localModels.ollama?.installed && (
                          <div className="p-3 rounded bg-blue-50 dark:bg-blue-900/10 text-xs text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                            Ollama not found. <a href="https://ollama.ai" target="_blank" className="underline font-medium">Install Ollama</a> to use local models.
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  {/* Google (Antigravity Login) Card */}
                  <Card className={`border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden transition-all ${!localModels.gemini?.installed ? 'opacity-60 bg-gray-50/50 dark:bg-gray-950' : ''}`}>
                    <CardHeader className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={() => toggleSection('geminiCli')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${localModels.gemini?.installed ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">Google (Antigravity Login)</CardTitle>
                            <CardDescription className="text-xs">Google's advanced models via CLI</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {localModels.gemini?.installed ?
                            <span className="text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800 font-medium">DETECTED</span> :
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-medium">NOT DETECTED</span>
                          }
                          {expandedSections.geminiCli ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>
                    </CardHeader>
                    {expandedSections.geminiCli && (
                      <CardContent className="p-4 pt-0 border-t border-gray-100 dark:border-gray-800 space-y-4 mt-4">
                        <div className="flex gap-4">
                          <div className="flex-1 space-y-2">
                            <Label className="text-xs text-gray-500">Command</Label>
                            <Input
                              value={settings.geminiCli?.command || 'gemini'}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                geminiCli: {
                                  ...(prev.geminiCli || { command: 'gemini', modelAlias: 'pro', apiKeySecretId: 'GEMINI_API_KEY', detectedPath: undefined }),
                                  command: e.target.value
                                }
                              }))}
                              className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                              disabled={!localModels.gemini?.installed}
                            />
                          </div>
                          <div className="flex-1 space-y-2">
                            <Label className="text-xs text-gray-500">Model Alias</Label>
                            <Input
                              value={settings.geminiCli?.modelAlias || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                geminiCli: {
                                  ...(prev.geminiCli || { command: 'gemini', modelAlias: 'auto-gemini-2.5', apiKeySecretId: 'GEMINI_API_KEY', detectedPath: undefined }),
                                  modelAlias: e.target.value
                                }
                              }))}
                              placeholder="auto-gemini-2.5"
                              className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                              disabled={!localModels.gemini?.installed}
                            />
                          </div>
                        </div>

                        <div className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Google (Antigravity Login)</Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-2"
                                  disabled={!localModels.gemini?.installed || isAuthenticatingGemini}
                                  onClick={handleAuthenticateGemini}
                                >
                                  {isAuthenticatingGemini ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                                  Login / Change Method
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-2"
                                  onClick={handleTestGoogleAuth}
                                >
                                  Check Status
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-2"
                                  onClick={handleLogoutGoogle}
                                >
                                  Logout
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500">
                              Starts Google/Antigravity authentication via Gemini CLI <code>/auth</code> flow.
                            </p>
                            <p className={`text-[10px] flex items-center gap-1 ${googleAuthStatus?.connected ? 'text-green-600' : 'text-amber-600'}`}>
                              {googleAuthStatus?.connected ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              {googleAuthStatus?.connected ? 'Connected via Google auth marker' : 'Not connected yet'}
                            </p>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                            <Label className="text-sm">Gemini API Key (Alternative)</Label>
                            <div className="relative">
                              <Input
                                type="password"
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                placeholder="AIza..."
                                className="font-mono text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                                disabled={!localModels.gemini?.installed}
                              />
                              <Key className="absolute right-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                            </div>

                            <p className="text-[10px] text-gray-400">
                              Use an API key if you don't want to use a personal Google account.
                            </p>
                          </div>

                          <div className="pt-2">
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto text-[10px] text-blue-600 dark:text-blue-400 gap-1"
                              onClick={() => window.open('https://geminicli.com/docs/get-started/authentication/#use-gemini-api-key', '_blank')}
                            >
                              <Info className="w-3 h-3" /> View Gemini CLI Authentication Docs
                            </Button>
                          </div>

                          {googleAuthStatus?.connected && !geminiApiKey && (
                            <p className="text-[10px] text-green-600 flex items-center gap-1">
                              <Check className="w-3 h-3" /> CLI is authenticated via Google / Antigravity login
                            </p>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  {/* OpenAI (ChatGPT Login) Card */}
                  <Card className={`border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden transition-all ${!isConfigured('openAiCli') ? 'opacity-80' : ''}`}>
                    <CardHeader className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={() => toggleSection('openAiCli')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isConfigured('openAiCli') ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                            <Key className="w-4 h-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">OpenAI (ChatGPT Login)</CardTitle>
                            <CardDescription className="text-xs">Authenticate your OpenAI session via browser/device flow</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isConfigured('openAiCli') ?
                            <span className="text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800 font-medium">CONFIGURED</span> :
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-medium">NOT CONFIGURED</span>
                          }
                          {expandedSections.openAiCli ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>
                    </CardHeader>
                    {expandedSections.openAiCli && (
                      <CardContent className="p-4 pt-0 border-t border-gray-100 dark:border-gray-800 space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label className="text-sm">CLI Command</Label>
                          <Input
                            value={settings.openAiCli?.command || 'codex'}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              openAiCli: {
                                ...(prev.openAiCli || { command: 'codex', modelAlias: 'gpt-5.3-codex', apiKeySecretId: 'OPENAI_API_KEY', detectedPath: undefined }),
                                command: e.target.value
                              }
                            }))}
                            placeholder="codex"
                            className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm">Personal ChatGPT Login</Label>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-2"
                                disabled={isAuthenticatingOpenAI}
                                onClick={handleAuthenticateOpenAI}
                              >
                                {isAuthenticatingOpenAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                                Login / Refresh Session
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-2"
                                onClick={handleTestOpenAIAuth}
                              >
                                Check Status
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 gap-2"
                                onClick={handleLogoutOpenAI}
                              >
                                Logout
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            Starts CLI login flow for your configured command (for codex this uses <code>login</code>).
                          </p>
                          <p className={`text-[10px] flex items-center gap-1 ${openAiAuthStatus?.connected ? 'text-green-600' : 'text-amber-600'}`}>
                            {openAiAuthStatus?.connected ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                            {openAiAuthStatus?.connected ? 'Connected via CLI auth marker' : 'Not connected yet'}
                          </p>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                          <Label className="text-sm">OpenAI API Key (Alternative)</Label>
                          <div className="relative">
                            <Input
                              type="password"
                              value={openAiApiKey}
                              onChange={(e) => setOpenAiApiKey(e.target.value)}
                              placeholder="sk-..."
                              className="font-mono text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                            />
                            <Key className="absolute right-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  {/* Claude Code Card */}
                  <Card className={`border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden transition-all ${!localModels.claudeCode?.installed ? 'opacity-60 bg-gray-50/50 dark:bg-gray-950' : (localModels.claudeCode?.authenticated ? '' : 'border-amber-200 dark:border-amber-900/40 bg-amber-50/10 dark:bg-amber-950/20')}`}>
                    <CardHeader className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={() => toggleSection('claudeCode')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${localModels.claudeCode?.installed ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">Claude Code CLI</CardTitle>
                            <CardDescription className="text-xs">Run agentic workflows locally</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {localModels.claudeCode?.installed ?
                            (localModels.claudeCode?.authenticated ?
                              <span className="text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800 font-medium whitespace-nowrap">CONNECTED</span> :
                              <span className="text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-medium whitespace-nowrap">NOT CONNECTED</span>
                            ) :
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">NOT DETECTED</span>
                          }
                          {expandedSections.claudeCode ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>
                    </CardHeader>
                    {expandedSections.claudeCode && (
                      <CardContent className="p-4 pt-0 border-t border-gray-100 dark:border-gray-800 space-y-4 mt-4">
                        <p className="text-xs text-gray-500">
                          Claude Code is managed through your terminal. Once detected, the application can leverage its capabilities for complex tasks.
                        </p>
                        <div className="flex items-center gap-2 pt-2">
                          <Button size="sm" variant="outline" className="h-8 gap-2" disabled={!localModels.claudeCode?.installed} onClick={handleCheckClaudeStatus}>
                             Check Status
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs gap-2" onClick={() => window.open('https://claude.ai/code', '_blank')}>
                            <Info className="w-3.5 h-3.5" /> Documentation
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  {/* Hosted Card */}
                  <Card className={`border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden transition-all ${!isConfigured('hostedApi') ? 'opacity-80' : ''}`}>
                    <CardHeader className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={() => toggleSection('hosted')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isConfigured('hostedApi') ? 'bg-primary/10 text-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                            <Cpu className="w-4 h-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">Hosted Claude API</CardTitle>
                            <CardDescription className="text-xs">Direct connection to Anthropic's Claude</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isConfigured('hostedApi') ?
                            <span className="text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800 font-medium">CONFIGURED</span> :
                            <span className="text-[10px] bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800 font-medium">NOT CONFIGURED</span>
                          }
                          {expandedSections.hosted ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>
                    </CardHeader>
                    {expandedSections.hosted && (
                      <CardContent className="p-4 pt-0 border-t border-gray-100 dark:border-gray-800 space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Anthropic API Key</Label>
                          <div className="relative">
                            <Input
                              type="password"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              placeholder="sk-ant-..."
                              className="font-mono text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                            />
                            <Key className="absolute right-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Default Model ID</Label>
                          <Input
                            value={settings.hosted?.model || ''}
                            onChange={(e) => setSettings(prev => ({
                              ...prev,
                              hosted: {
                                ...(prev.hosted || { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', apiKeySecretId: 'ANTHROPIC_API_KEY' }),
                                model: e.target.value
                              }
                            }))}
                            placeholder="claude-3-5-sonnet-20241022"
                            className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                          />
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  {/* LiteLLM Router Card */}
                  <Card className={`border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden transition-all ${!settings.liteLlm?.enabled ? 'opacity-90' : ''}`}>
                    <CardHeader className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" onClick={() => toggleSection('liteLlm')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${settings.liteLlm?.enabled ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                            <Server className="w-4 h-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold">LiteLLM Router</CardTitle>
                            <CardDescription className="text-xs">Task-based model routing (Off / Silent / Active)</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {settings.liteLlm?.enabled ?
                            <span className="text-[10px] bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-800 font-medium">ENABLED</span> :
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded font-medium">OFF</span>
                          }
                          {expandedSections.liteLlm ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        </div>
                      </div>
                    </CardHeader>
                    {expandedSections.liteLlm && (
                      <CardContent className="p-4 pt-0 border-t border-gray-100 dark:border-gray-800 space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-500">Routing Mode</Label>
                          <Select value={getLiteLlmMode()} onValueChange={(v) => handleLiteLlmModeChange(v as 'off' | 'silent' | 'active')}>
                            <SelectTrigger className="w-full bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                              <SelectValue placeholder="Choose mode" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="off">Off (Not at all)</SelectItem>
                              <SelectItem value="silent">Silent (Observe only)</SelectItem>
                              <SelectItem value="active">Active (Auto routing)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-gray-500">
                            Silent mode logs suggested model choices. Active mode routes automatically via LiteLLM.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Base URL</Label>
                            <Input
                              value={settings.liteLlm?.baseUrl || 'http://localhost:4000'}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                liteLlm: {
                                  ...(prev.liteLlm || { enabled: false, baseUrl: 'http://localhost:4000', apiKeySecretId: 'LITELLM_API_KEY', shadowMode: true, strategy: { defaultModel: 'gpt-4.1-mini', researchModel: 'claude-sonnet-4-20250514', codingModel: 'claude-sonnet-4-20250514', editingModel: 'gemini-2.5-flash' } }),
                                  baseUrl: e.target.value
                                }
                              }))}
                              className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-500">API Key Secret ID</Label>
                            <Input
                              value={settings.liteLlm?.apiKeySecretId || 'LITELLM_API_KEY'}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                liteLlm: {
                                  ...(prev.liteLlm || { enabled: false, baseUrl: 'http://localhost:4000', apiKeySecretId: 'LITELLM_API_KEY', shadowMode: true, strategy: { defaultModel: 'gpt-4.1-mini', researchModel: 'claude-sonnet-4-20250514', codingModel: 'claude-sonnet-4-20250514', editingModel: 'gemini-2.5-flash' } }),
                                  apiKeySecretId: e.target.value
                                }
                              }))}
                              className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                            />
                          </div>
                        </div>

                        {/* Test Connection */}
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2 text-xs border-gray-200 dark:border-gray-800"
                            disabled={litellmTesting}
                            onClick={async () => {
                              setLitellmTesting(true);
                              setLitellmTestResult(null);
                              try {
                                const msg = await tauriApi.testLitellmConnection(
                                  settings.liteLlm?.baseUrl || 'http://localhost:4000',
                                  settings.liteLlm?.apiKeySecretId || 'LITELLM_API_KEY'
                                );
                                setLitellmTestResult({ ok: true, message: msg });
                              } catch (e: any) {
                                setLitellmTestResult({ ok: false, message: String(e) });
                              } finally {
                                setLitellmTesting(false);
                              }
                            }}
                          >
                            {litellmTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                            Test Connection
                          </Button>
                          {litellmTestResult && (
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${litellmTestResult.ok
                              ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                              : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                              }`}>
                              {litellmTestResult.ok ? '✓ Connected' : '✗ Failed'}
                            </span>
                          )}
                        </div>
                        {litellmTestResult && !litellmTestResult.ok && (
                          <p className="text-[10px] text-red-500 dark:text-red-400">{litellmTestResult.message}</p>
                        )}

                        {/* Setup guidance */}
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-xs text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30 flex items-start gap-2">
                          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>
                            Make sure LiteLLM proxy is running at the configured URL.{' '}
                            <a href="https://docs.litellm.ai/docs/proxy/quick_start" target="_blank" rel="noopener noreferrer" className="underline font-medium">Quick Start Guide ↗</a>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Research Model</Label>
                            <Input
                              value={settings.liteLlm?.strategy?.researchModel || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                liteLlm: {
                                  ...(prev.liteLlm || { enabled: false, baseUrl: 'http://localhost:4000', apiKeySecretId: 'LITELLM_API_KEY', shadowMode: true, strategy: { defaultModel: 'gpt-4.1-mini', researchModel: '', codingModel: '', editingModel: '' } }),
                                  strategy: {
                                    ...(prev.liteLlm?.strategy || { defaultModel: 'gpt-4.1-mini', researchModel: '', codingModel: '', editingModel: '' }),
                                    researchModel: e.target.value,
                                  }
                                }
                              }))}
                              className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Coding Model</Label>
                            <Input
                              value={settings.liteLlm?.strategy?.codingModel || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                liteLlm: {
                                  ...(prev.liteLlm || { enabled: false, baseUrl: 'http://localhost:4000', apiKeySecretId: 'LITELLM_API_KEY', shadowMode: true, strategy: { defaultModel: 'gpt-4.1-mini', researchModel: '', codingModel: '', editingModel: '' } }),
                                  strategy: {
                                    ...(prev.liteLlm?.strategy || { defaultModel: 'gpt-4.1-mini', researchModel: '', codingModel: '', editingModel: '' }),
                                    codingModel: e.target.value,
                                  }
                                }
                              }))}
                              className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-500">Editing Model</Label>
                            <Input
                              value={settings.liteLlm?.strategy?.editingModel || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                liteLlm: {
                                  ...(prev.liteLlm || { enabled: false, baseUrl: 'http://localhost:4000', apiKeySecretId: 'LITELLM_API_KEY', shadowMode: true, strategy: { defaultModel: 'gpt-4.1-mini', researchModel: '', codingModel: '', editingModel: '' } }),
                                  strategy: {
                                    ...(prev.liteLlm?.strategy || { defaultModel: 'gpt-4.1-mini', researchModel: '', codingModel: '', editingModel: '' }),
                                    editingModel: e.target.value,
                                  }
                                }
                              }))}
                              className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-gray-500">General Model</Label>
                            <Input
                              value={settings.liteLlm?.strategy?.defaultModel || ''}
                              onChange={(e) => setSettings(prev => ({
                                ...prev,
                                liteLlm: {
                                  ...(prev.liteLlm || { enabled: false, baseUrl: 'http://localhost:4000', apiKeySecretId: 'LITELLM_API_KEY', shadowMode: true, strategy: { defaultModel: 'gpt-4.1-mini', researchModel: '', codingModel: '', editingModel: '' } }),
                                  strategy: {
                                    ...(prev.liteLlm?.strategy || { defaultModel: 'gpt-4.1-mini', researchModel: '', codingModel: '', editingModel: '' }),
                                    defaultModel: e.target.value,
                                  }
                                }
                              }))}
                              className="text-xs bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800"
                            />
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  {/* Custom CLIs */}
                  <div className="pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Custom Models</h4>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={handleAddCustomCli}>
                        <Plus className="w-3 h-3" /> Add Custom CLI
                      </Button>
                    </div>

                    {settings.customClis?.map(cli => (
                      <Card key={cli.id} className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/30 shadow-sm overflow-hidden">
                        <CardHeader className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Input
                                value={cli.name}
                                onChange={(e) => handleUpdateCustomCli(cli.id, 'name', e.target.value)}
                                className="h-7 text-xs font-medium bg-transparent border-transparent hover:border-gray-200 dark:hover:border-gray-800 w-40 px-1"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              {cli.isConfigured && <Check className="w-3 h-3 text-green-500" />}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => handleRemoveCustomCli(cli.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-3 pt-0 grid gap-3">
                          <div className="grid gap-1.5">
                            <Label className="text-[10px] text-gray-500">Executable Command</Label>
                            <Input
                              value={cli.command}
                              onChange={(e) => handleUpdateCustomCli(cli.id, 'command', e.target.value)}
                              placeholder="e.g. ./my-model-cli"
                              className="h-8 text-xs bg-gray-50/10 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800"
                            />
                            <p className="text-[9px] text-gray-500 italic">
                              Note: Custom CLIs execute directly and do not use a base URL configuration.
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-1.5">
                              <Label className="text-[10px] text-gray-500">API Key Env Var (Optional)</Label>
                              <Input
                                value={cli.apiKeyEnvVar || ''}
                                onChange={(e) => handleUpdateCustomCli(cli.id, 'apiKeyEnvVar', e.target.value)}
                                placeholder="e.g. CUSTOM_API_KEY"
                                className="h-8 text-xs bg-gray-50/10 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800"
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-[10px] text-gray-500">API Key (Optional)</Label>
                              <div className="relative">
                                <Input
                                  type="password"
                                  value={customApiKeys[`CUSTOM_CLI_${cli.id}_KEY`] || ''}
                                  onChange={(e) => {
                                    const secretId = `CUSTOM_CLI_${cli.id}_KEY`;
                                    setCustomApiKeys(prev => ({ ...prev, [secretId]: e.target.value }));
                                    handleUpdateCustomCli(cli.id, 'apiKeySecretId', secretId);
                                  }}
                                  placeholder="Enter API key"
                                  className="h-8 text-xs bg-gray-50/10 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800 pr-8"
                                />
                                <Key className="absolute right-2 top-2 w-3.5 h-3.5 text-gray-400" />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div className="grid gap-1.5">
                              <Label className="text-[10px] text-gray-500">Global Settings Path (Optional)</Label>
                              <Input
                                value={cli.settingsFilePath || ''}
                                onChange={(e) => handleUpdateCustomCli(cli.id, 'settingsFilePath', e.target.value)}
                                placeholder="e.g. .bob/settings.json"
                                className="h-8 text-xs bg-gray-50/10 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800"
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label className="text-[10px] text-gray-500">MCP Config Flag (Optional)</Label>
                              <Input
                                value={cli.mcpConfigFlag || ''}
                                onChange={(e) => handleUpdateCustomCli(cli.id, 'mcpConfigFlag', e.target.value)}
                                placeholder="e.g. --config"
                                className="h-8 text-xs bg-gray-50/10 dark:bg-gray-900/10 border-gray-200 dark:border-gray-800"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {(!settings.customClis || settings.customClis.length === 0) && (
                      <div className="text-center py-6 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
                        <p className="text-xs text-gray-400">No custom CLIs added yet</p>
                      </div>
                    )}
                  </div>

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

                    {isCustomModel ? (
                      <div className="space-y-2">
                        <Input
                          placeholder="e.g. claude-3-7-sonnet-latest"
                          value={settings.defaultModel}
                          onChange={(e) => setSettings(prev => ({ ...prev, defaultModel: e.target.value }))}
                          className="bg-gray-50/50 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100"
                        />
                        <p className="text-[10px] text-gray-500">
                          Enter exact model identifier.
                        </p>
                      </div>
                    ) : (
                      <Select value={settings.defaultModel} onValueChange={handleModelChange}>
                        <SelectTrigger id="default-model" className="w-full min-h-11 text-sm bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent className="min-w-[420px] max-w-[640px]">
                          <SelectGroup>
                            <SelectLabel>Hosted Models</SelectLabel>
                            <SelectItem value="autoRouter">Auto-Router (Rules Based)</SelectItem>
                            <SelectItem value="auto-gemini-2.5">Auto Gemini 2.5</SelectItem>
                            <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                            <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                            <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                            <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                            <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                            <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                            <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                          </SelectGroup>

                          {(localModels.ollama || localModels.claudeCode || localModels.gemini) && (
                            <SelectGroup>
                              <SelectLabel>Local Models</SelectLabel>
                              {localModels.ollama && ollamaModelsList.length > 0 ? (
                                ollamaModelsList.map(model => (
                                  <SelectItem key={model} value={model}>Ollama: {model}</SelectItem>
                                ))
                              ) : (
                                localModels.ollama && <SelectItem value="ollama">Ollama (Auto-detect)</SelectItem>
                              )}
                              {localModels.claudeCode && <SelectItem value="claude-code">Claude Code (Auto-detect)</SelectItem>}
                              {localModels.gemini && <SelectItem value="gemini-cli">Google (Antigravity Login)</SelectItem>}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MCP Section */}
            {activeSection === 'mcp' && (
              <McpMarketplace />
            )}

            {/* Usage Section */}
            {activeSection === 'usage' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">Billing & Usage</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Detailed analytics of your AI interaction costs, token efficiency, and saved time</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => activeSection === 'usage' && tauriApi.getUsageStatistics().then(setUsageStats)}
                      className="gap-2"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      Refresh
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-sm border-2">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 opacity-70">Total Cost</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {totalCost === null ? '...' : `$${totalCost.toFixed(4)}`}
                          </span>
                          <span className="text-[10px] font-medium text-emerald-600/50">USD</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-blue-500/20 bg-blue-500/5 shadow-sm border-2">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[10px] uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 opacity-70">Total Tokens</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                              {((usageStats?.totalInputTokens || 0) + (usageStats?.totalOutputTokens || 0)).toLocaleString()}
                            </span>
                          </div>
                          <span className="text-[10px] font-medium text-blue-600/50">
                            {usageStats?.totalInputTokens.toLocaleString()} in / {usageStats?.totalOutputTokens.toLocaleString()} out
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-purple-500/20 bg-purple-500/5 shadow-sm border-2">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[10px] uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400 opacity-70">Cache Efficiency</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                              {usageStats?.totalInputTokens ? Math.round((usageStats.totalCacheReadTokens / usageStats.totalInputTokens) * 100) : 0}%
                            </span>
                          </div>
                          <span className="text-[10px] font-medium text-purple-600/50">
                            {usageStats?.totalCacheReadTokens.toLocaleString()} tokens cached
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-amber-500/20 bg-amber-500/5 shadow-sm border-2">
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[10px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-400 opacity-70">Est. Time Saved</CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0">
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                              {usageStats ? (usageStats.totalTimeSavedMinutes / 60).toFixed(1) : '0.0'}
                            </span>
                            <span className="text-[10px] font-medium text-amber-600/50">HOURS</span>
                          </div>
                          <span className="text-[10px] font-medium text-amber-600/50">
                            {usageStats?.totalToolCalls || 0} tool calls executed
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 shadow-sm border-2 overflow-hidden">
                    <CardHeader className="p-4 border-b border-gray-100 dark:border-gray-800">
                      <CardTitle className="text-sm font-semibold">Usage by Provider</CardTitle>
                      <CardDescription className="text-[11px]">Detailed breakdown including caching and reasoning performance</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/50 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                              <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">Provider</th>
                              <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">In / Out</th>
                              <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">Cache (R/W)</th>
                              <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">Reasoning</th>
                              <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">Cost (USD)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageStats?.providerBreakdown?.map((item, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-100 dark:border-gray-800">
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.provider}</td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex flex-col">
                                    <span className="font-mono">{item.totalInputTokens.toLocaleString()}</span>
                                    <span className="text-[9px] text-gray-400">{item.totalOutputTokens.toLocaleString()}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex flex-col">
                                    <span className="font-mono text-purple-600 dark:text-purple-400">{item.totalCacheReadTokens.toLocaleString()}</span>
                                    <span className="text-[9px] text-gray-400">{item.totalCacheCreationTokens.toLocaleString()}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400">
                                  {item.totalReasoningTokens.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                  ${item.totalCostUsd.toFixed(4)}
                                </td>
                              </tr>
                            ))}
                            {(!usageStats?.providerBreakdown || usageStats.providerBreakdown.length === 0) && (
                              <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-gray-400 italic">
                                  No usage data recorded yet
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </div>
            )}

            {/* About Section */}
            {activeSection === 'templates' && (
              <section className="space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Artifact Templates</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure default markdown templates for new project artifacts.</p>
                </div>

                <div className="space-y-6 max-w-4xl">
                  <div className="flex flex-col space-y-4">
                    <Label className="text-sm font-medium">Select Artifact Type</Label>
                    <Select
                      value={selectedTemplateType}
                      onValueChange={(val) => setSelectedTemplateType(val)}
                    >
                      <SelectTrigger className="w-[200px] bg-white dark:bg-gray-900">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="insight">Insight</SelectItem>
                        <SelectItem value="evidence">Evidence</SelectItem>
                        <SelectItem value="decision">Decision</SelectItem>
                        <SelectItem value="requirement">Requirement</SelectItem>
                        <SelectItem value="metric_definition">Metric Definition</SelectItem>
                        <SelectItem value="experiment">Experiment</SelectItem>
                        <SelectItem value="poc_brief">POC Brief</SelectItem>
                      </SelectContent>
                    </Select>

                    <Label className="text-sm font-medium mt-4">Template Markdown</Label>
                    <Textarea
                      key={selectedTemplateType}
                      defaultValue={settings.artifactTemplates?.[selectedTemplateType] || `# {{title}}\n\n## Section\n\n...`}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                        setSettings(prev => ({
                          ...prev,
                          artifactTemplates: {
                            ...(prev.artifactTemplates || {}),
                            [selectedTemplateType]: e.target.value
                          }
                        }));
                      }}
                      className="min-h-[400px] font-mono text-sm resize-y bg-gray-50/50 dark:bg-gray-900/50"
                      placeholder="Enter markdown template. Use {{title}} to insert the artifact's title."
                    />
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'about' && (
              <div className="space-y-10">
                <section className="space-y-8">
                  <div className="flex flex-col items-center text-center space-y-4 py-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center shadow-xl shadow-primary/20 mb-2 border border-primary/20">
                      <Logo size="lg" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 italic tracking-tight">productOS</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Smart academic research and intelligence assistant</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-xs font-mono text-gray-600 dark:text-gray-400">
                      Version {appVersion || 'Loading...'}
                    </div>
                  </div>

                  <div className="grid gap-6">
                    <Card className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 shadow-sm border-2">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                          Application Update
                        </CardTitle>
                        <CardDescription>
                          Keep your application up to date with the latest features and security improvements.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {updateStatus.available ? 'New update available!' : 'Application is up to date'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {updateStatus.lastChecked ? `Last checked: ${updateStatus.lastChecked.toLocaleTimeString()}` : 'Never checked'}
                            </p>
                          </div>
                          {!updateStatus.available && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={updateStatus.checking}
                              onClick={() => handleCheckUpdate(true)}
                              className="gap-2"
                            >
                              {updateStatus.checking ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Checking...
                                </>
                              ) : (
                                <>
                                  <RefreshCcw className="w-3.5 h-3.5" />
                                  Check Now
                                </>
                              )}
                            </Button>
                          )}
                        </div>

                        {updateStatus.available && (
                          <div className="p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/10 space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-sm font-bold text-primary">Version {updateStatus.updateInfo.version}</h4>
                                <p className="text-xs text-primary/70 mt-1">Released on {new Date(updateStatus.updateInfo.date).toLocaleDateString()}</p>
                              </div>
                              <span className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded font-bold">NEW</span>
                            </div>

                            {updateStatus.updateInfo.body && (
                              <div className="text-xs text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-950/50 p-3 rounded-lg border border-primary/5 max-h-32 overflow-y-auto">
                                {updateStatus.updateInfo.body}
                              </div>
                            )}

                            <Button
                              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                              disabled={installing}
                              onClick={handleInstallUpdate}
                            >
                              {installing ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  {downloadProgress > 0 ? `Downloading ${downloadProgress}%` : 'Starting Update...'}
                                </>
                              ) : (
                                <>
                                  <Rocket className="w-4 h-4" />
                                  Update and Relaunch
                                </>
                              )}
                            </Button>
                          </div>
                        )}

                        {updateStatus.error && (
                          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Update Error: {updateStatus.error}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        className="h-24 flex flex-col items-center justify-center gap-2 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 group"
                        onClick={() => window.open('https://github.com/AssafMiron/ai-researcher', '_blank')}
                      >
                        <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-primary/10 transition-colors">
                          <Info className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary" />
                        </div>
                        <span className="text-sm font-medium">GitHub Repo</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-24 flex flex-col items-center justify-center gap-2 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 group"
                        onClick={() => window.open('https://github.com/AssafMiron/ai-researcher/issues', '_blank')}
                      >
                        <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 group-hover:bg-red-50 dark:group-hover:bg-red-900/30 transition-colors">
                          <AlertTriangle className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-red-500" />
                        </div>
                        <span className="text-sm font-medium">Report Issue</span>
                      </Button>
                    </div>

                    <div className="text-center space-y-2 pt-4">
                      <p className="text-xs text-gray-500">
                        &copy; 2026 productOS Team. Built with Tauri, React and Radix UI.
                      </p>
                      <div className="flex items-center justify-center gap-4">
                        <a href="https://github.com/AssafMiron/ai-researcher/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">License Info</a>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <a href="https://github.com/AssafMiron/ai-researcher/blob/main/PRIVACY_POLICY.md" target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">Privacy Policy</a>
                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                        <a href="https://github.com/AssafMiron/ai-researcher/blob/main/CREDITS.md" target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline">Credits</a>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
