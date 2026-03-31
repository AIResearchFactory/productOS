import type { ChatMessage } from '../api/tauri';

export interface TokenSaverReceipt {
  input_tokens_raw: number;
  input_tokens_optimized: number;
  saved_tokens: number;
  saved_pct: number;
  actions: Array<{ type: string; saved: number }>;
}

export function isTokenSaverEnabled(): boolean;
export function setTokenSaverEnabled(enabled: boolean): void;
export function optimizeMessagesForSend(messages: ChatMessage[], config?: { keepRecentTurns?: number }): {
  messages: ChatMessage[];
  receipt: TokenSaverReceipt;
};
