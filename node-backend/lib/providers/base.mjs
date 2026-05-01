export class AIProvider {
  async chat(request) {
    throw new Error('chat not implemented');
  }

  async chatStream(request) {
    throw new Error('chatStream not implemented');
  }

  async resolveModel() {
    return '';
  }

  async listModels() {
    return [];
  }

  supportsMcp() {
    return false;
  }

  providerType() {
    throw new Error('providerType not implemented');
  }

  isAvailable() {
    return true;
  }

  async checkAuthentication() {
    return true;
  }

  async checkHealth() {
    if (this.isAvailable()) {
      const authenticated = await this.checkAuthentication().catch(() => false);
      if (authenticated) {
        return { status: 'healthy' };
      } else {
        return { status: 'unhealthy', message: 'Authentication missing' };
      }
    } else {
      return { status: 'unhealthy', message: 'Provider not detected' };
    }
  }

  metadata() {
    return {
      id: 'unknown',
      name: 'Unknown Provider',
      description: '',
      capabilities: [],
      models: [],
    };
  }

  getSetupGuidance() {
    return [];
  }
}
