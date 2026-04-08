export interface OnboardingCliState {
  selectedProviders: string[];
  claudeInstalled?: boolean;
  ollamaInstalled?: boolean;
  geminiInstalled?: boolean;
  openAiCliInstalled?: boolean;
}

export function isOnboardingReady(state: OnboardingCliState): boolean {
  const { selectedProviders } = state;

  return (
    (!selectedProviders.includes('claudeCode') || !!state.claudeInstalled) &&
    (!selectedProviders.includes('ollama') || !!state.ollamaInstalled) &&
    (!selectedProviders.includes('geminiCli') || !!state.geminiInstalled) &&
    (!selectedProviders.includes('openAiCli') || !!state.openAiCliInstalled)
  );
}

export function getCodexReminderCopy(): string[] {
  return [
    'Codex CLI Installation Required',
    'Install Codex CLI in your terminal before continuing.',
    'productOS checks for codex first and falls back to openai.',
    'Install Codex CLI in your terminal',
    'Log in there before continuing',
    'Then click Re-detect Dependencies'
  ];
}
