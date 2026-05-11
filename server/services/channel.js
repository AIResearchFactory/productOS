import { getSecret } from './secrets.js';
import { loadGlobalSettings } from './settings.js';

export async function testTelegramConnection(botToken) {
  let token = botToken;
  if (!token || token.startsWith('•')) {
    const settings = loadGlobalSettings();
    if (!settings.channelConfig?.enabled || !settings.channelConfig?.telegramEnabled) {
      throw new Error('Telegram integration is not enabled');
    }
    token = await getSecret('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('No Telegram bot token found');
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const body = await res.text();
  if (!res.ok) throw new Error(`Telegram API returned HTTP ${res.status}: ${body}`);
  
  const raw = JSON.parse(body);
  if (!raw.ok) throw new Error(`Telegram API error: ${raw.description || 'Unknown'}`);

  return {
    ok: true,
    description: null,
    username: raw.result?.username,
    firstName: raw.result?.first_name
  };
}

export async function sendTelegramMessage(botToken, chatId, text) {
  let token = botToken;
  if (!token || token.startsWith('•')) {
    const settings = loadGlobalSettings();
    if (!settings.channelConfig?.enabled || !settings.channelConfig?.telegramEnabled) {
      throw new Error('Telegram integration is not enabled');
    }
    token = await getSecret('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('No Telegram bot token found');
  }

  if (!chatId) throw new Error('Chat ID cannot be empty');
  if (!text) throw new Error('Message text cannot be empty');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Telegram API returned HTTP ${res.status}: ${body}`);

  return 'Message sent successfully';
}

export async function testWhatsAppConnection(accessToken, phoneNumberId) {
  const settings = loadGlobalSettings();
  const config = settings.channelConfig || {};

  let token = accessToken;
  if (!token || token.startsWith('•')) {
    token = await getSecret('WHATSAPP_ACCESS_TOKEN');
    if (!token) throw new Error('No WhatsApp access token found');
  }

  const pid = phoneNumberId || config.whatsappPhoneNumberId;
  if (!pid) throw new Error('WhatsApp Phone Number ID is not configured');

  const res = await fetch(`https://graph.facebook.com/v17.0/${pid}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`WhatsApp API (Meta) returned HTTP ${res.status}: ${body}`);

  const raw = JSON.parse(body);
  return {
    ok: true,
    displayPhoneNumber: raw.display_phone_number,
    verifiedName: raw.verified_name,
    id: raw.id
  };
}

export async function sendWhatsAppMessage(accessToken, phoneNumberId, recipientPhone, text) {
  const settings = loadGlobalSettings();
  const config = settings.channelConfig || {};

  let token = accessToken;
  if (!token || token.startsWith('•')) {
    token = await getSecret('WHATSAPP_ACCESS_TOKEN');
    if (!token) throw new Error('No WhatsApp access token found');
  }

  const pid = phoneNumberId || config.whatsappPhoneNumberId;
  if (!pid) throw new Error('WhatsApp Phone Number ID is not configured');

  if (!recipientPhone) throw new Error('Recipient phone number cannot be empty');

  const res = await fetch(`https://graph.facebook.com/v17.0/${pid}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'text',
      text: { body: text }
    })
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`WhatsApp API returned HTTP ${res.status}: ${body}`);

  return 'WhatsApp message sent successfully';
}

export async function sendNotification(message) {
  const settings = loadGlobalSettings();
  const config = settings.channelConfig || {};

  if (!config.enabled) return;

  if (config.telegramEnabled && config.telegramDefaultChatId) {
    try {
      await sendTelegramMessage(null, config.telegramDefaultChatId, message);
    } catch (e) { console.error('Failed to send Telegram notification:', e.message); }
  }

  if (config.whatsappEnabled && config.whatsappPhoneNumberId && config.whatsappDefaultRecipient) {
    try {
      await sendWhatsAppMessage(null, null, config.whatsappDefaultRecipient, message);
    } catch (e) { console.error('Failed to send WhatsApp notification:', e.message); }
  }
}
