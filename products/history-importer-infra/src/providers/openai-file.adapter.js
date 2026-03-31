import { asText, normalizeRole, safeIso } from '../core/normalize.js';

function parseMappingConversation(rawConversation) {
  const mapping = rawConversation?.mapping || {};
  const entries = Object.entries(mapping);

  const messages = entries
    .map(([nodeId, node]) => {
      const msg = node?.message;
      if (!msg) return null;

      const content = msg?.content?.parts ?? msg?.content;
      const text = asText(content);
      if (!text.trim()) return null;

      return {
        id: msg.id || nodeId,
        role: normalizeRole(msg?.author?.role),
        text,
        parentId: node?.parent || null,
        createdAt: safeIso((msg?.create_time || 0) * 1000),
        metadata: {
          model: msg?.metadata?.model_slug || null,
          rawNodeId: nodeId
        }
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return {
    id: `openai:${rawConversation.id}`,
    source: 'openai',
    sourceConversationId: rawConversation.id,
    title: rawConversation.title || 'Untitled',
    createdAt: safeIso((rawConversation.create_time || 0) * 1000),
    updatedAt: safeIso((rawConversation.update_time || 0) * 1000),
    messages,
    metadata: {
      isCustomGpt: Boolean(rawConversation?.gizmo_id),
      gizmoId: rawConversation?.gizmo_id || null
    }
  };
}

function parseSimpleConversation(rawConversation) {
  const messages = (rawConversation.messages || [])
    .map((m, idx) => ({
      id: m.id || `${rawConversation.id}:m:${idx}`,
      role: normalizeRole(m.role),
      text: asText(m.content),
      parentId: m.parent_id || null,
      createdAt: safeIso(m.created_at),
      metadata: m.metadata || {}
    }))
    .filter((m) => m.text.trim());

  return {
    id: `openai:${rawConversation.id}`,
    source: 'openai',
    sourceConversationId: rawConversation.id,
    title: rawConversation.title || 'Untitled',
    createdAt: safeIso(rawConversation.created_at),
    updatedAt: safeIso(rawConversation.updated_at || rawConversation.created_at),
    messages,
    metadata: {
      isCustomGpt: Boolean(rawConversation?.custom_gpt_id),
      customGptId: rawConversation?.custom_gpt_id || null
    }
  };
}

export const openAiFileAdapter = {
  name: 'openai',
  canParse(payload) {
    return Array.isArray(payload) || Array.isArray(payload?.conversations);
  },
  async parse(payload) {
    const rows = Array.isArray(payload) ? payload : payload.conversations;
    return rows.map((row) => {
      if (row?.mapping) return parseMappingConversation(row);
      return parseSimpleConversation(row);
    });
  }
};
