import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getAppDataDir } from './paths.mjs';

const execPromise = promisify(exec);

export async function checkCli(command) {
  try {
    // On Unix-like systems, 'which' checks if a command is in PATH
    // On Windows, 'where' is the equivalent
    const checkCmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    await execPromise(checkCmd);
    return { installed: true, in_path: true };
  } catch (error) {
    return { installed: false, in_path: false };
  }
}

export async function getAppConfig() {
  const appDataDir = await getAppDataDir();
  // In a real app, version would come from package.json
  return {
    app_data_directory: appDataDir,
    installation_date: 'node-prototype',
    version: '0.3.0-node',
    claude_code_enabled: (await checkCli('claude')).installed,
    ollama_enabled: (await checkCli('ollama')).installed,
    gemini_enabled: (await checkCli('gemini')).installed,
    openai_enabled: (await checkCli('openai')).installed,
    last_update_check: new Date().toISOString(),
  };
}
