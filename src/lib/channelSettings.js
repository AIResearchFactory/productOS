export const CHANNEL_SETTINGS_STORAGE_KEY = 'productos.channelSettings.v1';

export const DEFAULT_CHANNEL_SETTINGS = {
  enabled: false,
  defaultProjectRouting: 'manual',
  telegramBotToken: '',
  telegramDefaultChatId: '',
  whatsappAccessToken: '',
  whatsappPhoneNumberId: '',
  notes: '',
};

export function mergeChannelSettings(raw = {}) {
  return { ...DEFAULT_CHANNEL_SETTINGS, ...(raw || {}) };
}

export function loadChannelSettings(storage) {
  try {
    const raw = storage.getItem(CHANNEL_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CHANNEL_SETTINGS };
    return mergeChannelSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_CHANNEL_SETTINGS };
  }
}

export function saveChannelSettings(storage, settings) {
  storage.setItem(CHANNEL_SETTINGS_STORAGE_KEY, JSON.stringify(mergeChannelSettings(settings)));
}
