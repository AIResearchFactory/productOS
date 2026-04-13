// AES-256-GCM Vault using Web Crypto API

const VAULT_KEY = 'productOS.vault.v1';

export interface VaultFormat {
    salt: string; // base64
    iv: string;   // base64
    ciphertext: string; // base64
    version: '1.0';
}

// Convert string/base64 logic
const buf2b64 = (buffer: ArrayBufferLike) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};
const b642buf = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;

let sessionKey: CryptoKey | null = null;
let currentSecrets: Record<string, string> = {};

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt as any,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export const isVaultConfigured = (): boolean => {
    return !!localStorage.getItem(VAULT_KEY);
};

export const setupVault = async (password: string) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    sessionKey = await deriveKey(password, salt);
    currentSecrets = {};
    await saveVaultData(salt);
};

export const unlockVault = async (password: string): Promise<boolean> => {
    const stored = localStorage.getItem(VAULT_KEY);
    if (!stored) return false;
    try {
        const vault: VaultFormat = JSON.parse(stored);
        const salt = b642buf(vault.salt);
        const iv = b642buf(vault.iv);
        const ciphertext = b642buf(vault.ciphertext);
        
        const key = await deriveKey(password, new Uint8Array(salt));
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(iv) },
            key,
            ciphertext
        );
        
        const dec = new TextDecoder();
        currentSecrets = JSON.parse(dec.decode(decrypted));
        sessionKey = key;
        return true;
    } catch (e) {
        console.error("Vault unlock failed", e);
        return false;
    }
};

export const isVaultUnlocked = (): boolean => {
    return sessionKey !== null;
};

const saveVaultData = async (salt: Uint8Array) => {
    if (!sessionKey) throw new Error("Vault not unlocked");
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const data = enc.encode(JSON.stringify(currentSecrets));
    
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        sessionKey,
        data
    );
    
    const vault: VaultFormat = {
        salt: buf2b64(salt.buffer),
        iv: buf2b64(iv.buffer),
        ciphertext: buf2b64(ciphertext),
        version: '1.0'
    };
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
};

export const saveSecretToVault = async (id: string, value: string) => {
    if (!sessionKey) throw new Error("Vault disabled or locked");
    
    const stored = localStorage.getItem(VAULT_KEY);
    if (!stored) throw new Error("Vault not configured");
    
    const vault: VaultFormat = JSON.parse(stored);
    currentSecrets[id] = value;
    
    await saveVaultData(new Uint8Array(b642buf(vault.salt)));
};

export const getSecretFromVault = (id: string): string | null => {
    if (!sessionKey) throw new Error("Vault disabled or locked");
    return id in currentSecrets ? currentSecrets[id] : null;
};

export const listVaultSecrets = (): string[] => {
    if (!sessionKey) return []; // failsafe
    return Object.keys(currentSecrets);
};
