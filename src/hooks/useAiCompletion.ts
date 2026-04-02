/**
 * useAiCompletion.ts
 * Debounced AI ghost-text completion hook.
 * Calls the active AI provider (same as chat window) after the user pauses typing.
 * Returns a suggestion string or null. Caller handles Tab-to-accept / Escape-to-dismiss.
 */

import { useState, useRef, useCallback } from 'react';
import { tauriApi } from '@/api/tauri';

const DEBOUNCE_MS = 500;
const MIN_CONTEXT_CHARS = 5;
const MAX_CONTEXT_CHARS = 600;
const TIMEOUT_MS = 5000;

export interface AiCompletionResult {
  /** The ghost-text suggestion, or null if unavailable / disabled */
  suggestion: string | null;
  /** Call this with current document context to request a completion */
  requestCompletion: (context: string) => void;
  /** Dismiss the current suggestion without accepting it */
  dismiss: () => void;
  /** Whether a request is currently in-flight */
  isLoading: boolean;
}

export function useAiCompletion(projectId?: string, enabled = false): AiCompletionResult {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    setSuggestion(null);
    setIsLoading(false);
  }, []);

  const requestCompletion = useCallback(
    (context: string) => {
      // Clear previous debounce + pending request
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current?.abort();
      setSuggestion(null);

      // Guard: feature must be enabled and context must be long enough
      if (!enabled || context.length < MIN_CONTEXT_CHARS) return;

      timerRef.current = setTimeout(async () => {
        const ac = new AbortController();
        abortRef.current = ac;
        setIsLoading(true);

        // Timeout wrapper
        const timeoutId = setTimeout(() => ac.abort(), TIMEOUT_MS);

        try {
          const trimmedContext = context.slice(-MAX_CONTEXT_CHARS);
          const response = await tauriApi.sendMessage(
            [
              {
                role: 'system',
                content:
                  'You are an inline writing assistant. Continue the following text with 1–2 sentences maximum that naturally complete what the user is writing. Only return the completion text itself — do not repeat the original text, add explanations, or use quotes.',
              },
              {
                role: 'user',
                content: trimmedContext,
              },
            ],
            projectId
          );

          if (!ac.signal.aborted && response?.content) {
            const trimmed = response.content.trim();
            if (trimmed.length > 0) {
              setSuggestion(trimmed);
            }
          }
        } catch (e) {
          // Silent failure — no toast, no error displayed
          if (!ac.signal.aborted) {
            console.debug('[useAiCompletion] AI completion failed silently:', e);
          }
        } finally {
          clearTimeout(timeoutId);
          if (!ac.signal.aborted) setIsLoading(false);
        }
      }, DEBOUNCE_MS);
    },
    [enabled, projectId]
  );

  return { suggestion, requestCompletion, dismiss, isLoading };
}
