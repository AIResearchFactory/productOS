import fs from 'fs';
import path from 'path';
import { getSecretsPath } from './paths.js';
import { encrypt, decrypt } from './encryption.js';

/**
 * Port of Rust SecretsService.
 * Manages encrypted secrets stored in secrets.encrypted.json.
 */

function defaultSecrets() {
  return {
    claude_api_key: null,
    gemini_api_key: null,
    n8n_webhook_url: null,
    custom_api_keys: {}
  };
}

/**
 * Load secrets from secrets.encrypted.json.
 */
export async function loadSecrets() {
  const secretsPath = getSecretsPath();
  if (!fs.existsSync(secretsPath)) return defaultSecrets();

  try {
    const content = fs.readFileSync(secretsPath, 'utf-8');
    return await parseEncryptedSecrets(content);
  } catch (e) {
    console.warn(`[secrets] Could not parse or decrypt existing secrets: ${e.message}. Proceeding with fresh secrets.`);
    return defaultSecrets();
  }
}

/**
 * Parse secrets from encrypted JSON.
 */
async function parseEncryptedSecrets(content) {
  const wrapper = JSON.parse(content);
  const encryptedData = wrapper.encrypted_data;
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Invalid secrets file structure');
  }
  const decryptedJson = await decrypt(encryptedData);
  return { ...defaultSecrets(), ...JSON.parse(decryptedJson) };
}

/**
 * Format secrets as encrypted JSON content.
 */
async function formatEncryptedSecrets(secrets) {
  const jsonData = JSON.stringify(secrets);
  const encryptedData = await encrypt(jsonData);
  const wrapper = {
    encrypted: true,
    version: '1.0.0',
    last_updated: new Date().toISOString(),
    encrypted_data: encryptedData
  };
  return JSON.stringify(wrapper, null, 2);
}

/**
 * Save secrets to secrets.encrypted.json.
 */
export async function saveSecrets(newSecrets) {
  const secretsPath = getSecretsPath();
  let secrets = await loadSecrets();

  // Merge: only overwrite fields that are provided
  if (newSecrets.claude_api_key !== undefined) secrets.claude_api_key = newSecrets.claude_api_key;
  if (newSecrets.gemini_api_key !== undefined) secrets.gemini_api_key = newSecrets.gemini_api_key;
  if (newSecrets.n8n_webhook_url !== undefined) secrets.n8n_webhook_url = newSecrets.n8n_webhook_url;
  if (newSecrets.custom_api_keys) {
    for (const [key, value] of Object.entries(newSecrets.custom_api_keys)) {
      secrets.custom_api_keys[key] = value;
    }
  }

  // Ensure directory exists
  fs.mkdirSync(path.dirname(secretsPath), { recursive: true });
  const content = await formatEncryptedSecrets(secrets);
  fs.writeFileSync(secretsPath, content, 'utf-8');
}

/**
 * Get a secret by its ID.
 */
export async function getSecret(id) {
  const secrets = await loadSecrets();

  if (id === 'claude_api_key' || id === 'ANTHROPIC_API_KEY') return secrets.claude_api_key || null;
  if (id === 'gemini_api_key' || id === 'GEMINI_API_KEY') return secrets.gemini_api_key || null;
  if (id === 'n8n_webhook_url') return secrets.n8n_webhook_url || null;

  return secrets.custom_api_keys[id] || null;
}

/**
 * Check if a secret exists.
 */
export async function hasSecret(id) {
  const value = await getSecret(id);
  return value !== null && value !== undefined;
}

/**
 * Set a secret by its ID.
 */
export async function setSecret(id, value) {
  const secrets = await loadSecrets();

  if (id === 'claude_api_key' || id === 'ANTHROPIC_API_KEY') {
    secrets.claude_api_key = value;
  } else if (id === 'gemini_api_key' || id === 'GEMINI_API_KEY') {
    secrets.gemini_api_key = value;
  } else if (id === 'n8n_webhook_url') {
    secrets.n8n_webhook_url = value;
  } else {
    secrets.custom_api_keys[id] = value;
  }

  const secretsPath = getSecretsPath();
  fs.mkdirSync(path.dirname(secretsPath), { recursive: true });
  const content = await formatEncryptedSecrets(secrets);
  fs.writeFileSync(secretsPath, content, 'utf-8');
}

/**
 * List saved secret IDs without returning values.
 */
export async function listSavedSecretIds() {
  const secrets = await loadSecrets();
  const ids = [];

  if (secrets.claude_api_key) { ids.push('claude_api_key', 'ANTHROPIC_API_KEY'); }
  if (secrets.gemini_api_key) { ids.push('gemini_api_key', 'GEMINI_API_KEY'); }
  if (secrets.n8n_webhook_url) { ids.push('n8n_webhook_url'); }
  for (const key of Object.keys(secrets.custom_api_keys)) {
    ids.push(key);
  }

  return [...new Set(ids)].sort();
}

/**
 * Export all secrets (used for backup).
 */
export async function exportSecrets() {
  return loadSecrets();
}
