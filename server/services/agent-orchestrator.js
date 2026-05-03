import { getProvider, getActiveProviderType } from './ai-service.js';
import { loadGlobalSettings } from './settings.js';
import { getChatFiles, saveChatToFile } from './chat-history.js';
import { loadProjectById } from './project.js';
import { loadSkill } from './skill.js';
import { logEvent } from './research-log.js';
import { emitEvent } from '../index.js';
import { cancellationManager } from './cancellation.js';

function providerPreflight(provider, config) {
  const isAvailable = provider.isAvailable(config);
  // Simple mock of authenticated check
  const isAuthenticated = isAvailable; 
  return { isAvailable, isAuthenticated };
}

function providerSetupGuidance(provider, preflight, error) {
  const providerLabel = provider.name;
  const headline = !preflight.isAvailable
    ? `I couldn't start chat yet because **${providerLabel}** isn't available on this machine.`
    : `I opened the chat, but **${providerLabel}** still needs setup before it can answer.`;

  let content = `${headline}\n\nPlease open **Settings → Models** and finish setup for **${providerLabel}**.`;
  if (error) content += `\n\n_Last error: ${error.message || error}_`;

  return { content, tool_calls: null, metadata: null };
}

export async function chat(messages, systemPrompt, projectId, skillId, skillParams) {
  emitEvent('trace-log', 'Initializing agent session...');

  const settings = loadGlobalSettings();
  const providerType = getActiveProviderType();
  const { provider, config } = getProvider(providerType, settings);

  const preflight = providerPreflight(provider, config);
  if (!preflight.isAvailable) {
    emitEvent('trace-log', `WARN: Provider ${providerType} is not available.`);
    return providerSetupGuidance(provider, preflight, null);
  }

  let finalSystemPrompt = systemPrompt || '';
  if (skillId) {
    try {
      const skill = loadSkill(skillId);
      finalSystemPrompt += `\n\n=== RELEVANT SKILL CONTEXT ===\nSkill Name: ${skill.name}\nGoal: ${skill.description}\n\n`;
      let rendered = skill.prompt_template;
      if (skillParams) {
        for (const [k, v] of Object.entries(skillParams)) {
          rendered = rendered.split(`{{${k}}}`).join(v).split(`{${k}}`).join(v);
        }
      }
      finalSystemPrompt += `--- SKILL INSTRUCTIONS ---\n${rendered}\n--------------------------\n`;
    } catch (e) {
      emitEvent('trace-log', `WARN: Requested skill '${skillId}' not found.`);
    }
  }

  emitEvent('trace-log', `Initiating chat request via ${providerType}...`);
  
  let chatResult;
  try {
    chatResult = await provider.chat({ messages, systemPrompt: finalSystemPrompt, projectPath: projectId ? '' : null }, config);
    emitEvent('trace-log', `Request successful. Received ${chatResult.content?.length || 0} chars.`);
  } catch (error) {
    emitEvent('trace-log', `ERROR: Request failed: ${error.message || error}`);
    if (projectId) logEvent(projectId, providerType, null, `ERROR: ${error.message || error}`);
    throw error;
  }

  if (projectId && chatResult.content) {
    logEvent(projectId, providerType, null, chatResult.content);
    saveChatToFile(projectId, [...messages, { role: 'assistant', content: chatResult.content }], providerType);

    // Parse and apply file/artifact changes (simplified for parity)
    const { applyChanges, parseChanges } = await import('./output-parser.js').catch(() => ({}));
    if (parseChanges && applyChanges) {
       const changes = parseChanges(chatResult.content);
       if (changes?.length > 0) {
         emitEvent('trace-log', `Applying ${changes.length} detected file changes...`);
         applyChanges(projectId, changes);
         emitEvent('file-changed', { projectId, fileName: 'unknown' });
       }
    }
  }

  return chatResult;
}

export async function chatStream(messages, systemPrompt, projectId, skillId, skillParams) {
  emitEvent('trace-log', 'Initializing streaming agent session...');

  const settings = loadGlobalSettings();
  const providerType = getActiveProviderType();
  const { provider, config } = getProvider(providerType, settings);

  if (!provider.chatStream) throw new Error('Streaming not supported by this provider');

  const preflight = providerPreflight(provider, config);
  if (!preflight.isAvailable) {
    emitEvent('trace-log', `WARN: Provider ${providerType} is not available.`);
    const fallback = providerSetupGuidance(provider, preflight, null);
    // Return a fake stream that yields the error message
    const stream = new (await import('stream')).PassThrough();
    stream.write(fallback.content);
    stream.end();
    return stream;
  }

  let finalSystemPrompt = systemPrompt || '';
  if (skillId) {
    try {
      const skill = loadSkill(skillId);
      finalSystemPrompt += `\n\n=== RELEVANT SKILL CONTEXT ===\nSkill Name: ${skill.name}\nGoal: ${skill.description}\n\n`;
      let rendered = skill.prompt_template;
      if (skillParams) {
        for (const [k, v] of Object.entries(skillParams)) {
          rendered = rendered.split(`{{${k}}}`).join(v).split(`{${k}}`).join(v);
        }
      }
      finalSystemPrompt += `--- SKILL INSTRUCTIONS ---\n${rendered}\n--------------------------\n`;
    } catch (e) {
      emitEvent('trace-log', `WARN: Requested skill '${skillId}' not found.`);
    }
  }

  const stream = await provider.chatStream({ messages, systemPrompt: finalSystemPrompt, projectPath: projectId ? '' : null }, config);
  
  // Wrap stream to capture output for history/logging
  const { PassThrough } = await import('stream');
  const proxyStream = new PassThrough();
  
  let fullContent = '';
  stream.on('data', (chunk) => {
    fullContent += chunk.toString();
    proxyStream.write(chunk);
    emitEvent('chat-delta', chunk.toString());
  });

  stream.on('end', () => {
    proxyStream.end();
    if (projectId && fullContent) {
      logEvent(projectId, providerType, null, fullContent);
      saveChatToFile(projectId, [...messages, { role: 'assistant', content: fullContent }], providerType);

      import('./output-parser.js').then(({ parseChanges, applyChanges }) => {
        if (parseChanges && applyChanges) {
          const changes = parseChanges(fullContent);
          if (changes?.length > 0) {
            applyChanges(projectId, changes);
            emitEvent('file-changed', { projectId, fileName: 'unknown' });
          }
        }
      }).catch(() => {});
    }
    emitEvent('trace-log', 'Streaming session completed.');
  });

  stream.on('error', (err) => {
    emitEvent('trace-log', `ERROR: Stream error: ${err.message}`);
    proxyStream.destroy(err);
  });

  return proxyStream;
}
