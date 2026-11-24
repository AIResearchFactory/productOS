import { AIService } from './ai.mjs';
import { ChatService } from './chat.mjs';
import { PromptService, PromptMode } from './prompt.mjs';
import { OutputParserService } from './output-parser.mjs';
import { logEvent } from './research-log.mjs';
import { CostLog } from './cost.mjs';
import { getProjectById } from './projects.mjs';
import * as ArtifactService from './artifacts.mjs';
import { ChannelService } from './channels.mjs';
import { trackTelemetry } from './telemetry/index.mjs';
import path from 'node:path';
import { captureEvent } from './silent-learner/index.mjs';
import {
  validateAndDecodeAttachments,
  materializeTempAttachments,
  cleanupTempDir,
  formatAttachmentsSummary,
} from './temp-attachments.mjs';


function formatElapsedDuration(ms) {
  if (!Number.isFinite(ms) || ms < 1000) {
    return `${Math.max(0, Math.round(ms || 0))}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${secs}s`;
}

function providerSetupGuidance(providerId, settings = {}, overrideLabel = null) {
  const labels = {
    hostedApi: 'Hosted API',
    ollama: 'Ollama',
    claudeCode: 'Claude Code CLI',
    geminiCli: overrideLabel || 'Google Antigravity CLI (agy)',
    openAiCli: 'OpenAI CLI',
    liteLlm: 'LiteLLM',
    autoRouter: 'Model Router',
  };
  const label = overrideLabel || labels[providerId] || providerId;
  const selected = Array.isArray(settings.selectedProviders) ? settings.selectedProviders : [];
  const selectedNote = selected.length > 0 && !selected.includes(providerId)
    ? `\n\nNote: ${label} is active, but your selected providers are: ${selected.map((id) => labels[id] || id).join(', ')}.`
    : '';

  const checks = {
    hostedApi: 'Add a hosted API key and model in Settings → Models → Hosted API, or switch to a detected CLI provider.',
    ollama: 'Start Ollama locally, pull a model (for example `ollama pull llama3`), then choose it in Settings → Models.',
    claudeCode: 'Install Claude Code and run `claude login`, then refresh Settings → Models.',
    geminiCli: `Install ${label} and authenticate it, or add a Gemini API key in Settings → Models.`,
    openAiCli: 'Install Codex/OpenAI CLI and sign in, or add an OpenAI API key in Settings → Models.',
    liteLlm: 'Start your LiteLLM proxy and verify the base URL/API key in Settings → Models.',
    autoRouter: 'Configure at least one local provider (Ollama) or cloud provider in Settings → Models, then keep Model Router in hybrid mode.',
  };

  return `The selected AI provider (${label}) is not ready, so chat cannot run yet.${selectedNote}\n\n${checks[providerId] || 'Open Settings → Models, verify this provider is installed/authenticated, or switch to another detected provider.'}`;
}

const SENSITIVE_LOG_KEYS = new Set([
  'result',
  'content',
  'messages',
  'prompt',
  'response',
  'systemPrompt',
  'system_prompt',
  'tool_calls',
  'secrets',
  'attachments',
  'images',
  'dataUrl',
  'audioBase64',
  'buffer',
]);

/**
 * Strip raw agent output, prompts, and message content before writing event payloads to server logs.
 *
 * @param {string} event
 * @param {unknown} payload
 * @returns {unknown}
 */
export function sanitizeEventPayloadForLog(event, payload) {
  if (payload == null || typeof payload !== 'object') {
    return payload;
  }

  if (event === 'agent-status') {
    const safe = {};
    const safeKeys = ['projectId', 'status', 'startedAt', 'completedAt', 'provider', 'stopped', 'chatFileName'];
    for (const key of safeKeys) {
      if (payload[key] !== undefined) {
        safe[key] = payload[key];
      }
    }
    if (payload.result && typeof payload.result === 'object') {
      safe.hasResult = true;
      safe.resultLength = typeof payload.result.content === 'string' ? payload.result.content.length : 0;
      const modelUsed = payload.result.metadata?.model_used;
      if (modelUsed) {
        safe.modelUsed = modelUsed;
      }
    }
    return safe;
  }

  if (Array.isArray(payload)) {
    return { itemCount: payload.length };
  }

  const safe = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!SENSITIVE_LOG_KEYS.has(key)) {
      safe[key] = value;
    }
  }
  return safe;
}

