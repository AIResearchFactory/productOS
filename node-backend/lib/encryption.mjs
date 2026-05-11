import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const APP_NAME = 'productos';
const MASTER_KEY_NAME = 'master_encryption_key';

let sessionKey = null;

/**
 * Try to persist the key using the OS-native secret store.
 * Gracefully falls back to a session-only key on failure or
 * on platforms where no keychain command is available.
 */
async function tryLoadKeyFromStore() {
  if (process.platform === 'darwin') {
    try {
      const output = execSync(
        `security find-generic-password -s "${APP_NAME}" -a "${MASTER_KEY_NAME}" -w`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }
      ).trim();
      if (output) return Buffer.from(output, 'base64');
    } catch (err) {
      if (err.code === 'ETIMEDOUT') console.warn('[EncryptionService] Keychain lookup timed out');
    }
  }

  if (process.platform === 'linux') {
    try {
      const output = execSync(
        `secret-tool lookup application "${APP_NAME}" key "${MASTER_KEY_NAME}"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }
      ).trim();
      if (output) return Buffer.from(output, 'base64');
    } catch (err) {
      if (err.code === 'ETIMEDOUT') console.warn('[EncryptionService] Secret-tool lookup timed out');
    }
  }

  if (process.platform === 'win32') {
    try {
      const ps = `[System.Net.NetworkCredential]::new('', (Get-StoredCredential -Target '${APP_NAME}/${MASTER_KEY_NAME}').Password).Password`;
      const output = execSync(`powershell -Command "${ps}"`, {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000
      }).trim();
      if (output) return Buffer.from(output, 'base64');
    } catch (err) {
      if (err.code === 'ETIMEDOUT') console.warn('[EncryptionService] Windows Credential lookup timed out');
    }
  }

  return null;
}

async function trySaveKeyToStore(keyBase64) {
  try {
    if (process.platform === 'darwin') {
      execSync(
        `security add-generic-password -s "${APP_NAME}" -a "${MASTER_KEY_NAME}" -w "${keyBase64}" -U`,
        { stdio: 'ignore' }
      );
      return;
    }
    if (process.platform === 'linux') {
      execSync(
        `echo -n "${keyBase64}" | secret-tool store --label="${APP_NAME}" application "${APP_NAME}" key "${MASTER_KEY_NAME}"`,
        { stdio: 'ignore' }
      );
      return;
    }
    if (process.platform === 'win32') {
      execSync(
        `powershell -Command "New-StoredCredential -Target '${APP_NAME}/${MASTER_KEY_NAME}' -UserName '${APP_NAME}' -Password '${keyBase64}' -Persist LocalMachine"`,
        { stdio: 'ignore' }
      );
      return;
    }
  } catch {
    // Fallback: persist to a key file in the user's home dir
    try {
      const keyFile = path.join(os.homedir(), '.productos_key');
      await fs.writeFile(keyFile, keyBase64, { mode: 0o600 });
    } catch {
      console.error('[EncryptionService] Failed to store master key in keychain, falling back to session-only key.');
    }
  }
}

async function tryLoadKeyFromFile() {
  try {
    const keyFile = path.join(os.homedir(), '.productos_key');
    const raw = await fs.readFile(keyFile, 'utf8');
    if (raw.trim()) return Buffer.from(raw.trim(), 'base64');
  } catch { /* not found */ }
  return null;
}

export class EncryptionService {
  static async initAsync() {
    if (sessionKey) return;

    if (process.env.NODE_ENV === 'test') {
      sessionKey = Buffer.from('test-key-padding-to-32-bytes-0000'.slice(0, 32));
      return;
    }

    // 1. Try OS keychain
    let key = await tryLoadKeyFromStore();
    if (key) { sessionKey = key; return; }

    // 2. Try file fallback
    key = await tryLoadKeyFromFile();
    if (key) { sessionKey = key; return; }

    // 3. Generate new key and persist it
    const newKey = crypto.randomBytes(32);
    const keyBase64 = newKey.toString('base64');
    await trySaveKeyToStore(keyBase64);
    sessionKey = newKey;
  }

  static getOrCreateMasterKey() {
    if (sessionKey) return sessionKey;

    if (process.env.NODE_ENV === 'test') {
      sessionKey = Buffer.from('test-key-padding-to-32-bytes-0000'.slice(0, 32));
      return sessionKey;
    }

    // Synchronous fallback path — used before async init completes
    if (process.platform === 'darwin') {
      try {
        const output = execSync(
          `security find-generic-password -s "${APP_NAME}" -a "${MASTER_KEY_NAME}" -w`,
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }
        ).trim();
        if (output) {
          sessionKey = Buffer.from(output, 'base64');
          return sessionKey;
        }
      } catch (err) {
        if (err.code === 'ETIMEDOUT') console.warn('[EncryptionService] Sync keychain lookup timed out');
      }
    }

    // Generate and cache session-only key
    const newKey = crypto.randomBytes(32);
    sessionKey = newKey;
    // Fire-and-forget persist
    trySaveKeyToStore(newKey.toString('base64')).catch(() => {});
    return sessionKey;
  }

  static encrypt(data) {
    const key = this.getOrCreateMasterKey();
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);

    let ciphertext = cipher.update(data, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const tag = cipher.getAuthTag();

    const combined = Buffer.concat([nonce, ciphertext, tag]);
    return combined.toString('base64');
  }

  static decrypt(encryptedData) {
    const key = this.getOrCreateMasterKey();
    const combined = Buffer.from(encryptedData, 'base64');

    if (combined.length < 28) {
      throw new Error('Invalid encrypted data: too short');
    }

    const nonce = combined.subarray(0, 12);
    const tag = combined.subarray(combined.length - 16);
    const ciphertext = combined.subarray(12, combined.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
