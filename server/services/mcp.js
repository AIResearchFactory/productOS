import { spawn } from 'child_process';
import { loadGlobalSettings } from './settings.js';
import { getSecret } from './secrets.js';
import readline from 'readline';

async function startServer(config) {
  const env = { ...process.env, ...config.env };
  
  if (config.secretsEnv) {
    for (const [k, secretId] of Object.entries(config.secretsEnv)) {
      const val = await getSecret(secretId);
      if (val) env[k] = val;
    }
  }

  const child = spawn(config.command, config.args || [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env
  });

  let rpcIdCounter = 1;
  const pendingRequests = new Map();

  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pendingRequests.has(msg.id)) {
        pendingRequests.get(msg.id)(msg);
        pendingRequests.delete(msg.id);
      }
    } catch (e) {
      // Ignore non-json stdout
    }
  });

  const callJsonRpc = (method, params) => {
    return new Promise((resolve, reject) => {
      const id = rpcIdCounter++;
      const req = { jsonrpc: '2.0', id, method, params };
      pendingRequests.set(id, (res) => {
        if (res.error) reject(new Error(res.error.message || JSON.stringify(res.error)));
        else resolve(res.result);
      });
      child.stdin.write(JSON.stringify(req) + '\n');
    });
  };

  const sendNotification = (method, params) => {
    const notif = { jsonrpc: '2.0', method, params };
    child.stdin.write(JSON.stringify(notif) + '\n');
  };

  await callJsonRpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'ai-researcher', version: '1.0.0' }
  });
  sendNotification('notifications/initialized', {});

  return { child, callJsonRpc };
}

export async function getMcpTools() {
  const settings = loadGlobalSettings();
  const allTools = [];

  for (const config of (settings.mcpServers || [])) {
    if (!config.enabled) continue;
    try {
      const server = await startServer(config);
      const res = await server.callJsonRpc('tools/list', {});
      const tools = res.tools || [];
      for (const t of tools) {
        t.name = `${config.id}__${t.name}`;
        allTools.push(t);
      }
      server.child.kill();
    } catch (e) {
      console.warn(`MCP Discovery: Failed to get tools from ${config.name}: ${e.message}`);
    }
  }
  return allTools;
}

export async function callMcpTool(toolName, argumentsObj) {
  const parts = toolName.split('__');
  if (parts.length < 2) throw new Error(`Invalid tool name format: ${toolName}`);

  const serverId = parts[0];
  const originalToolName = parts.slice(1).join('__');

  const settings = loadGlobalSettings();
  const config = settings.mcpServers?.find(s => s.id === serverId);
  if (!config) throw new Error(`MCP server ${serverId} not found`);

  const server = await startServer(config);
  try {
    const res = await server.callJsonRpc('tools/call', {
      name: originalToolName,
      arguments: argumentsObj
    });
    return res;
  } finally {
    server.child.kill();
  }
}
