import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getGlobalSettingsPath, getSecretsPath } from '../paths.mjs';
import { EncryptionService } from '../encryption.mjs';
import { AIService } from '../ai.mjs';
import { getProjectById } from '../projects.mjs';
import { getEmbedding, upsertEmbedding, getSummary, upsertSummary } from './learning-store.mjs';

/**
 * Read global settings from app data.
 */
async function readGlobalSettings() {
  const settingsPath = await getGlobalSettingsPath();
  try {
    return JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

/**
 * Read and decrypt secrets.
 */
async function readSecrets() {
  const secretsPath = await getSecretsPath();
  try {
    const encryptedData = await fs.readFile(secretsPath, 'utf8');
    const decryptedData = EncryptionService.decrypt(encryptedData);
    return JSON.parse(decryptedData);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    try {
      const raw = await fs.readFile(secretsPath, 'utf8');
      const data = JSON.parse(raw);
      return data;
    } catch {
      return {};
    }
  }
}

/**
 * Compute cosine similarity between two numeric vectors.
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Extract word counts for Term Frequency vector fallback.
 */
function getKeywordFrequencies(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'not', 'no', 'as', 'if', 'then',
    'than', 'when', 'while', 'so', 'up', 'out', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'into',
  ]);

  const words = text.toLowerCase().replace(/[^a-z0-9\s-_]/g, ' ').split(/\s+/);
  const freqs = {};

  for (const word of words) {
    if (word.length >= 3 && !stopWords.has(word)) {
      freqs[word] = (freqs[word] || 0) + 1;
    }
  }

  return freqs;
}

/**
 * Compute Jaccard/Cosine similarity on Term Frequency vectors in pure JS.
 */
export function computeTFSimilarity(textA, textB) {
  if (!textA || !textB) return 0.5;
  const freqA = getKeywordFrequencies(textA);
  const freqB = getKeywordFrequencies(textB);

  const union = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
  if (union.size === 0) return 0.5;

  const vecA = [];
  const vecB = [];
  for (const word of union) {
    vecA.push(freqA[word] || 0);
    vecB.push(freqB[word] || 0);
  }

  return cosineSimilarity(vecA, vecB);
}

/**
 * Tiered Embedding Generation:
 * 1. Active API Provider (e.g. hostedApi)
 * 2. Local Ollama Fallback
 * 3. Returns null (which prompts pure JS Term Frequency similarity fallback)
 */
