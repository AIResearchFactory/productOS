// import { tauriApi } from './tauri'; // Deprecated
import { runtimeApi } from './runtime';

export const isTauriRuntime = (): boolean => false; // Disabled

export const appApi = runtimeApi;
