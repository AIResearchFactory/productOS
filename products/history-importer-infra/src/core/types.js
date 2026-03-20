/**
 * Canonical conversation types (plain JS typedef docs)
 */

/**
 * @typedef {Object} CanonicalMessage
 * @property {string} id
 * @property {'user'|'assistant'|'system'|'tool'} role
 * @property {string} text
 * @property {string|null} parentId
 * @property {string} createdAt ISO date
 * @property {Object} metadata
 */

/**
 * @typedef {Object} CanonicalConversation
 * @property {string} id
 * @property {string} source
 * @property {string} sourceConversationId
 * @property {string} title
 * @property {string} createdAt ISO date
 * @property {string} updatedAt ISO date
 * @property {CanonicalMessage[]} messages
 * @property {Object} metadata
 */

export const SUPPORTED_ROLES = new Set(['user', 'assistant', 'system', 'tool']);
