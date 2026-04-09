import { useState, useEffect } from 'react';
import {
  Layout, Cpu, Zap, Link2, Rocket, Info, Loader2, Check
} from 'lucide-react';
import { 
  tauriApi, GlobalSettings, ProviderType, GeminiInfo, 
  ClaudeCodeInfo, OllamaInfo, 
  UsageStatistics, Project 
} from '../api/tauri';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_CHANNEL_SETTINGS } from '@/lib/channelSettings';
import { Button } from '@/components/ui/button';

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
  const [hasTelegramToken] = useState(false);
  const [hasWhatsappToken] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [gs, useS, projs, appV, chS] = await Promise.all([
          tauriApi.getGlobalSettings(),
          tauriApi.getUsageStatistics(selectedProjectId === 'all' ? undefined : selectedProjectId),
          tauriApi.getAllProjects(),
          tauriApi.getAppVersion(),
          tauriApi.loadChannelSettings()
        ]);
        
        setSettings(gs);
        setUsageStats(useS);
        setProjectsList(projs);
        setAppVersion(appV);
        setChannelSettings(chS as unknown as IChannelSettings);
        
        // Extract keys/status
        setApiKey(gs.hosted?.apiKeySecretId ? '••••••••' : ''); 
        // Note: Real keys are handled by backend, we just show placeholders if exist
        
        // Check local model availability
        const [ollama, claude, gemini] = await Promise.all([
          tauriApi.detectOllama(),
          tauriApi.detectClaudeCode(),
          tauriApi.detectGemini()
        ]);
        
        setLocalModels({ ollama, claudeCode: claude, gemini });
        
        if (ollama?.installed) {
          const models = await tauriApi.getOllamaModels();
          setOllamaModelsList(models);
        }

        setLoading(false);
      } catch (e) {
        console.error("Failed to load settings", e);
        toast({ title: 'Error', description: 'Failed to load settings.', variant: 'destructive' });
        setLoading(false);
      }
    };
    loadData();
  }, [selectedProjectId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await tauriApi.saveGlobalSettings(settings);
      await tauriApi.saveChannelSettings(channelSettings);
      
      // Save secrets if changed...
      // (This requires per-provider logic usually handled by specialized methods in backend)
      
      toast({ title: 'Settings Saved', description: 'Your configuration has been updated.' });
    } catch (e) {
      toast({ title: 'Save Failed', description: String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

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
      setDownloadProgress(50); // Mocks the progress until properly implemented
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

  const isConfigured = (provider: ProviderType) => {
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
                        customApiKeys={customApiKeys}
                        setCustomApiKeys={setCustomApiKeys}
                        localModels={localModels}
                        expandedSections={expandedSections}
                        setExpandedSections={setExpandedSections}
                        litellmTesting={false}
                        litellmTestResult={null}
                        ollamaModelsList={ollamaModelsList}
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

