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
    if (!token) return;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
