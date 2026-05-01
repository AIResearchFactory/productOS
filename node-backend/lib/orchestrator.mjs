import { AIService } from './ai.mjs';
import { ChatService } from './chat.mjs';
import { PromptService, PromptMode } from './prompt.mjs';
import { OutputParserService } from './output-parser.mjs';
import { logEvent } from './research-log.mjs';
import { CostLog } from './cost.mjs';
import { getProjectById } from './projects.mjs';
import path from 'node:path';

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
    const { messages, systemPrompt, projectId, skillId, skillParams, settings } = params;

    this.emit('trace-log', 'Initializing agent session...');

    // 1. Get Provider
    const provider = await AIService.createProvider(settings.active_provider, settings);
    
    // 2. Preflight (simplified)
    if (!provider.isAvailable()) {
      this.emit('trace-log', `WARN: Provider ${settings.active_provider} is not available.`);
      // return setup guidance...
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
    this.emit('trace-log', `Initiating chat request via ${settings.active_provider}...`);
    const response = await provider.chat({
      messages,
      system_prompt: finalSystemPrompt,
      options: { temperature: 0.3 }
    });

    this.emit('trace-log', `Request successful. Received ${response.content.length} chars.`);

    // 5. Post-processing
    if (projectId && project) {
      // Log research event
      await logEvent(projectId, settings.active_provider, null, response.content);

      // Save History
      const allMessages = [...messages, { role: 'assistant', content: response.content }];
      await ChatService.saveChatToFile(projectId, allMessages, settings.active_provider);

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
        provider: settings.active_provider,
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
        // Artifact service implementation needed in Node
        // await OutputParserService.applyArtifactChanges(projectId, artifactChanges, ...);
      }

      // Notifications
      const notifications = OutputParserService.parseNotifications(response.content);
      for (const msg of notifications) {
        this.emit('trace-log', `Notification: ${msg}`);
        // Channel service implementation needed in Node
      }
    }

    this.emit('trace-log', 'Agent session completed successfully.');
    return response;
  }
}
