import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');
const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;

let tempRoot;
let activeServerChild = null;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => resolve(addr.port));
    });
  });
}

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(sigkillTimer);
      clearTimeout(hardTimer);
      resolve();
    };

    child.once('close', done);
    child.once('exit', done);

    try {
      child.kill('SIGTERM');
    } catch {
      done();
      return;
    }

    const sigkillTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {
          done();
        }
      }
    }, 2000);
    sigkillTimer.unref?.();

    const hardTimer = setTimeout(done, 3500);
    hardTimer.unref?.();
  });
}

async function waitForServerReady(baseUrl, child) {
  let stderr = '';
  child.stderr?.on('data', (d) => {
    stderr += d.toString();
  });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}: ${stderr}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // Retry until ready
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for server at ${baseUrl}. stderr: ${stderr}`);
}

async function startTestServer(settingsObj = { activeProvider: 'none' }) {
  const port = await getFreePort();
  const homeDir = path.join(tempRoot, 'home');
  const projectsDir = path.join(tempRoot, 'projects');
  const appDataDir = path.join(tempRoot, 'app-data');
  const tmpDir = path.join(tempRoot, 'tmp');

  await Promise.all([
    fs.mkdir(homeDir, { recursive: true }),
    fs.mkdir(projectsDir, { recursive: true }),
    fs.mkdir(appDataDir, { recursive: true }),
    fs.mkdir(tmpDir, { recursive: true }),
  ]);

  await fs.writeFile(
    path.join(appDataDir, 'settings.json'),
    JSON.stringify(settingsObj),
    'utf8'
  );

  const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
  const child = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      HOME: homeDir,
      PROJECTS_DIR: projectsDir,
      APP_DATA_DIR: appDataDir,
      TMPDIR: tmpDir,
      TMP: tmpDir,
      TEMP: tmpDir,
      NODE_ENV: 'test',
      ALLOW_UNENCRYPTED_SECRETS_FOR_TESTS: 'true',
      PRODUCTOS_NODE_SERVER_PORT: String(port),
      PRODUCTOS_BIND_HOST: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  activeServerChild = child;

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServerReady(baseUrl, child);
  return { child, baseUrl, projectsDir, tmpDir };
}

beforeEach(async () => {
  activeServerChild = null;
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-mm-server-'));
});

afterEach(async () => {
  await stopChildProcess(activeServerChild);
  activeServerChild = null;
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('POST /api/projects/create updates active project tracking so subsequent switches clean the created project', async () => {
  const { baseUrl } = await startTestServer();

  const createProject = async (name) => {
    const res = await fetch(`${baseUrl}/api/projects/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    assert.equal(res.status, 200);
    return res.json();
  };

  const projA = await createProject('Project A');
  const projB = await createProject('Project B');

  // Seed temp file inside Project B (which became active via creation)
  const bTmpDir = path.join(projB.path, '.metadata', '.tmp-chat', 'run-b');
  await fs.mkdir(bTmpDir, { recursive: true });
  await fs.writeFile(path.join(bTmpDir, 'leak.png'), 'secret-b');

  // Create Project C -> must stop/clean Project B before setting C active
  const projC = await createProject('Project C');
  await assert.rejects(() => fs.access(bTmpDir));

  // Seed temp file inside Project C and switch explicitly to Project A
  const cTmpDir = path.join(projC.path, '.metadata', '.tmp-chat', 'run-c');
  await fs.mkdir(cTmpDir, { recursive: true });
  await fs.writeFile(path.join(cTmpDir, 'leak.png'), 'secret-c');

  const switchRes = await fetch(`${baseUrl}/api/projects/active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: projA.id }),
  });
  assert.equal(switchRes.status, 200);
  await assert.rejects(() => fs.access(cTmpDir));
});

test('POST /api/system/shutdown stops admitting work, aborts active media writers, and sweeps temp files before exiting', async () => {
  const markerFile = path.join(tempRoot, 'writer-started.txt');
  const slowCliScript = path.join(tempRoot, 'slow-cli.mjs');
  await fs.writeFile(
    slowCliScript,
    `import fs from 'node:fs';
const imgs = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(markerFile)}, imgs.join(','), 'utf8');
setTimeout(() => {
  process.stdout.write('Finished after delay');
}, 4000);
`,
    'utf8'
  );

  const { child, baseUrl, tmpDir } = await startTestServer({
    activeProvider: 'custom-slow-cli',
    customClis: [
      {
        id: 'slow-cli',
        name: 'Slow CLI',
        command: `"${process.execPath}" "${slowCliScript}"`,
        args: ['{{images}}'],
        isConfigured: true,
        isCloud: false,
        supportsImages: true,
      },
    ],
  });

  const createRes = await fetch(`${baseUrl}/api/projects/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Shutdown Project' }),
  });
  assert.equal(createRes.status, 200);
  const project = await createRes.json();

  const chatPromise = fetch(`${baseUrl}/api/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: project.id,
      provider_type: 'custom-slow-cli',
      messages: [
        {
          role: 'user',
          content: 'Analyze image',
          attachments: [
            {
              name: 'slow.png',
              mimeType: 'image/png',
              dataUrl: `data:image/png;base64,${PNG_BYTES.toString('base64')}`,
            },
          ],
        },
      ],
    }),
  }).catch((err) => err);

  // Wait until the slow CLI has started and observed the materialized temp image
  const deadline = Date.now() + 8000;
  let observedPath = '';
  while (Date.now() < deadline) {
    try {
      observedPath = (await fs.readFile(markerFile, 'utf8')).trim();
      if (observedPath) break;
    } catch {
      // Wait for writer
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.ok(observedPath.includes('.tmp-chat'), 'CLI should have observed materialized temp file');

  const exitPromise = new Promise((resolve) => {
    child.once('exit', (code) => resolve(code));
  });

  const shutdownPromise = fetch(`${baseUrl}/api/system/shutdown`, { method: 'POST' });

  // Concurrent new work must be rejected once shutdown starts
  const lateSendResult = await fetch(`${baseUrl}/api/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: project.id, messages: [{ role: 'user', content: 'late' }] }),
  })
    .then((r) => r.status)
    .catch(() => 'connection-closed');
  assert.ok(
    lateSendResult === 503 || lateSendResult === 'connection-closed',
    `Expected shutdown rejection (503 or connection-closed), got ${lateSendResult}`
  );

  const shutdownRes = await shutdownPromise;
  assert.equal(shutdownRes.status, 200);

  const exitCode = await exitPromise;
  assert.equal(exitCode, 0);
  await chatPromise;

  const projectTmpEntries = await fs.readdir(path.join(project.path, '.metadata', '.tmp-chat')).catch(() => []);
  assert.equal(projectTmpEntries.length, 0);
  const globalTmpEntries = await fs.readdir(path.join(tmpDir, 'productos-chat-tmp')).catch(() => []);
  assert.equal(globalTmpEntries.length, 0);
});

