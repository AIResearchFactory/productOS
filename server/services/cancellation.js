/**
 * Port of Rust CancellationService.
 * Manages active child processes and cancellation tokens.
 */

class CancellationService {
  constructor() {
    /** @type {Map<string, import('child_process').ChildProcess>} */
    this.activeProcesses = new Map();
    /** @type {Map<string, AbortController>} */
    this.activeTokens = new Map();
  }

  registerProcess(id, childProcess) {
    this.activeProcesses.set(id, childProcess);
  }

  registerToken(id) {
    const controller = new AbortController();
    this.activeTokens.set(id, controller);
    return controller.signal;
  }

  async cancelProcess(id) {
    console.log(`[cancellation] Canceling execution for: ${id}`);

    const child = this.activeProcesses.get(id);
    if (child) {
      console.log(`[cancellation] Killing OS process for ${id}`);
      child.kill('SIGTERM');
      this.activeProcesses.delete(id);
    }

    const controller = this.activeTokens.get(id);
    if (controller) {
      console.log(`[cancellation] Triggering cancellation token for ${id}`);
      controller.abort();
      this.activeTokens.delete(id);
    }
  }

  removeProcess(id) {
    this.activeProcesses.delete(id);
  }

  removeToken(id) {
    this.activeTokens.delete(id);
  }
}

export const cancellationManager = new CancellationService();
