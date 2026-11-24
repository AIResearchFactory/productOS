import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  getVoiceCapabilities,
  transcribeAudio,
  MAX_AUDIO_BYTES,
} from '../lib/transcription.mjs';

const FAKE_AUDIO_B64 = Buffer.from('OpusHead-mock-audio-bytes').toString('base64');

test('getVoiceCapabilities detects OpenAI, Gemini, and local Whisper accurately', async () => {
  const none = await getVoiceCapabilities({}, {}, {
    checkCliFn: async () => ({ installed: false }),
    resolveCliFn: async () => ({ installed: false }),
  });
  assert.deepEqual(none.fallbackProviders, { openAi: false, gemini: false, localWhisper: false });
  assert.equal(none.resolvedFallback, null);

  const openAiOnly = await getVoiceCapabilities({}, { OPENAI_API_KEY: 'sk-test' }, {
    checkCliFn: async () => ({ installed: false }),
    resolveCliFn: async () => ({ installed: false }),
  });
  assert.equal(openAiOnly.fallbackProviders.openAi, true);
  assert.equal(openAiOnly.resolvedFallback, 'openAi');

  const bothConfiguredPickGemini = await getVoiceCapabilities(
    { voiceInput: { fallbackProvider: 'gemini' } },
    { OPENAI_API_KEY: 'sk-test', GEMINI_API_KEY: 'AIza-test' },
    {
      checkCliFn: async () => ({ installed: false }),
      resolveCliFn: async () => ({ installed: false }),
    }
  );
  assert.equal(bothConfiguredPickGemini.resolvedFallback, 'gemini');

  const disabledFallback = await getVoiceCapabilities(
    { voiceInput: { fallbackProvider: 'none' } },
    { OPENAI_API_KEY: 'sk-test' },
    {
      checkCliFn: async () => ({ installed: true }),
      resolveCliFn: async () => ({ installed: true }),
    }
  );
  assert.equal(disabledFallback.resolvedFallback, null);
});

test('transcribeAudio validates audio MIME, base64, size, and missing provider errors', async () => {
  await assert.rejects(
    () => transcribeAudio({ audioBase64: '', mimeType: 'audio/webm' }),
    (err) => err.statusCode === 400
  );

  await assert.rejects(
    () => transcribeAudio({ audioBase64: FAKE_AUDIO_B64, mimeType: 'text/plain' }),
    (err) => err.statusCode === 400
  );

  const oversized = Buffer.alloc(MAX_AUDIO_BYTES + 16).toString('base64');
  await assert.rejects(
    () => transcribeAudio({ audioBase64: oversized, mimeType: 'audio/webm' }),
    (err) => err.statusCode === 400
  );

  await assert.rejects(
    () =>
      transcribeAudio({
        audioBase64: FAKE_AUDIO_B64,
        mimeType: 'audio/webm',
        settings: {},
        secrets: {},
        checkCliFn: async () => ({ installed: false }),
        resolveCliFn: async () => ({ installed: false }),
      }),
    (err) => err.statusCode === 503 && err.code === 'NO_STT_PROVIDER'
  );
});

test('transcribeAudio uses OpenAI FormData in memory with whisper-1 fallback', async () => {
  const modelsRequested = [];
  const mockFetch = async (_url, init) => {
    const model = init.body.get('model');
    modelsRequested.push(model);
    if (model === 'gpt-4o-mini-transcribe') {
      return { ok: false, status: 404, text: async () => 'model not found' };
    }
    return { ok: true, json: async () => ({ text: ' Hello from Whisper fallback ' }) };
  };

  const result = await transcribeAudio({
    audioBase64: FAKE_AUDIO_B64,
    mimeType: 'audio/webm;codecs=opus',
    language: 'en-US',
    secrets: { OPENAI_API_KEY: 'sk-test' },
    fetchFn: mockFetch,
    checkCliFn: async () => ({ installed: false }),
    resolveCliFn: async () => ({ installed: false }),
  });

  assert.deepEqual(modelsRequested, ['gpt-4o-mini-transcribe', 'whisper-1']);
  assert.deepEqual(result, { text: 'Hello from Whisper fallback', provider: 'openAi' });
});

test('transcribeAudio uses Gemini REST inlineData when GEMINI_API_KEY is configured', async () => {
  let capturedBody = null;
  const mockFetch = async (_url, init) => {
    capturedBody = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Dictated via Gemini.' }] } }],
      }),
    };
  };

  const result = await transcribeAudio({
    audioBase64: FAKE_AUDIO_B64,
    mimeType: 'audio/webm',
    language: 'he-IL',
    secrets: { GEMINI_API_KEY: 'AIza-test' },
    fetchFn: mockFetch,
    checkCliFn: async () => ({ installed: false }),
    resolveCliFn: async () => ({ installed: false }),
  });

  assert.equal(capturedBody.contents[0].parts[1].inlineData.mimeType, 'audio/webm');
  assert.deepEqual(result, { text: 'Dictated via Gemini.', provider: 'gemini' });
});

