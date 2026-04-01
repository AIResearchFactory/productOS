export class Importer {
  /**
   * @param {{name:string, canParse:(input:any)=>boolean, parse:(input:any)=>Promise<any[]>}[]} adapters
   */
  constructor(adapters) {
    this.adapters = adapters;
  }

  /**
   * @param {{provider:string, payload:any}} input
   */
  async import(input) {
    const adapter = this.adapters.find((a) => a.name === input.provider);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${input.provider}`);
    }

    if (!adapter.canParse(input.payload)) {
      throw new Error(`Adapter ${adapter.name} cannot parse provided payload`);
    }

    const conversations = await adapter.parse(input.payload);

    return {
      provider: input.provider,
      importedAt: new Date().toISOString(),
      conversations,
      stats: {
        conversationCount: conversations.length,
        messageCount: conversations.reduce((acc, c) => acc + c.messages.length, 0)
      }
    };
  }
}
