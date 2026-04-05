export const CHANNEL_SETTINGS_STORAGE_KEY = 'productos.channelSettings.v1';

export const DEFAULT_CHANNEL_SETTINGS = {
  enabled: false,
  telegramEnabled: false,
  whatsappEnabled: false,
  defaultProjectRouting: 'manual',
  telegramBotToken: '',
  telegramDefaultChatId: '',
  whatsappAccessToken: '',
  whatsappPhoneNumberId: '',
  whatsappDefaultRecipient: '',
  notes: '',
};

// Fields that contain secrets and should NOT be persisted to localStorage.
const SECRET_FIELDS = ['telegramBotToken', 'whatsappAccessToken'];

export function mergeChannelSettings(raw = {}) {
  return { ...DEFAULT_CHANNEL_SETTINGS, ...(raw || {}) };
}

/**
 * Strip secret fields before writing to storage.
 * This ensures tokens are never leaked into browser localStorage.
 */
export function stripSecrets(settings) {
  const copy = { ...settings };
  for (const field of SECRET_FIELDS) {
    delete copy[field];
  }
  return copy;
}

export function loadChannelSettings(storage) {
  try {
    const raw = storage.getItem(CHANNEL_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CHANNEL_SETTINGS };
    const parsed = mergeChannelSettings(JSON.parse(raw));
    // Ensure any legacy data with secrets baked in gets them wiped
    for (const field of SECRET_FIELDS) {
      parsed[field] = '';
    }
    return parsed;
  } catch {
    return { ...DEFAULT_CHANNEL_SETTINGS };
  }
}

export function saveChannelSettings(storage, settings) {
  const safePayload = stripSecrets(mergeChannelSettings(settings));
  storage.setItem(CHANNEL_SETTINGS_STORAGE_KEY, JSON.stringify(safePayload));
}
