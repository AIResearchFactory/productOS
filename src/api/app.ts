import { tauriApi } from './tauri';
import { runtimeApi } from './runtime';

export const isTauriRuntime = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(
    w.__TAURI_INTERNALS__ ||
    w.__TAURI__?.core?.invoke ||
    w.__TAURI__?.invoke ||
    w.__TAURI_IPC__
  );
};

export const appApi = isTauriRuntime() ? tauriApi : runtimeApi;
