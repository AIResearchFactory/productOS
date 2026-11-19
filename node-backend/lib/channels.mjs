import fs from 'node:fs/promises';
import path from 'node:path';

export class ChannelService {
  static async sendNotification(projectId, message, settings) {
    const config = settings.channelConfig || {};
    if (!config.enabled) return;

    if (config.telegramEnabled && config.telegramDefaultChatId) {
        await this.sendTelegram(message, config.telegramDefaultChatId, settings.secrets?.TELEGRAM_TOKEN);
    }

    if (config.whatsappEnabled && config.whatsappDefaultRecipient) {
        await this.sendWhatsapp(message, config.whatsappDefaultRecipient, settings.secrets?.WHATSAPP_TOKEN);
    }
  }

  static async sendTelegram(message, chatId, token) {
    if (!token || typeof token !== 'string') return;
    const cleanToken = token.trim();
    if (!/^[0-9]{5,20}:[A-Za-z0-9_-]{20,}$/.test(cleanToken)) {
      console.error('[ChannelService] Invalid Telegram bot token format');
      return;
    }
    const url = `https://api.telegram.org/bot${cleanToken}/sendMessage`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
    } catch (error) {
      console.error('[ChannelService] Telegram failed:', error.message);
    }
  }

  static async sendWhatsapp(message, recipient, token) {
    // Basic implementation for WhatsApp Business API
    if (!token) return;
    // ... logic for WhatsApp ...
  }
}
