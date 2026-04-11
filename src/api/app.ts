import { tauriApi } from './tauri';
import { runtimeApi } from './runtime';

export const isTauriRuntime = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
};

export const appApi = isTauriRuntime() ? tauriApi : runtimeApi;
