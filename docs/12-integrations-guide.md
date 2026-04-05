# Integrations Setup & Security Guide

This guide explains how to connect **productOS** to external communication channels like Telegram and WhatsApp, and how to stay secure while doing so.

## Telegram Integration

### 1. Create a Bot
1. Open Telegram and search for [@BotFather](https://t.me/botfather).
2. Send `/newbot` and follow the instructions to name your bot.
3. You will receive a **Bot Token** (e.g., `123456789:ABCdefGHIjklMNOpqrsTUVwxyZ`).

### 2. Get Your Chat ID
To route messages to a specific chat or group, you need its ID:
1. Message your bot or add it to a group.
2. Use a bot like [@userinfobot](https://t.me/userinfobot) to find your personal ID, or use the "Test Connection" button in productOS settings after pasting your token to see recent chat attempts.

### 3. Configuration
- **Bot Token**: Paste the token from BotFather.
- **Default Chat ID**: Enter the numeric ID where the bot should send notifications or receive inputs.

---

## WhatsApp Integration (Business API)

### 1. Setup Meta Developer Account
1. Go to the [Meta for Developers](https://developers.facebook.com/) portal.
2. Create an App (Type: Business).
3. Add the **WhatsApp** product to your app.

### 2. Get Credentials
- **Phone Number ID**: Found in the WhatsApp "Getting Started" or "Configuration" tab. This is a **numeric ID**, not your actual phone number.
- **System User Access Token**: 
    - Create a System User in your Business Manager.
    - Path: Business Settings -> Users -> System Users.
    - Generate a token with `whatsapp_business_messaging` and `whatsapp_business_management` permissions.

### 3. Verification
Ensure your WhatsApp Business Account is verified and your payment method is set if you plan to go beyond the free tier limits.

---

## Routing Rules

The **Routing Rules** section allows you to map incoming messages from specific channels to specific productOS projects. 

Currently, this is a free-text section meant for your documentation and manual mapping. 
Example format:
- `TELEGRAM:2041972713 -> Project Alpha`
- `WHATSAPP:10635489241578 -> Research Initiative`

---

## Security & Data Protection

### Local Encryption
**productOS** takes your security seriously. All API tokens and credentials are:
1. **Encrypted at rest** using AES-256-GCM.
2. **Stored locally** on your machine's filesystem.
3. **Never sent to our servers.** Your keys stay between you and the respective provider (Telegram/Meta).

### Best Practices
- **Minimum Permissions**: When generating tokens (especially for WhatsApp), only grant the minimum required scopes.
- **Rotate Regularly**: Change your Bot tokens if you suspect they have been compromised.
- **Use Secure Channels**: Only paste your tokens into the productOS settings UI. Never share them via chat or unencrypted documents.
