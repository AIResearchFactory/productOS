export const claudeFileAdapter = {
  name: 'claude',
  canParse(payload) {
    // Placeholder until we lock a concrete Claude export schema
    return Array.isArray(payload?.conversations) || Array.isArray(payload);
  },
  async parse() {
    throw new Error('Claude adapter not implemented yet. Add real export fixture then implement parser.');
  }
};
