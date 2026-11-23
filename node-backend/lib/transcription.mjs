import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { checkCli, resolveCliCommand, getEnhancedEnv } from './system.mjs';
import { spawnCli } from './providers/base.mjs';

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
export const ALLOWED_AUDIO_MIMES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/x-m4a',
  'audio/m4a',
]);

function normalizeAudioMime(rawMime) {
  const base = String(rawMime || '').split(';')[0].trim().toLowerCase();
  if (base === 'audio/mp3') return 'audio/mpeg';
  if (base === 'audio/wave' || base === 'audio/x-wav') return 'audio/wav';
  if (base === 'audio/m4a' || base === 'audio/x-m4a') return 'audio/mp4';
  return base;
}

function extensionForAudioMime(mime) {
  switch (mime) {
    case 'audio/webm':
      return '.webm';
    case 'audio/mp4':
      return '.m4a';
    case 'audio/mpeg':
      return '.mp3';
    case 'audio/wav':
      return '.wav';
    case 'audio/ogg':
      return '.ogg';
    default:
      return '.webm';
  }
}

function getOpenAiKey(settings = {}, secrets = {}) {
  const openAiSecretId = settings?.openAiCli?.apiKeySecretId || 'openai_api_key';
  const hostedSecretId = settings?.hosted?.apiKeySecretId;
  const hostedIsOpenAi =
    String(settings?.hosted?.provider || '').toLowerCase() === 'openai' ||
    String(settings?.hosted?.api_url || settings?.hosted?.baseUrl || '').toLowerCase().includes('openai');

  return (
    secrets[openAiSecretId] ||
    secrets.OPENAI_API_KEY ||
    secrets.openai_api_key ||
    secrets.OPENAI_OAUTH_ACCESS_TOKEN ||
    (hostedIsOpenAi && hostedSecretId ? secrets[hostedSecretId] : null) ||
    (hostedIsOpenAi ? settings?.hosted?.api_key : null) ||
    ''
  ).trim();
}

function getGeminiKey(settings = {}, secrets = {}) {
  const geminiSecretId = settings?.geminiCli?.apiKeySecretId || 'gemini_api_key';
  return (
    secrets[geminiSecretId] ||
    secrets.GEMINI_API_KEY ||
    secrets.gemini_api_key ||
    secrets.GOOGLE_API_KEY ||
    ''
  ).trim();
}

/**
 * Inspect configured API keys and CLIs to report available fallback STT providers.
 *
 * @param {object} [settings]
 * @param {object} [secrets]
 * @param {{ checkCliFn?: Function, resolveCliFn?: Function }} [deps]
 */
export async function getVoiceCapabilities(settings = {}, secrets = {}, deps = {}) {
  const checkCliFn = deps.checkCliFn || checkCli;
  const resolveCliFn = deps.resolveCliFn || resolveCliCommand;

  const hasOpenAiKey = Boolean(getOpenAiKey(settings, secrets));
  const hasGeminiKey = Boolean(getGeminiKey(settings, secrets));

  const [geminiCliStatus, whisperStatus] = await Promise.all([
    hasGeminiKey ? Promise.resolve({ installed: true }) : resolveCliFn('agy', 'gemini').catch(() => ({ installed: false })),
    checkCliFn('whisper').catch(() => ({ installed: false })),
  ]);

  const fallbackProviders = {
    openAi: hasOpenAiKey,
    gemini: hasGeminiKey || Boolean(geminiCliStatus?.installed),
    localWhisper: Boolean(whisperStatus?.installed),
  };

  const availableProviders = Object.entries(fallbackProviders)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);

  const configuredFallback = settings?.voiceInput?.fallbackProvider || 'auto';
  let resolvedFallback = null;
  if (configuredFallback === 'none') {
    resolvedFallback = null;
  } else if (configuredFallback !== 'auto') {
    resolvedFallback = fallbackProviders[configuredFallback] ? configuredFallback : null;
  } else {
    resolvedFallback =
      (fallbackProviders.openAi && 'openAi') ||
      (fallbackProviders.gemini && 'gemini') ||
      (fallbackProviders.localWhisper && 'localWhisper') ||
      null;
  }

  return {
    fallbackProviders,
    availableProviders,
    configuredFallback,
    resolvedFallback,
  };
}

