import { AIService } from './ai.mjs';
import { ChatService } from './chat.mjs';
import { PromptService, PromptMode } from './prompt.mjs';
import { OutputParserService } from './output-parser.mjs';
import { logEvent } from './research-log.mjs';
import { CostLog } from './cost.mjs';
import { getProjectById } from './projects.mjs';
import * as ArtifactService from './artifacts.mjs';
import { ChannelService } from './channels.mjs';
import path from 'node:path';

function providerSetupGuidance(providerId, settings = {}) {
  const labels = {
    hostedApi: 'Hosted API',
    ollama: 'Ollama',
    claudeCode: 'Claude Code CLI',
    geminiCli: 'Gemini CLI',
    openAiCli: 'OpenAI CLI',
    liteLlm: 'LiteLLM',
  };
  const label = labels[providerId] || providerId;
  const selected = Array.isArray(settings.selectedProviders) ? settings.selectedProviders : [];
  const selectedNote = selected.length > 0 && !selected.includes(providerId)
    ? `\n\nNote: ${label} is active, but your selected providers are: ${selected.map((id) => labels[id] || id).join(', ')}.`
    : '';

  const checks = {
    hostedApi: 'Add a hosted API key and model in Settings → Models → Hosted API, or switch to a detected CLI provider.',
    ollama: 'Start Ollama locally, pull a model (for example `ollama pull llama3`), then choose it in Settings → Models.',
    claudeCode: 'Install Claude Code and run `claude login`, then refresh Settings → Models.',
    geminiCli: 'Install Gemini CLI and authenticate it, or add a Gemini API key in Settings → Models.',
    openAiCli: 'Install Codex/OpenAI CLI and sign in, or add an OpenAI API key in Settings → Models.',
    liteLlm: 'Start your LiteLLM proxy and verify the base URL/API key in Settings → Models.',
  };

  return `The selected AI provider (${label}) is not ready, so chat cannot run yet.${selectedNote}\n\n${checks[providerId] || 'Open Settings → Models, verify this provider is installed/authenticated, or switch to another detected provider.'}`;
}

export class AgentOrchestrator {
  constructor(aiService) {
    this.aiService = aiService;
    this.eventHandlers = new Map();
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, payload) {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      handler(payload);
    }
    console.log(`[AgentOrchestrator] Event: ${event}`, payload);
  }

  async runAgentLoop(params) {
    const { messages, systemPrompt, projectId, skillId, skillParams, settings, secrets = {} } = params;

    this.emit('trace-log', 'Initializing agent session...');

    // 1. Get Provider
    const activeProvider = settings.activeProvider || settings.active_provider || 'hostedApi';
    const provider = await AIService.createProvider(activeProvider, settings, secrets);
    
    // 2. Preflight
    const isAvailable = await provider.checkAuthentication().catch(() => false);
    if (!isAvailable) {
      this.emit('trace-log', `WARN: Provider ${activeProvider} is not available or authenticated.`);
      return {
        content: providerSetupGuidance(activeProvider, settings),
        metadata: { model_used: 'none', tokens_in: 0, tokens_out: 0 }
      };
    }

    // 3. Build System Prompt
    this.emit('trace-log', 'Building unified system prompt...');
    const project = projectId ? await getProjectById(projectId) : null;
    const mode = skillId ? PromptMode.Artifact : PromptMode.General;
    let finalSystemPrompt = await PromptService.buildSystemPrompt(project, mode, settings);

    if (systemPrompt) {
      finalSystemPrompt += `\n\n--- ADDITIONAL INSTRUCTIONS ---\n${systemPrompt}`;
    }

    // 4. Chat Request
    this.emit('trace-log', `Initiating chat request via ${activeProvider}...`);
    let response;
    try {
      response = await provider.chat({
        messages,
        system_prompt: finalSystemPrompt,
        options: { temperature: 0.3 }
      });
    } catch (err) {
      this.emit('trace-log', `ERROR: Chat request failed: ${err.message}`);
      return {
        content: `Error from ${activeProvider}: ${err.message}\n\n${providerSetupGuidance(activeProvider, settings)}`,
        metadata: { model_used: 'error', tokens_in: 0, tokens_out: 0 }
      };
    }

    this.emit('trace-log', `Request successful. Received ${response.content.length} chars.`);

    // 5. Post-processing
    if (projectId && project) {
      // Log research event
      await logEvent(projectId, activeProvider, null, response.content);

      // Save History
      const allMessages = [...messages, { role: 'assistant', content: response.content }];
      await ChatService.saveChatToFile(projectId, allMessages, activeProvider);

      // Track Cost
      const modelUsed = await provider.resolveModel();
      const metadata = response.metadata || {
        model_used: modelUsed,
        tokens_in: Math.ceil(finalSystemPrompt.length / 4) + messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0),
        tokens_out: Math.ceil(response.content.length / 4),
      };

      const costLogPath = path.join(project.path, '.metadata', 'cost_log.json');
      const costLog = await CostLog.load(costLogPath);
      
      const costUsd = metadata.cost_usd || CostLog.computeCostUsd(
        metadata.model_used,
        metadata.tokens_in,
        metadata.tokens_out
      );

      const fileChanges = OutputParserService.parseFileChanges(response.content);
      const artifactChanges = OutputParserService.parseArtifactChanges(response.content);

      // Estimate time saved (formula from Rust)
      const timeSavedMinutes = Math.min(120, 3.0 + (metadata.tokens_in / 1000.0) + (metadata.tokens_out / 100.0) + (fileChanges.length * 5.0) + (artifactChanges.length * 10.0));

      costLog.addRecord({
        id: `cost-${Date.now()}`,
        timestamp: new Date().toISOString(),
        provider: activeProvider,
        model: metadata.model_used,
        cost_usd: costUsd,
        input_tokens: metadata.tokens_in,
        output_tokens: metadata.tokens_out,
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
        this.emit('artifacts-changed', { projectId });
      }

      // Notifications
      const notifications = OutputParserService.parseNotifications(response.content);
      for (const msg of notifications) {
        this.emit('trace-log', `Notification: ${msg}`);
        await ChannelService.sendNotification(projectId, msg, settings);
      }
    }

    this.emit('trace-log', 'Agent session completed successfully.');
    return response;
  }
}
