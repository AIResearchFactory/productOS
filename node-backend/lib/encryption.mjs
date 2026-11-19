import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const APP_NAME = 'productos';
const MASTER_KEY_NAME = 'master_encryption_key';
const KEY_LENGTH_BYTES = 32;

let sessionKey = null;

function decodeMasterKey(rawBase64) {
  const cleaned = String(rawBase64 || '').trim();
  if (!cleaned) return null;
  const buf = Buffer.from(cleaned, 'base64');
  if (buf.length !== KEY_LENGTH_BYTES) {
    console.warn(`[EncryptionService] Ignoring malformed master key with byte length ${buf.length}`);
    return null;
  }
  return buf;
}

function writeSecretFileSync(keyBase64) {
  const keyFile = path.join(os.homedir(), '.productos_key');
  fsSync.writeFileSync(keyFile, keyBase64, { encoding: 'utf8', mode: 0o600 });
}

function loadKeyFromFileSync() {
  try {
    const keyFile = path.join(os.homedir(), '.productos_key');
    return decodeMasterKey(fsSync.readFileSync(keyFile, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Try to load the key using the OS-native secret store without shell interpolation.
 */
async function tryLoadKeyFromStore() {
  let transientError = false;
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await execFileAsync(
        'security',
        ['find-generic-password', '-s', APP_NAME, '-a', MASTER_KEY_NAME, '-w'],
        { encoding: 'utf8', timeout: 5000 }
      );
      const key = decodeMasterKey(stdout);
      if (key) return { key, transientError: false };
    } catch (err) {
      if (err?.killed || err?.code === 'ETIMEDOUT') {
        console.warn('[EncryptionService] Keychain lookup timed out');
        transientError = true;
      }
    }
  }

  if (process.platform === 'linux') {
    try {
      const { stdout } = await execFileAsync(
        'secret-tool',
        ['lookup', 'application', APP_NAME, 'key', MASTER_KEY_NAME],
        { encoding: 'utf8', timeout: 5000 }
      );
      const key = decodeMasterKey(stdout);
      if (key) return { key, transientError: false };
    } catch (err) {
      if (err?.killed || err?.code === 'ETIMEDOUT') {
        console.warn('[EncryptionService] Secret-tool lookup timed out');
        transientError = true;
      }
    }
  }

  if (process.platform === 'win32') {
    try {
      const ps = `[System.Net.NetworkCredential]::new('', (Get-StoredCredential -Target '${APP_NAME}/${MASTER_KEY_NAME}').Password).Password`;
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', ps],
        { encoding: 'utf8', timeout: 5000 }
      );
      const key = decodeMasterKey(stdout);
      if (key) return { key, transientError: false };
    } catch (err) {
      if (err?.killed || err?.code === 'ETIMEDOUT') {
        console.warn('[EncryptionService] Windows Credential lookup timed out');
        transientError = true;
      }
    }
  }

  return { key: null, transientError };
}

async function trySaveKeyToStore(keyBase64) {
  try {
    if (process.platform === 'darwin') {
      // Pass command via stdin (`security -i`) so the secret does not appear in process argv
      const interactiveCmd = `add-generic-password -s "${APP_NAME}" -a "${MASTER_KEY_NAME}" -w "${keyBase64}" -U\n`;
      execFileSync('security', ['-i'], {
        input: interactiveCmd,
        encoding: 'utf8',
        stdio: ['pipe', 'ignore', 'ignore'],
        timeout: 10000,
      });
      return;
    }
    if (process.platform === 'linux') {
      execFileSync(
        'secret-tool',
        ['store', `--label=${APP_NAME}`, 'application', APP_NAME, 'key', MASTER_KEY_NAME],
        {
          input: keyBase64,
          encoding: 'utf8',
          stdio: ['pipe', 'ignore', 'ignore'],
          timeout: 10000,
        }
      );
      return;
    }
    if (process.platform === 'win32') {
      const ps = `New-StoredCredential -Target '${APP_NAME}/${MASTER_KEY_NAME}' -UserName '${APP_NAME}' -Password $env:PRODUCTOS_KEY_B64 -Persist LocalMachine`;
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], {
        env: { ...process.env, PRODUCTOS_KEY_B64: keyBase64 },
        stdio: 'ignore',
        timeout: 10000,
      });
      return;
    }
  } catch {
    // Fall back to user-only key file
  }

  try {
    const keyFile = path.join(os.homedir(), '.productos_key');
    await fs.writeFile(keyFile, keyBase64, { mode: 0o600 });
  } catch {
    console.error('[EncryptionService] Failed to store master key in keychain, falling back to session-only key.');
  }
}

async function tryLoadKeyFromFile() {
  try {
    const keyFile = path.join(os.homedir(), '.productos_key');
    const raw = await fs.readFile(keyFile, 'utf8');
    return decodeMasterKey(raw);
  } catch {
    return null;
  }
}

export class EncryptionService {
  static async initAsync() {
    if (sessionKey) return;

    if (process.env.NODE_ENV === 'test') {
      sessionKey = Buffer.from('test-key-padding-to-32-bytes-0000'.slice(0, 32));
      return;
    }

    // 1. Try OS keychain
    const { key: storeKey, transientError } = await tryLoadKeyFromStore();
    if (storeKey) { sessionKey = storeKey; return; }

    // 2. Try file fallback
    const fileKey = await tryLoadKeyFromFile();
    if (fileKey) { sessionKey = fileKey; return; }

    // Avoid overwriting an existing keychain entry on a transient read error
    const newKey = crypto.randomBytes(KEY_LENGTH_BYTES);
    sessionKey = newKey;
    if (!transientError) {
      await trySaveKeyToStore(newKey.toString('base64'));
    }
  }

  static getOrCreateMasterKey() {
    if (sessionKey) return sessionKey;

    if (process.env.NODE_ENV === 'test') {
      sessionKey = Buffer.from('test-key-padding-to-32-bytes-0000'.slice(0, 32));
      return sessionKey;
    }

    let transientError = false;

    // Synchronous store lookup before falling back
    if (process.platform === 'darwin') {
      try {
        const output = execFileSync(
          'security',
          ['find-generic-password', '-s', APP_NAME, '-a', MASTER_KEY_NAME, '-w'],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }
        );
        const key = decodeMasterKey(output);
        if (key) {
          sessionKey = key;
          return sessionKey;
        }
      } catch (err) {
        if (err?.killed || err?.code === 'ETIMEDOUT') {
          console.warn('[EncryptionService] Sync keychain lookup timed out');
          transientError = true;
        }
      }
    } else if (process.platform === 'linux') {
      try {
        const output = execFileSync(
          'secret-tool',
          ['lookup', 'application', APP_NAME, 'key', MASTER_KEY_NAME],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }
        );
        const key = decodeMasterKey(output);
        if (key) {
          sessionKey = key;
          return sessionKey;
        }
      } catch (err) {
        if (err?.killed || err?.code === 'ETIMEDOUT') {
          transientError = true;
        }
      }
    }

    // Sync key file fallback
    const fileKey = loadKeyFromFileSync();
    if (fileKey) {
      sessionKey = fileKey;
      return sessionKey;
    }

    const newKey = crypto.randomBytes(KEY_LENGTH_BYTES);
    sessionKey = newKey;
    if (!transientError) {
      try {
        writeSecretFileSync(newKey.toString('base64'));
      } catch {}
      trySaveKeyToStore(newKey.toString('base64')).catch(() => {});
    }
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
