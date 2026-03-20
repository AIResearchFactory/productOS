import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { Importer } from '../core/importer.js';
import { adapters } from '../providers/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '../../web');

const importer = new Importer(adapters);

const runtimeState = {
  panicMode: false,
  mode: 'normal',
  lastReason: null,
  queueDepth: 0,
  activeWorkers: 0,
  maxWorkers: 6,
  budgets: {
    cpuBudgetPct: 80,
    ramBudgetPct: 80,
    panicCpuPct: 95,
    panicRamPct: 92
  }
};

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function serveFile(res, filePath, contentType) {
  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

function getHealth() {
  const totalMb = os.totalmem() / 1024 / 1024;
  const freeMb = os.freemem() / 1024 / 1024;
  const usedMb = totalMb - freeMb;
  const usedPct = totalMb > 0 ? (usedMb / totalMb) * 100 : 0;

  return {
    mode: runtimeState.mode,
    panicMode: runtimeState.panicMode,
    queueDepth: runtimeState.queueDepth,
    activeWorkers: runtimeState.activeWorkers,
    maxWorkers: runtimeState.maxWorkers,
    memory: {
      totalMb: Math.round(totalMb),
      usedMb: Math.round(usedMb),
      usedPct: Math.round(usedPct)
    },
    budgets: runtimeState.budgets,
    lastReason: runtimeState.lastReason
  };
}

function validatePlan(plan) {
  const startedAt = Date.now();
  const competitorCount = Number(plan?.competitorCount || 10);
  const fanoutSteps = Number(plan?.fanoutSteps || 5);
  const perTaskRamMb = Number(plan?.perTaskRamMb || 220);
  const requestedGlobalParallel = Number(plan?.globalMaxParallel || 0);

  const projectedWorkers = competitorCount * fanoutSteps;
  const recommendedGlobalParallel = Math.max(2, Math.min(8, Math.ceil(os.cpus().length * 0.75)));
  const effectiveParallel = requestedGlobalParallel > 0 ? requestedGlobalParallel : recommendedGlobalParallel;

  const totalMb = os.totalmem() / 1024 / 1024;
  const projectedPeakRamMb = Math.round(effectiveParallel * perTaskRamMb);
  const projectedPeakRamPct = Math.round((projectedPeakRamMb / totalMb) * 100);

  const issues = [];
  if (projectedWorkers > effectiveParallel * 3) {
    issues.push({
      code: 'PARALLEL_EXPLOSION',
      severity: 'high',
      message: `Projected fanout is high (${projectedWorkers} work units). Add batching and step caps.`
    });
  }
  if (projectedPeakRamPct > 80) {
    issues.push({
      code: 'RAM_PRESSURE',
      severity: projectedPeakRamPct > 95 ? 'critical' : 'high',
      message: `Projected RAM usage ${projectedPeakRamPct}% exceeds safe budget.`
    });
  }

  const risk = issues.some((i) => i.severity === 'critical')
    ? 'critical'
    : issues.length
      ? 'high'
      : 'low';

  const suggestions = [
    { op: 'set', path: 'globalMaxParallel', value: recommendedGlobalParallel },
    { op: 'set', path: 'batchSize', value: 4 },
    { op: 'set', path: 'stepDefaults.timeoutMs', value: 600000 },
    { op: 'set', path: 'stepDefaults.maxRetries', value: 1 }
  ];

  return {
    risk,
    issues,
    projection: {
      competitorCount,
      fanoutSteps,
      projectedWorkers,
      recommendedGlobalParallel,
      projectedPeakRamMb,
      projectedPeakRamPct
    },
    suggestions,
    validator: {
      mode: 'static-fast',
      elapsedMs: Date.now() - startedAt,
      maxBudgetMs: 500
    }
  };
}

setInterval(() => {
  const health = getHealth();
  const ram = health.memory.usedPct;
  if (!runtimeState.panicMode && ram >= runtimeState.budgets.ramBudgetPct) {
    runtimeState.mode = 'throttled';
    runtimeState.lastReason = `Memory high (${ram}%). Throttling active.`;
    runtimeState.maxWorkers = 3;
  }
  if (!runtimeState.panicMode && ram >= runtimeState.budgets.panicRamPct) {
    runtimeState.panicMode = true;
    runtimeState.mode = 'panic';
    runtimeState.lastReason = `Panic mode triggered: memory ${ram}% exceeded threshold.`;
    runtimeState.maxWorkers = 1;
  }
  if (!runtimeState.panicMode && ram < runtimeState.budgets.ramBudgetPct - 8) {
    runtimeState.mode = 'normal';
    runtimeState.maxWorkers = 6;
  }
}, 2000);

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return serveFile(res, path.join(webRoot, 'index.html'), 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && req.url === '/app.js') {
    return serveFile(res, path.join(webRoot, 'app.js'), 'application/javascript; charset=utf-8');
  }
  if (req.method === 'GET' && req.url === '/styles.css') {
    return serveFile(res, path.join(webRoot, 'styles.css'), 'text/css; charset=utf-8');
  }

  if (req.method === 'GET' && req.url === '/api/runtime/health') {
    return json(res, 200, getHealth());
  }

  if (req.method === 'POST' && req.url === '/api/runtime/panic') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      const enable = Boolean(parsed.enable);
      runtimeState.panicMode = enable;
      runtimeState.mode = enable ? 'panic' : 'normal';
      runtimeState.maxWorkers = enable ? 1 : 6;
      runtimeState.lastReason = enable ? 'Manual panic mode activation by user.' : 'Panic mode cleared by user.';
      json(res, 200, { ok: true, state: getHealth() });
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/validate') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 512 * 1024) req.socket.destroy();
    });

    req.on('end', () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const result = validatePlan(parsed.plan || {});
        json(res, 200, result);
      } catch (err) {
        json(res, 400, { error: err.message || 'Validation failed' });
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/import') {
    if (runtimeState.panicMode) {
      return json(res, 423, { error: 'Panic mode is active. Disable panic mode to continue import.' });
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.socket.destroy();
      }
    });

    req.on('end', async () => {
      try {
        runtimeState.activeWorkers += 1;
        const parsed = JSON.parse(body || '{}');
        const result = await importer.import({
          provider: parsed.provider,
          payload: parsed.payload
        });
        json(res, 200, result);
      } catch (err) {
        json(res, 400, { error: err.message || 'Import failed' });
      } finally {
        runtimeState.activeWorkers = Math.max(0, runtimeState.activeWorkers - 1);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const port = Number(process.env.PORT || 3199);
server.listen(port, () => {
  console.log(`UI running on http://localhost:${port}`);
});
