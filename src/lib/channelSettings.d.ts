export interface ChannelSettings {
  enabled: boolean;
  defaultProjectRouting: 'manual' | 'last_active' | string;
  telegramBotToken: string;
  telegramDefaultChatId: string;
  whatsappAccessToken: string;
  whatsappPhoneNumberId: string;
  notes: string;
}

export const CHANNEL_SETTINGS_STORAGE_KEY: string;
export const DEFAULT_CHANNEL_SETTINGS: ChannelSettings;
export function mergeChannelSettings(raw?: Partial<ChannelSettings>): ChannelSettings;
export function loadChannelSettings(storage: Storage): ChannelSettings;
export function saveChannelSettings(storage: Storage, settings: Partial<ChannelSettings>): void;