test('POST /api/chat/send accepts four 10 MiB Base64 images with request overhead', async () => {
  const fastCliScript = path.join(tempRoot, 'fast-cli.mjs');
  await fs.writeFile(
    fastCliScript,
    `process.stdin.resume();
process.stdin.on('end', () => {
  process.stdout.write('Processed batch');
});
`,
    'utf8'
  );

  const { baseUrl } = await startTestServer({
    activeProvider: 'custom-fast-cli',
    customClis: [
      {
        id: 'fast-cli',
        name: 'Fast CLI',
        command: `"${process.execPath}" "${fastCliScript}"`,
        isConfigured: true,
        isCloud: false,
        supportsImages: true,
      },
    ],
  });

  const createRes = await fetch(`${baseUrl}/api/projects/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Max Batch Project' }),
  });
  assert.equal(createRes.status, 200);
  const project = await createRes.json();

  const maxPng = Buffer.alloc(MAX_CHAT_IMAGE_BYTES);
  PNG_BYTES.copy(maxPng, 0);
  const dataUrl = `data:image/png;base64,${maxPng.toString('base64')}`;

  const res = await fetch(`${baseUrl}/api/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: project.id,
      provider_type: 'custom-fast-cli',
      messages: [
        { role: 'user', content: 'Context '.repeat(100) },
        { role: 'assistant', content: 'Reply '.repeat(100) },
        {
          role: 'user',
          content: 'Analyze 4 full-size images',
          attachments: [
            { name: 'img1.png', mimeType: 'image/png', dataUrl },
            { name: 'img2.png', mimeType: 'image/png', dataUrl },
            { name: 'img3.png', mimeType: 'image/png', dataUrl },
            { name: 'img4.png', mimeType: 'image/png', dataUrl },
          ],
        },
      ],
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.content, 'Processed batch');

  const tmpEntries = await fs.readdir(path.join(project.path, '.metadata', '.tmp-chat')).catch(() => []);
  assert.equal(tmpEntries.length, 0);
});
