import React from 'react';
import { Cpu } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { GlobalSettings } from '@/api/tauri';

interface ModelSettingsProps {
    settings: GlobalSettings;
    setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
    isCustomModel: boolean;
    setIsCustomModel: (v: boolean) => void;
}

export const ModelSettings: React.FC<ModelSettingsProps> = ({
    settings,
    setSettings,
    isCustomModel,
    setIsCustomModel
}) => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <section className="space-y-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">Model Configuration</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configure default model identifiers and behavior across the platform</p>
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

                    <div className="grid gap-2">
                        <Input
                            id="default-model"
                            value={settings.defaultModelId}
                            onChange={(e) => setSettings(prev => ({ ...prev, defaultModelId: e.target.value }))}
                            placeholder={isCustomModel ? "e.g. gpt-4-turbo" : "Select or type a model ID"}
                            className="font-mono text-sm"
                        />
                        <p className="text-2xs text-gray-500">
                            Enter exact model identifier. This ID is used across all research and workflow tasks.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30">
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-primary" />
                                Model Routing
                            </h4>
                            <p className="text-xs text-muted-foreground">
                                productOS automatically routes requests based on the capability of the selected provider. 
                                Ensure your provider supports the model ID specified above.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
