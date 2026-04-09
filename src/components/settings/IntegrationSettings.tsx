import React from 'react';
import { Send, MessageCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

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

interface IntegrationSettingsProps {
    channelSettings: IChannelSettings;
    setChannelSettings: React.Dispatch<React.SetStateAction<IChannelSettings>>;
    hasTelegramToken: boolean;
    hasWhatsappToken: boolean;
    onTestTelegram: () => void;
    onTestWhatsapp: () => void;
    telegramTesting: boolean;
    whatsappTesting: boolean;
    telegramTestResult: { ok: boolean; message: string } | null;
    whatsappTestResult: { ok: boolean; message: string } | null;
}

export const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({
    channelSettings,
    setChannelSettings,
    hasTelegramToken,
    hasWhatsappToken,
    onTestTelegram,
    onTestWhatsapp,
    telegramTesting,
    whatsappTesting,
    telegramTestResult,
    whatsappTestResult
}) => {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <section className="space-y-6">
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight">Chat Integrations</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Connect productOS to your communication channels for automated updates and alerts</p>
                </div>

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Send className="w-5 h-5" />
                        </div>
                        <div>
                            <Label htmlFor="master-enabled" className="text-sm font-bold block">Enable Chat Connectors</Label>
                            <p className="text-2xs text-muted-foreground">Master switch for all external communication integrations</p>
                        </div>
                    </div>
                    <Switch
                        id="master-enabled"
                        data-testid="integrations-master-enabled"
                        checked={channelSettings.enabled}
                        onCheckedChange={(v) => setChannelSettings(prev => ({ ...prev, enabled: v }))}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Telegram */}
                    <Card className={`border-2 transition-all ${channelSettings.telegramEnabled ? 'border-primary/20' : 'opacity-60 border-gray-100'}`}>
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                                <span className="p-1.5 rounded-md bg-[#0088cc]/10 text-[#0088cc]">
                                    <Send className="w-4 h-4" />
                                </span>
                                Telegram Bot
                                {channelSettings.telegramEnabled && (
                                    <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ml-1">
                                        Active
                                    </span>
                                )}
                                <div className="ml-auto flex items-center gap-2">
                                    <Label htmlFor="telegram-enabled" className="text-2xs uppercase font-bold text-gray-400">Integration Active</Label>
                                    <Switch
                                        id="telegram-enabled"
                                        data-testid="integrations-telegram-enabled"
                                        checked={channelSettings.telegramEnabled}
                                        onCheckedChange={(v) => setChannelSettings(prev => ({ ...prev, telegramEnabled: v }))}
                                    />
                                </div>
                            </CardTitle>
                            <CardDescription>Configure the Telegram Bot API credentials.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="telegram-token">Bot Token</Label>
                                <Input
                                    type="password"
                                    id="telegram-token"
                                    data-testid="integrations-telegram-token"
                                    placeholder={hasTelegramToken ? "••••••••••••••••" : "Paste your bot token here"}
                                    value={channelSettings.telegramBotToken}
                                    onChange={(e) => setChannelSettings(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="telegram-chat">Default Chat ID (Required for Testing)</Label>
                                <Input
                                    id="telegram-chat"
                                    data-testid="integrations-telegram-chat-id"
                                    placeholder="e.g. 2041972713"
                                    value={channelSettings.telegramDefaultChatId}
                                    onChange={(e) => setChannelSettings(prev => ({ ...prev, telegramDefaultChatId: e.target.value }))}
                                />
                                <p className="text-2xs text-gray-500 italic">
                                    Message your bot or use [@userinfobot](https://t.me/userinfobot) to find your ID.
                                </p>
                            </div>
                            {!channelSettings.enabled && (
                                <div className="bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5" />
                                    <p className="text-2xs text-amber-700">
                                        <strong>Note:</strong> "Enable Chat Connectors" at the top must be switched ON for this integration to function.
                                    </p>
                                </div>
                            )}

                            <div className="pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full gap-2"
                                    data-testid="integrations-telegram-test-btn"
                                    disabled={telegramTesting || !channelSettings.telegramBotToken || !channelSettings.telegramDefaultChatId}
                                    onClick={onTestTelegram}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    {telegramTesting ? 'Sending test...' : 'Send Test Notification'}
                                </Button>
                                {telegramTestResult && (
                                    <p className={`text-2xs mt-2 px-1 ${telegramTestResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                                        {telegramTestResult.message}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* WhatsApp */}
                    <Card className={`border-2 transition-all ${channelSettings.whatsappEnabled ? 'border-primary/20' : 'opacity-60 border-gray-100'}`}>
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2">
                                <span className="p-1.5 rounded-md bg-[#25D366]/10 text-[#25D366]">
                                    <MessageCircle className="w-4 h-4" />
                                </span>
                                WhatsApp (Cloud API)
                                {channelSettings.whatsappEnabled && (
                                    <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ml-1">
                                        Active
                                    </span>
                                )}
                                <div className="ml-auto flex items-center gap-2">
                                    <Label htmlFor="whatsapp-enabled" className="text-2xs uppercase font-bold text-gray-400">Integration Active</Label>
                                    <Switch
                                        id="whatsapp-enabled"
                                        data-testid="integrations-whatsapp-enabled"
                                        checked={channelSettings.whatsappEnabled}
                                        onCheckedChange={(v) => setChannelSettings(prev => ({ ...prev, whatsappEnabled: v }))}
                                    />
                                </div>
                            </CardTitle>
                            <CardDescription>Configure the Meta for Developers WhatsApp API credentials.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="whatsapp-token">System User Access Token</Label>
                                <Input
                                    type="password"
                                    id="whatsapp-token"
                                    data-testid="integrations-whatsapp-token"
                                    placeholder={hasWhatsappToken ? "••••••••••••••••" : "Paste your access token here"}
                                    value={channelSettings.whatsappAccessToken}
                                    onChange={(e) => setChannelSettings(prev => ({ ...prev, whatsappAccessToken: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="whatsapp-phone-id">Phone Number ID</Label>
                                <Input
                                    id="whatsapp-phone-id"
                                    data-testid="integrations-whatsapp-phone-id"
                                    placeholder="e.g. 10635489241578 (Numeric ID from Meta Console, not a phone number)"
                                    value={channelSettings.whatsappPhoneNumberId}
                                    onChange={(e) => setChannelSettings(prev => ({ ...prev, whatsappPhoneNumberId: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="whatsapp-recipient">Default Recipient Phone Number</Label>
                                <Input
                                    id="whatsapp-recipient"
                                    data-testid="integrations-whatsapp-recipient"
                                    placeholder="e.g. 14155552671"
                                    value={channelSettings.whatsappDefaultRecipient}
                                    onChange={(e) => setChannelSettings(prev => ({ ...prev, whatsappDefaultRecipient: e.target.value }))}
                                />
                                <p className="text-2xs text-gray-500 italic font-medium">Recipient must include country code, no + or spaces (e.g. 447123456789)</p>
                            </div>

                            <div className="pt-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full gap-2"
                                    data-testid="integrations-whatsapp-test-btn"
                                    disabled={whatsappTesting || !channelSettings.whatsappAccessToken || !channelSettings.whatsappPhoneNumberId || !channelSettings.whatsappDefaultRecipient}
                                    onClick={onTestWhatsapp}
                                >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    {whatsappTesting ? 'Sending test...' : 'Send Test Notification'}
                                </Button>
                                {whatsappTestResult && (
                                    <p className={`text-2xs mt-2 px-1 ${whatsappTestResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                                        {whatsappTestResult.message}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>
        </div>
    );
};