export async function getProviderEmbedding(text, settings = {}, secrets = {}) {
  const providerType = settings.activeProvider || settings.active_provider || 'hostedApi';

  // ─── Tier 1: Active Hosted Provider ───
  if (providerType === 'hostedApi' || providerType === 'hosted') {
    try {
      const config = settings.hosted || {};
      const apiUrl = config.api_url || config.baseUrl || 'http://localhost:8080';
      const apiKey = config.api_key || (config.apiKeySecretId ? secrets[config.apiKeySecretId] : null);
      const model = config.embedding_model || 'text-embedding-3-small';

      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await fetch(`${apiUrl.replace(/\/$/, '')}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ input: text, model }),
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data) && data.data.length > 0 && data.data[0].embedding) {
          return data.data[0].embedding;
        }
      }
    } catch {
      // Fail silently to next tier
    }
  }

  // ─── Tier 2: Local Ollama ───
  const ollamaConfig = settings.ollama || {};
  const ollamaUrl = ollamaConfig.api_url || 'http://localhost:11434';
  const ollamaModel = ollamaConfig.embedding_model || ollamaConfig.model || 'nomic-embed-text';

  // Try newer Ollama /api/embed API
  try {
    const res = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, input: text }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.embeddings) && data.embeddings.length > 0) {
        return data.embeddings[0];
      }
    }
  } catch {
    // Fail silently to next attempt
  }

  // Try older Ollama /api/embeddings API
  try {
    const res = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, prompt: text }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.embedding) {
        return data.embedding;
      }
    }
  } catch {
    // Fail silently to next tier
  }

  // ─── Tier 3: No Programmatic API Available (triggers TF fallback) ───
  return null;
}

/**
 * Compute semantic task alignment utilizing cached database embeddings where possible.
 */
export async function computeSemanticAlignment(projectId, id, type, content, queryText) {
  if (!content || !queryText) return 0.5;

  const settings = await readGlobalSettings();
  const secrets = await readSecrets();

  // Tier 3 checks if we should skip APIs and run TF fallback immediately
  const isOllamaEnabled = settings.ollama?.enabled || settings.activeProvider === 'ollama';
  const isHostedEnabled = settings.activeProvider === 'hostedApi' || settings.activeProvider === 'hosted';

  if (!isOllamaEnabled && !isHostedEnabled) {
    return computeTFSimilarity(content, queryText);
  }

  try {
    // Get query embedding
    const queryVector = await getProviderEmbedding(queryText, settings, secrets);
    if (!queryVector) return computeTFSimilarity(content, queryText);

    // Get/Compute content embedding
    let stored = await getEmbedding(projectId, id);
    let contentVector;

    if (stored && stored.content === content) {
      contentVector = stored.vector;
    } else {
      contentVector = await getProviderEmbedding(content, settings, secrets);
      if (!contentVector) return computeTFSimilarity(content, queryText);
      await upsertEmbedding(projectId, id, type, content, contentVector);
    }

    return cosineSimilarity(contentVector, queryVector);
  } catch (err) {
    return computeTFSimilarity(content, queryText);
  }
}

/**
 * Safe utility to read file contents from project directory.
 */
export async function getProjectFileContent(projectId, filePath) {
  try {
    const project = await getProjectById(projectId);
    const fullPath = path.resolve(project.path, filePath);
    const stats = await fs.stat(fullPath);
    // Limit to 500KB to avoid memory bloat
    if (stats.size > 500 * 1024) return filePath;
    return await fs.readFile(fullPath, 'utf8');
  } catch {
    return filePath;
  }
}

/**
 * Get cached summary or generate a new one via active AI provider.
 */
export async function getOrGenerateSummary(projectId, filePath, content) {
  const hash = createHash('sha256').update(content).digest('hex');

  // Check SQLite Cache
  try {
    const cached = await getSummary(projectId, filePath);
    if (cached && cached.content_hash === hash) {
      return cached.summary;
    }
  } catch {
    // proceed on cache miss/error
  }

  const settings = await readGlobalSettings();
  const secrets = await readSecrets();
  const providerType = settings.activeProvider || settings.active_provider || 'hostedApi';

  // Make sure we have a provider to talk to
  if (providerType && AIService.isSupportedProvider(providerType, settings)) {
    try {
      const project = await getProjectById(projectId);
      const provider = await AIService.createProvider(providerType, { ...settings, projectPath: project.path }, secrets);

      const systemPrompt = "You are a precise technical summarizer. Provide a concise, structured outline/summary of the following file. Focus on key details, API definitions, or main requirements. Avoid preamble and explainers.";
      const prompt = `File Path: ${filePath}\n\nContent:\n${content}`;

      const response = await provider.chat({
        messages: [{ role: 'user', content: prompt }],
        system_prompt: systemPrompt,
        options: { temperature: 0.1 }
      });

      const summary = response?.content?.trim();
      if (summary) {
        await upsertSummary(projectId, filePath, hash, summary);
        return summary;
      }
    } catch (err) {
      console.warn(`[SilentLearner] Failed to generate summary via active provider:`, err.message);
    }
  }

  // JS Fallback (first 50 + last 50 lines)
  const lines = content.split('\n');
  let summaryFallback = '';
  if (lines.length <= 100) {
    summaryFallback = content;
  } else {
    summaryFallback = `[TRUNCATED FILE SUMMARY - JS FALLBACK]\nFirst 50 lines:\n` +
      lines.slice(0, 50).join('\n') +
      `\n\n[... ${lines.length - 100} lines omitted ...]\n\nLast 50 lines:\n` +
      lines.slice(-50).join('\n');
  }

  try {
    await upsertSummary(projectId, filePath, hash, summaryFallback);
  } catch {
    // Ignore cache write error
  }

  return summaryFallback;
}