function shortLanguageCode(language) {
  if (!language || typeof language !== 'string') return '';
  const clean = language.trim().split(/[-_]/)[0].toLowerCase();
  return /^[a-z]{2,3}$/.test(clean) ? clean : '';
}

async function transcribeWithOpenAi({ audioBuffer, mimeType, language, apiKey, fetchFn }) {
  const ext = extensionForAudioMime(mimeType);
  const langCode = shortLanguageCode(language);
  const modelsToTry = ['gpt-4o-mini-transcribe', 'whisper-1'];
  let lastError = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: mimeType }), `recording${ext}`);
    form.append('model', model);
    if (langCode) {
      form.append('language', langCode);
    }

    const res = await fetchFn('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: AbortSignal.timeout(60000),
    });

    if (res.ok) {
      const data = await res.json();
      const text = typeof data?.text === 'string' ? data.text.trim() : '';
      return { text, provider: 'openAi' };
    }

    const errText = await res.text().catch(() => '');
    lastError = new Error(`OpenAI transcription error (${res.status}): ${errText}`);
    if ((res.status === 400 || res.status === 404) && i === 0) {
      continue;
    }
    break;
  }

  const err = lastError || new Error('OpenAI transcription failed');
  err.statusCode = 502;
  throw err;
}

async function transcribeWithGeminiApi({ audioBuffer, mimeType, language, apiKey, fetchFn }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const langHint = language ? ` Language hint: ${language}.` : '';
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Transcribe this spoken audio accurately into plain text. Return ONLY the verbatim transcription with no commentary or quotes.${langHint}`,
          },
          {
            inlineData: {
              mimeType,
              data: audioBuffer.toString('base64'),
            },
          },
        ],
      },
    ],
  };

  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`Gemini transcription error (${res.status}): ${errText}`);
    err.statusCode = 502;
    throw err;
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();

  return { text, provider: 'gemini' };
}

async function runCliCapture(spawnFn, command, args, env) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    let stdout = '';
    let stderr = '';

    try {
      const child = spawnCli(spawnFn, command, args, { env, signal: controller.signal });
      child.stdout?.on('data', (d) => { stdout += d.toString(); });
      child.stderr?.on('data', (d) => { stderr += d.toString(); });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const err = new Error(`${path.basename(command)} exited with code ${code}: ${stderr.trim()}`);
          err.statusCode = 502;
          reject(err);
        } else {
          resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        }
      });
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

async function transcribeWithGeminiCli({ audioBuffer, mimeType, language, cliPath, spawnFn }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productos-stt-gemini-'));
  const ext = extensionForAudioMime(mimeType);
  const audioFile = path.join(tempDir, `recording${ext}`);
  const isAgy = path.basename(cliPath).toLowerCase().includes('agy');
  const langHint = language ? ` Language hint: ${language}.` : '';
  const prompt = `Transcribe the spoken message in audio file "${audioFile}" accurately into plain text. Return ONLY the verbatim transcript text.${langHint}`;

  try {
    await fs.writeFile(audioFile, audioBuffer, { mode: 0o600 });
    const args = ['--prompt', prompt, '--output-format', 'text', '--dangerously-skip-permissions'];
    if (isAgy) {
      args.push('--add-dir', tempDir);
    }
    const { stdout } = await runCliCapture(spawnFn, cliPath, args, getEnhancedEnv());
    return { text: stdout, provider: 'gemini' };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function transcribeWithWhisperCli({ audioBuffer, mimeType, language, whisperPath, spawnFn }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productos-stt-whisper-'));
  const ext = extensionForAudioMime(mimeType);
  const audioFile = path.join(tempDir, `recording${ext}`);

  try {
    await fs.writeFile(audioFile, audioBuffer, { mode: 0o600 });
    const args = [audioFile, '--output_format', 'txt', '--output_dir', tempDir];
    const langCode = shortLanguageCode(language);
    if (langCode) {
      args.push('--language', langCode);
    }

    await runCliCapture(spawnFn, whisperPath, args, getEnhancedEnv());
    const txtPath = path.join(tempDir, 'recording.txt');
    const text = (await fs.readFile(txtPath, 'utf8')).trim();
    return { text, provider: 'localWhisper' };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Transcribe spoken audio strictly in-memory (or ephemeral temp file deleted in finally for CLIs).
 * Never writes permanent audio files to disk.
 *
 * @param {object} params
 * @returns {Promise<{ text: string, provider: string }>}
 */
export async function transcribeAudio({
  audioBase64,
  mimeType,
  language = '',
  preferredProvider = '',
  settings = {},
  secrets = {},
  fetchFn = fetch,
  spawnFn = spawn,
  checkCliFn = checkCli,
  resolveCliFn = resolveCliCommand,
}) {
  if (typeof audioBase64 !== 'string' || !audioBase64.trim()) {
    const err = new Error('audioBase64 is required');
    err.statusCode = 400;
    throw err;
  }

  const strippedBase64 = audioBase64.trim().replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(strippedBase64)) {
    const err = new Error('Invalid base64 audio payload');
    err.statusCode = 400;
    throw err;
  }

  const normalizedMime = normalizeAudioMime(mimeType || 'audio/webm');
  if (!ALLOWED_AUDIO_MIMES.has(normalizedMime)) {
    const err = new Error(`Unsupported audio format: ${normalizedMime || 'unknown'}`);
    err.statusCode = 400;
    throw err;
  }

  const audioBuffer = Buffer.from(strippedBase64, 'base64');
  if (audioBuffer.length === 0) {
    const err = new Error('Audio recording is empty');
    err.statusCode = 400;
    throw err;
  }
  if (audioBuffer.length > MAX_AUDIO_BYTES) {
    const err = new Error(`Audio recording exceeds maximum size of ${MAX_AUDIO_BYTES / (1024 * 1024)} MB`);
    err.statusCode = 400;
    throw err;
  }

  const effectiveSettings = preferredProvider
    ? { ...settings, voiceInput: { ...(settings?.voiceInput || {}), fallbackProvider: preferredProvider } }
    : settings;

  const capabilities = await getVoiceCapabilities(effectiveSettings, secrets, { checkCliFn, resolveCliFn });
  const chosen = capabilities.resolvedFallback;

  if (!chosen) {
    const err = new Error(
      'No transcription provider is configured. Use Chrome Web Speech or configure OpenAI or Google (AGY/Gemini) in Settings -> AI & Models.'
    );
    err.statusCode = 503;
    err.code = 'NO_STT_PROVIDER';
    throw err;
  }

  if (chosen === 'openAi') {
    const apiKey = getOpenAiKey(settings, secrets);
    return transcribeWithOpenAi({ audioBuffer, mimeType: normalizedMime, language, apiKey, fetchFn });
  }

  if (chosen === 'gemini') {
    const apiKey = getGeminiKey(settings, secrets);
    if (apiKey) {
      return transcribeWithGeminiApi({ audioBuffer, mimeType: normalizedMime, language, apiKey, fetchFn });
    }
    const cli = await resolveCliFn('agy', 'gemini');
    if (cli?.installed && cli.path) {
      return transcribeWithGeminiCli({ audioBuffer, mimeType: normalizedMime, language, cliPath: cli.path, spawnFn });
    }
  }

  if (chosen === 'localWhisper') {
    const whisper = await checkCliFn('whisper');
    if (whisper?.installed && whisper.path) {
      return transcribeWithWhisperCli({ audioBuffer, mimeType: normalizedMime, language, whisperPath: whisper.path, spawnFn });
    }
  }

  const err = new Error(`Configured transcription provider (${chosen}) is unavailable`);
  err.statusCode = 503;
  err.code = 'NO_STT_PROVIDER';
  throw err;
}