export class AgentOrchestrator {
  constructor(aiService) {
    this.aiService = aiService;
    this.eventHandlers = new Map();
    this.activeControllers = new Map();
    this.activeRuns = new Map();
    this.activeRunPromises = new Set();
    this.projectRunPromises = new Map();
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, payload) {
    if (event === 'trace-log') {
      const msg = typeof payload === 'string' ? payload : (payload?.message || '');
      for (const run of this.activeRuns.values()) {
        run.lastTrace = msg;
      }
    }
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      handler(payload);
    }
    console.log(`[AgentOrchestrator] Event: ${event}`, sanitizeEventPayloadForLog(event, payload));
  }

  getActiveRun(projectId = 'default') {
    const sessionKey = projectId || 'default';
    return this.activeRuns.get(sessionKey) || null;
  }

  isAgentRunning(projectId = 'default') {
    const sessionKey = projectId || 'default';
    return this.activeControllers.has(sessionKey);
  }

  async stopExecution(projectId = 'default') {
    const controller = this.activeControllers.get(projectId);
    if (controller) {
      this.emit('trace-log', `Aborting execution for project: ${projectId}`);
      controller.abort();
      this.activeControllers.delete(projectId);
      this.activeRuns.delete(projectId);
      this.emit('agent-status', {
        projectId,
        status: 'idle',
        stopped: true
      });
      return true;
    }
    return false;
  }

  async waitForProjectRuns(projectId = 'default', { timeoutMs = 2000 } = {}) {
    const sessionKey = projectId || 'default';
    const set = this.projectRunPromises.get(sessionKey);
    if (!set || set.size === 0) return;
    const waitAll = Promise.allSettled(Array.from(set));
    if (!timeoutMs || timeoutMs <= 0) {
      await waitAll;
      return;
    }
    let timer;
    try {
      await Promise.race([
        waitAll,
        new Promise((resolve) => {
          timer = setTimeout(resolve, timeoutMs);
          timer.unref?.();
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async stopAllExecutions({ timeoutMs = 5000 } = {}) {
    const projectIds = new Set([
      ...this.activeControllers.keys(),
      ...this.activeRuns.keys(),
    ]);
    for (const projectId of projectIds) {
      try {
        await this.stopExecution(projectId);
      } catch (err) {
        console.error(`[AgentOrchestrator] Error stopping execution for project ${projectId}:`, err);
      }
    }
    if (this.activeRunPromises.size === 0) return;
    const waitAll = Promise.allSettled(Array.from(this.activeRunPromises));
    if (!timeoutMs || timeoutMs <= 0) {
      await waitAll;
      return;
    }
    let timer;
    try {
      await Promise.race([
        waitAll,
        new Promise((resolve) => {
          timer = setTimeout(resolve, timeoutMs);
          timer.unref?.();
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async runAgentLoop(params) {
    const { messages, systemPrompt, projectId, skillId, skillParams, settings = {}, secrets = {}, providerType, onDelta, signal: parentSignal } = params;
    const sessionKey = projectId || 'default';

    // Cancel existing run for this project if any
    if (this.activeControllers.has(sessionKey)) {
      this.activeControllers.get(sessionKey).abort();
    }

    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    if (parentSignal) {
      if (parentSignal.aborted) {
        controller.abort();
      } else {
        parentSignal.addEventListener('abort', onParentAbort, { once: true });
      }
    }
    this.activeControllers.set(sessionKey, controller);

    let resolveRunDone;
    const runDone = new Promise((resolve) => {
      resolveRunDone = resolve;
    });
    this.activeRunPromises.add(runDone);
    if (!this.projectRunPromises.has(sessionKey)) {
      this.projectRunPromises.set(sessionKey, new Set());
    }
    this.projectRunPromises.get(sessionKey).add(runDone);

    let chatFileName = null;
    let finalResult = null;
    let response = null;
    const requestedProvider = providerType || settings.activeProvider || settings.active_provider || 'hostedApi';

    const runInfo = {
      projectId: sessionKey,
      startedAt: Date.now(),
      provider: requestedProvider,
      lastTrace: 'Initializing agent session...'
    };
    this.activeRuns.set(sessionKey, runInfo);
    this.emit('agent-status', {
      projectId: sessionKey,
      status: 'running',
      startedAt: runInfo.startedAt,
      provider: runInfo.provider,
      lastTrace: runInfo.lastTrace
    });

    try {

      this.emit('trace-log', 'Initializing agent session...');
      if (!AIService.isSupportedProvider(requestedProvider, settings)) {
        this.emit('trace-log', `ERROR: Unsupported AI provider requested: ${requestedProvider}`);
        return {
          content: `Unsupported AI provider (${requestedProvider}). Please choose a configured provider in Settings → Models.`,
          metadata: { model_used: 'error', tokens_in: 0, tokens_out: 0 }
        };
      }

      const project = projectId ? await getProjectById(projectId) : null;
      const provider = await AIService.createProvider(requestedProvider, { ...settings, projectPath: project?.path }, secrets);
      const activeProvider = provider.providerType();
      const providerLabel = provider.displayName ? await provider.displayName() : activeProvider;

      // 2. Preflight
      this.emit('trace-log', `Checking authentication for ${providerLabel}...`);
      const isAvailable = await provider.checkAuthentication().catch(() => false);
      if (!isAvailable) {
        this.emit('trace-log', `WARN: Provider ${providerLabel} is not available or authenticated.`);
        return {
          content: providerSetupGuidance(activeProvider, settings, providerLabel),
          metadata: { model_used: 'none', tokens_in: 0, tokens_out: 0 }
        };
      }

      // 3. Validate attachments & prepare ephemeral / sanitized messages
      const rawMessages = Array.isArray(messages) ? messages : [];
      const parsedTurns = rawMessages.map((msg) => {
        const rawText = typeof msg?.content === 'string' ? msg.content : String(msg?.content ?? '');
        const decodedAttachments =
          msg?.role === 'user' && Array.isArray(msg?.attachments) && msg.attachments.length > 0
            ? validateAndDecodeAttachments(msg.attachments)
            : [];
        const effectiveText =
          decodedAttachments.length > 0 && !rawText.trim()
            ? 'Please analyze the attached image(s).'
            : rawText;
        const meta = decodedAttachments.map(({ name, mimeType, sizeBytes }) => ({
          name,
          mimeType,
          sizeBytes,
        }));
        return {
          role: msg?.role || 'user',
          text: effectiveText,
          decodedAttachments,
          meta,
        };
      });

      const allDecodedAttachments = parsedTurns.flatMap((turn) => turn.decodedAttachments);
      const lastUserTurn = [...parsedTurns].reverse().find((turn) => turn.role === 'user');
      const latestAttachmentsMeta = lastUserTurn ? lastUserTurn.meta : [];

      const sanitizedMessages = parsedTurns.map((turn) => {
        if (turn.meta.length === 0) {
          return { role: turn.role, content: turn.text };
        }
        const summary = formatAttachmentsSummary(turn.meta);
        return {
          role: turn.role,
          content: turn.text ? `[${summary}]\n\n${turn.text}` : `[${summary}]`,
        };
      });

      let materializedTemp = null;
      const useTempFiles =
        allDecodedAttachments.length > 0 &&
        (typeof provider.usesTempFilesForImages !== 'function' || provider.usesTempFilesForImages());

      // 4. Build System Prompt
      this.emit('trace-log', 'Collecting project context and building system prompt...');
      if (controller.signal.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }

      const mode = skillId ? PromptMode.Artifact : PromptMode.General;
      let finalSystemPrompt = await PromptService.buildSystemPrompt(project, mode, settings);

      if (systemPrompt) {
        finalSystemPrompt += `\n\n--- ADDITIONAL INSTRUCTIONS ---\n${systemPrompt}`;
      }

      // 5. Chat Request (with deterministic finally cleanup for ephemeral temp image files)
      let chatStartedAt = Date.now();
      try {
        if (controller.signal.aborted) {
          this.emit('trace-log', 'Chat execution aborted before temp attachment materialization.');
          return { content: '_Execution stopped._', metadata: { model_used: 'aborted', tokens_in: 0, tokens_out: 0 } };
        }
        let tempFileOffset = 0;
        if (useTempFiles) {
          materializedTemp = await materializeTempAttachments(allDecodedAttachments, {
            projectId: project ? sessionKey : null,
            projectPath: project?.path || null,
          });
          if (controller.signal.aborted) {
            this.emit('trace-log', 'Chat execution aborted after temp attachment materialization.');
            return { content: '_Execution stopped._', metadata: { model_used: 'aborted', tokens_in: 0, tokens_out: 0 } };
          }
          this.emit(
            'trace-log',
            `Prepared ${allDecodedAttachments.length} temporary image attachment${allDecodedAttachments.length === 1 ? '' : 's'}.`
          );
        }

        const providerMessages = parsedTurns.map((turn) => {
          const msg = { role: turn.role, content: turn.text };
          if (turn.decodedAttachments.length > 0) {
            msg.attachments = turn.decodedAttachments;
            if (materializedTemp) {
              msg.tempImagePaths = materializedTemp.files.slice(
                tempFileOffset,
                tempFileOffset + turn.decodedAttachments.length
              );
              tempFileOffset += turn.decodedAttachments.length;
            }
          }
          return msg;
        });

        chatStartedAt = Date.now();
        this.emit('trace-log', `Sending request to ${providerLabel} (Context: ${Math.ceil(finalSystemPrompt.length / 4)} tokens)...`);
        try {
          response = await provider.chat({
            messages: providerMessages,
            system_prompt: finalSystemPrompt,
            options: { temperature: 0.3 },
            signal: controller.signal,
            onDelta,
            onTrace: (msg) => {
              if (typeof msg === 'string' && msg.trim()) {
                this.emit('trace-log', msg.trim());
              }
            }
          });
        } catch (err) {
          if (err.name === 'AbortError' || controller.signal.aborted) {
            this.emit('trace-log', 'Chat execution aborted by user.');
            const content = err.content || err.partialContent || '_Execution stopped._';
            return { content, metadata: { model_used: 'aborted', tokens_in: 0, tokens_out: 0 } };
          }
          this.emit('trace-log', `ERROR: Chat request failed: ${err.message}`);
          return {
            content: `Error from ${providerLabel}: ${err.message}\n\n${providerSetupGuidance(activeProvider, settings, providerLabel)}`,
            metadata: { model_used: 'error', tokens_in: 0, tokens_out: 0 }
          };
        }
      } finally {
        if (materializedTemp?.tempDir) {
          const cleanupRes = await cleanupTempDir(materializedTemp.tempDir, project ? sessionKey : null);
          if (cleanupRes && cleanupRes.ok === false) {
            this.emit('trace-log', 'WARN: Temporary image attachment cleanup failed and remains tracked.');
          }
        }
      }

      if (controller.signal.aborted) {
        const content = response?.content || '_Execution stopped._';
        return { content, metadata: { model_used: 'aborted', tokens_in: 0, tokens_out: 0 } };
      }

      this.emit('trace-log', `Request successful (${providerLabel}, ${formatElapsedDuration(Date.now() - chatStartedAt)}). Received ${response.content.length} chars.`);

      // 6. Post-processing (text-only sanitized messages — never store binary image data)
      if (projectId && project) {
        // Save History
        const allMessages = [...sanitizedMessages, { role: 'assistant', content: response.content }];
        chatFileName = await ChatService.saveChatToFile(projectId, allMessages, activeProvider, {
          attachments: latestAttachmentsMeta,
        });

        // Log research event with chat file reference and attachment summary metadata
        await logEvent(projectId, activeProvider, null, response.content, chatFileName, {
          attachments: latestAttachmentsMeta,
        });

        // Track Cost (using sanitized text lengths so base64 never inflates token counts)
        const estimatedTokensIn =
          Math.ceil(finalSystemPrompt.length / 4) +
          sanitizedMessages.reduce((acc, m) => acc + Math.ceil((m?.content?.length || 0) / 4), 0);
      const estimatedTokensOut = Math.ceil((response.content?.length || 0) / 4);
      const rawMeta = response.metadata && typeof response.metadata === 'object' ? response.metadata : {};
      const resolvedProviderModel = await provider.resolveModel().catch(() => '');
      const modelUsed = rawMeta.model_used || rawMeta.model || resolvedProviderModel;
      const tokensIn =
        typeof rawMeta.tokens_in === 'number' && Number.isFinite(rawMeta.tokens_in) && rawMeta.tokens_in > 0
          ? rawMeta.tokens_in
          : estimatedTokensIn;
      const tokensOut =
        typeof rawMeta.tokens_out === 'number' && Number.isFinite(rawMeta.tokens_out) && rawMeta.tokens_out > 0
          ? rawMeta.tokens_out
          : estimatedTokensOut;
      const tokensCacheRead =
        typeof rawMeta.tokens_cache_read === 'number' && Number.isFinite(rawMeta.tokens_cache_read) && rawMeta.tokens_cache_read > 0
          ? rawMeta.tokens_cache_read
          : 0;
      const tokensCacheWrite =
        typeof rawMeta.tokens_cache_write === 'number' && Number.isFinite(rawMeta.tokens_cache_write) && rawMeta.tokens_cache_write > 0
          ? rawMeta.tokens_cache_write
          : 0;
      const tokensReasoning =
        typeof rawMeta.tokens_reasoning === 'number' && Number.isFinite(rawMeta.tokens_reasoning) && rawMeta.tokens_reasoning > 0
          ? rawMeta.tokens_reasoning
          : 0;
      const isCloud =
        typeof rawMeta.routing?.cloud === 'boolean'
          ? rawMeta.routing.cloud
          : (typeof provider.isCloudProvider === 'function' ? provider.isCloudProvider() : true);
      const explicitCost = rawMeta.cost_usd ?? rawMeta.costUsd;
      const costUsd =
        typeof explicitCost === 'number' && Number.isFinite(explicitCost) && explicitCost > 0
          ? explicitCost
          : CostLog.computeCostUsd(modelUsed, tokensIn, tokensOut, tokensCacheRead, tokensCacheWrite, { isCloud });

      const metadata = {
        ...rawMeta,
        model_used: modelUsed,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        tokens_cache_read: tokensCacheRead,
        tokens_cache_write: tokensCacheWrite,
        tokens_reasoning: tokensReasoning,
        cost_usd: costUsd,
      };
      response.metadata = metadata;

      const costLogPath = path.join(project.path, '.metadata', 'cost_log.json');
      const costLog = await CostLog.load(costLogPath);

      const fileChanges = OutputParserService.parseFileChanges(response.content);
      const artifactChanges = OutputParserService.parseArtifactChanges(response.content);

      // Estimate time saved
      const timeSavedMinutes = Math.min(120, 3.0 + (tokensIn / 1000.0) + (tokensOut / 100.0) + (fileChanges.length * 5.0) + (artifactChanges.length * 10.0));

      costLog.addRecord({
        id: `cost-${Date.now()}`,
        timestamp: new Date().toISOString(),
        provider: activeProvider,
        provider_name: providerLabel,
        model: modelUsed,
        cost_usd: costUsd,
        input_tokens: tokensIn,
        output_tokens: tokensOut,
        cache_read_tokens: tokensCacheRead,
        cache_creation_tokens: tokensCacheWrite,
        reasoning_tokens: tokensReasoning,
        time_saved_minutes: timeSavedMinutes,
        is_user_prompt: true,
      });
      await costLog.save(costLogPath);

        // Apply File Changes
        if (fileChanges.length > 0) {
          this.emit('trace-log', `Applying ${fileChanges.length} detected file changes...`);
          await OutputParserService.applyChanges(project.path, fileChanges);
          this.emit('file-changed', { projectId, fileName: 'unknown' });
        }

        // Apply Artifact Changes
        if (artifactChanges.length > 0) {
          this.emit('trace-log', `Creating ${artifactChanges.length} detected artifacts...`);
          await OutputParserService.applyArtifactChanges(projectId, artifactChanges, ArtifactService);
          for (const change of artifactChanges) {
            try {
              await trackTelemetry('artifact.created', { artifactType: change.artifactType || change.artifact_type, source: 'agent' }, settings);
            } catch (error) {
              this.emit('trace-log', `WARN: telemetry artifact.created failed: ${error?.message || error}`);
            }
          }
          this.emit('artifacts-changed', { projectId });
        }

        // Notifications
        const notifications = OutputParserService.parseNotifications(response.content);
        for (const msg of notifications) {
          this.emit('trace-log', `Sending notification (${msg.length} chars)...`);
          await ChannelService.sendNotification(projectId, msg, settings);
        }

        // Capture event for Silent Learner
        try {
          const excludedPaths = settings.silentLearner?.excludedPaths || [];
          const captureResult = await captureEvent({
            projectId,
            sessionId: params.sessionId || params.session_id || chatFileName || 'default',
            chatFile: chatFileName || null,
            provider: activeProvider,
            messages: sanitizedMessages,
            result: response,
            fileChanges: fileChanges.map(c => c.path),
            artifactChanges: artifactChanges.map(c => c.artifactType),
          }, excludedPaths);

          if (captureResult?.reason === 'redacted_secret' || captureResult?.paused) {
            this.emit('silent_learner.state_changed', { workspaceId: projectId, state: 'paused' });
            this.emit('silent_learner.error', { workspaceId: projectId, errorType: 'redacted_secret' });
          }
        } catch (err) {
          console.error('[AgentOrchestrator] Failed to capture Silent Learner event:', err.message);
        }
      }

      this.emit('trace-log', 'Agent session completed successfully.');
      finalResult = response;
      return response;
    } finally {
      if (parentSignal && onParentAbort) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
      if (this.activeControllers.get(sessionKey) === controller) {
        this.activeControllers.delete(sessionKey);
      }
      if (this.activeRuns.get(sessionKey) === runInfo) {
        this.activeRuns.delete(sessionKey);
        this.emit('agent-status', {
          projectId: sessionKey,
          status: 'idle',
          completedAt: Date.now(),
          chatFileName: chatFileName || null,
          result: finalResult || response || null
        });
      }
      this.activeRunPromises.delete(runDone);
      const projectRunSet = this.projectRunPromises.get(sessionKey);
      if (projectRunSet) {
        projectRunSet.delete(runDone);
        if (projectRunSet.size === 0) {
          this.projectRunPromises.delete(sessionKey);
        }
      }
      resolveRunDone();
    }
  }
}