test('transcribeAudio cleans up ephemeral whisper CLI temp directory unconditionally', async (t) => {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productos-whisper-bin-'));
  t.after(async () => {
    await fs.rm(binDir, { recursive: true, force: true });
  });

  const fakeWhisperJs = path.join(binDir, 'fake-whisper.js');
  const observedDirsPath = path.join(binDir, 'observed.txt');
  await fs.writeFile(
    fakeWhisperJs,
    `const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--output_dir');
const outDir = args[outIdx + 1];
fs.writeFileSync(${JSON.stringify(observedDirsPath)}, outDir, 'utf8');
fs.writeFileSync(path.join(outDir, 'recording.txt'), 'Transcribed by local whisper', 'utf8');
`
  );

  const fakeWhisperBin = path.join(binDir, process.platform === 'win32' ? 'whisper.cmd' : 'whisper');
  await fs.writeFile(
    fakeWhisperBin,
    process.platform === 'win32'
      ? `@echo off\r\nnode "%~dp0fake-whisper.js" %*\r\n`
      : `#!/bin/sh\nexec node "$(dirname "$0")/fake-whisper.js" "$@"\n`
  );
  await fs.chmod(fakeWhisperBin, 0o755);

  const result = await transcribeAudio({
    audioBase64: FAKE_AUDIO_B64,
    mimeType: 'audio/webm',
    settings: { voiceInput: { fallbackProvider: 'localWhisper' } },
    secrets: {},
    checkCliFn: async (cmd) => (cmd === 'whisper' ? { installed: true, path: fakeWhisperBin } : { installed: false }),
    resolveCliFn: async () => ({ installed: false }),
  });

  assert.deepEqual(result, { text: 'Transcribed by local whisper', provider: 'localWhisper' });
  const createdTempDir = await fs.readFile(observedDirsPath, 'utf8');
  await assert.rejects(() => fs.access(createdTempDir));
});

test('transcribeAudio passes --yolo without --dangerously-skip-permissions for gemini CLI and keeps agy flags intact', async (t) => {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productos-gemini-cli-stt-'));
  t.after(async () => {
    await fs.rm(binDir, { recursive: true, force: true });
  });

  const makeFakeCli = async (name) => {
    const jsPath = path.join(binDir, `${name}.js`);
    const argsFile = path.join(binDir, `${name}-args.json`);
    await fs.writeFile(
      jsPath,
      `const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)), 'utf8');
process.stdout.write('Transcript from ${name}');
`
    );
    const binPath = path.join(binDir, process.platform === 'win32' ? `${name}.cmd` : name);
    await fs.writeFile(
      binPath,
      process.platform === 'win32'
        ? `@echo off\r\nnode "%~dp0${name}.js" %*\r\n`
        : `#!/bin/sh\nexec node "$(dirname "$0")/${name}.js" "$@"\n`
    );
    await fs.chmod(binPath, 0o755);
    return { binPath, argsFile };
  };

  const geminiCli = await makeFakeCli('gemini');
  const geminiRes = await transcribeAudio({
    audioBase64: FAKE_AUDIO_B64,
    mimeType: 'audio/webm',
    settings: { voiceInput: { fallbackProvider: 'gemini' } },
    secrets: {},
    checkCliFn: async () => ({ installed: false }),
    resolveCliFn: async () => ({ installed: true, path: geminiCli.binPath }),
  });
  assert.deepEqual(geminiRes, { text: 'Transcript from gemini', provider: 'gemini' });
  const geminiArgs = JSON.parse(await fs.readFile(geminiCli.argsFile, 'utf8'));
  assert.ok(geminiArgs.includes('--yolo'));
  assert.equal(geminiArgs.includes('--dangerously-skip-permissions'), false);
  assert.equal(geminiArgs.includes('--add-dir'), false);
  const includeDirIdx = geminiArgs.indexOf('--include-directories');
  assert.notEqual(includeDirIdx, -1);
  const includedDir = geminiArgs[includeDirIdx + 1];
  assert.ok(includedDir.includes('productos-stt-gemini-'));
  const geminiPrompt = geminiArgs[geminiArgs.indexOf('--prompt') + 1];
  assert.ok(geminiPrompt.includes(path.join(includedDir, 'recording.webm')));

  const agyCli = await makeFakeCli('agy');
  const agyRes = await transcribeAudio({
    audioBase64: FAKE_AUDIO_B64,
    mimeType: 'audio/webm',
    settings: { voiceInput: { fallbackProvider: 'gemini' } },
    secrets: {},
    checkCliFn: async () => ({ installed: false }),
    resolveCliFn: async () => ({ installed: true, path: agyCli.binPath }),
  });
  assert.deepEqual(agyRes, { text: 'Transcript from agy', provider: 'gemini' });
  const agyArgs = JSON.parse(await fs.readFile(agyCli.argsFile, 'utf8'));
  assert.ok(agyArgs.includes('--dangerously-skip-permissions'));
  assert.ok(agyArgs.includes('--add-dir'));
  assert.equal(agyArgs.includes('--include-directories'), false);
});
