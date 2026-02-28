import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Settings, FolderOpen, Key, Bell, Palette, Database, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { tauriApi } from '../api/tauri';
import { useToast } from '@/hooks/use-toast';

interface SettingsPageProps {
  activeProject: { id: string; name: string; description?: string } | null;
}

export default function SettingsPage({ activeProject }: SettingsPageProps) {
  const { toast } = useToast();

  const [projectSettings, setProjectSettings] = useState({
    name: activeProject?.name || '',
    description: activeProject?.description || '',
    autoSave: true,
    encryptData: true
  });

  const [globalSettings, setGlobalSettings] = useState({
    apiKey: '••••••••••••••••',
    defaultModel: 'claude-3-opus',
    theme: 'dark',
    notifications: true,
    dataDirectory: ''
  });

  // Load the app data directory on mount
  useEffect(() => {
    const loadAppDataDirectory = async () => {
      try {
        const directory = await tauriApi.getAppDataDirectory();
        setGlobalSettings(prev => ({ ...prev, dataDirectory: directory }));
      } catch (error) {
        console.error('Failed to load app data directory:', error);
        toast({
          title: 'Warning',
          description: 'Could not load app data directory path',
          variant: 'destructive'
        });
      }
    };

    loadAppDataDirectory();
  }, []);

  const handleSaveProject = async () => {
    if (!activeProject) {
      toast({
        title: 'Error',
        description: 'No active project selected',
        variant: 'destructive'
      });
      return;
    }

    try {
      await tauriApi.saveProjectSettings(activeProject.id, {
        name: projectSettings.name,
        goal: projectSettings.description,
        auto_save: projectSettings.autoSave,
        encryption_enabled: projectSettings.encryptData
      });

      toast({
        title: 'Success',
        description: 'Project settings saved successfully'
      });
    } catch (error) {
      console.error('Failed to save project settings:', error);
      toast({
        title: 'Error',
        description: `Failed to save project settings: ${error}`,
        variant: 'destructive'
      });
    }
  };

  const handleSaveGlobal = async () => {
    try {
      // Save global settings
      await tauriApi.saveGlobalSettings({
        model: undefined, // removed deprecated field if any
        claude_api_key: undefined, // removed as it is secret
        // Send correct fields matching Rust struct
        defaultModel: globalSettings.defaultModel,
        theme: globalSettings.theme,
        notifications_enabled: globalSettings.notifications,
        // We don't save dataDirectory as it's read-only in UI usually, or mapped to projects_path if editable
      } as any);

      // Save secrets (API Key)
      if (globalSettings.apiKey && globalSettings.apiKey !== '••••••••••••••••') {
        await tauriApi.saveSecrets({
          claude_api_key: globalSettings.apiKey
        });
      }

      toast({
        title: 'Success',
        description: 'Global settings saved successfully'
      });
    } catch (error) {
      console.error('Failed to save global settings:', error);
      toast({
        title: 'Error',
        description: `Failed to save global settings: ${error}`,
        variant: 'destructive'
      });
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage your project and application preferences
            </p>
          </div>
        </div>

        {/* Project Settings */}
        {activeProject && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                <CardTitle>Project Settings</CardTitle>
              </div>
              <CardDescription>
                Settings specific to {activeProject.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    value={projectSettings.name}
                    onChange={(e) => setProjectSettings({ ...projectSettings, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-desc">Description</Label>
                  <Input
                    id="project-desc"
                    value={projectSettings.description}
                    onChange={(e) => setProjectSettings({ ...projectSettings, description: e.target.value })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-save Documents</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Automatically save changes as you type
                    </p>
                  </div>
                  <Switch
                    checked={projectSettings.autoSave}
                    onCheckedChange={(checked) => setProjectSettings({ ...projectSettings, autoSave: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Encrypt Project Data</Label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Use encryption for sensitive documents
                    </p>
                  </div>
                  <Switch
                    checked={projectSettings.encryptData}
                    onCheckedChange={(checked) => setProjectSettings({ ...projectSettings, encryptData: checked })}
                  />
                </div>
              </div>

              <Button onClick={handleSaveProject} className="w-full">
                Save Project Settings
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Global Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-500" />
              <CardTitle>Global Settings</CardTitle>
            </div>
            <CardDescription>
              Application-wide preferences and configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Configuration */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Key className="w-4 h-4" />
                <span>API Configuration</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">Anthropic API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={globalSettings.apiKey}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, apiKey: e.target.value })}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Your API key is stored securely and encrypted
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-model">Default AI Model</Label>
                <select
                  id="default-model"
                  value={globalSettings.defaultModel}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, defaultModel: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
                >
                  <option value="claude-3-opus">Claude 3 Opus</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                  <option value="claude-3-haiku">Claude 3 Haiku</option>
                </select>
              </div>
            </div>

            <Separator />

            {/* Appearance */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Palette className="w-4 h-4" />
                <span>Appearance</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <select
                  id="theme"
                  value={globalSettings.theme}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, theme: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-sm"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>

            <Separator />

            {/* Notifications */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bell className="w-4 h-4" />
                <span>Notifications</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Notifications</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Get notified about important events
                  </p>
                </div>
                <Switch
                  checked={globalSettings.notifications}
                  onCheckedChange={(checked) => setGlobalSettings({ ...globalSettings, notifications: checked })}
                />
              </div>
            </div>

            <Separator />

            {/* Storage */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Database className="w-4 h-4" />
                <span>Storage</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-dir">Data Directory</Label>
                <Input
                  id="data-dir"
                  value={globalSettings.dataDirectory}
                  readOnly
                  className="bg-gray-50 dark:bg-gray-900"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Location where all projects and data are stored
                </p>
              </div>
            </div>

            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-sm text-gray-700 dark:text-gray-300">
                All sensitive data including API keys are encrypted using AES-256 encryption
              </AlertDescription>
            </Alert>

            <Button onClick={handleSaveGlobal} className="w-full">
              Save Global Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}