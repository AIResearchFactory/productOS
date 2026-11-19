import { execFileSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const COMPANION_SERVER_URL = 'http://localhost:51423/api/system/shutdown';

async function stop() {
    console.log('--- ProductOS Stop Sequence ---');

    // 1. Try Graceful Shutdown of the companion server
    try {
        console.log('Sending shutdown signal to companion server (51423)...');
        await new Promise((resolve, reject) => {
            const req = http.request(COMPANION_SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 1000
            }, (res) => {
                resolve(res);
            });
            req.on('error', (e) => reject(e));
            req.end();
        });
        console.log('✓ Graceful shutdown signal received.');
    } catch (e) {
        console.log('! Companion server was not reachable or failed to shut down gracefully.');
    }

    // 2. Aggressively kill any remaining processes on relevant ports
    const ports = [5173, 51423];
    for (const port of ports) {
        const pids = findPidsForPort(port);
        if (pids.length === 0) {
            console.log(`✓ Port ${port} is clear.`);
            continue;
        }

        console.log(`Found ${pids.length} process(es) on port ${port}: ${pids.join(', ')}`);
        for (const pid of pids) {
            killPid(pid);
        }
    }

    console.log('--- Stop Sequence Complete ---');

    // 3. Open landing page (Disabled in favor of PWA offline redirect in the same tab)
    /*
    const landingPath = path.join(ROOT, 'landing', 'server-stopped.html');
    if (fs.existsSync(landingPath) && !process.env.CI) {
        openBrowser(`file://${landingPath}`);
    }
    */
}

function findPidsForPort(port) {
    const safePort = Number(port);
    if (!Number.isInteger(safePort) || safePort <= 0 || safePort > 65535) return [];

    if (process.platform === 'win32') {
        try {
            const output = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
            return [...new Set(output
                .split(/\r?\n/)
                .map((line) => line.trim().split(/\s+/))
                .filter((parts) => parts.length >= 5)
                .filter((parts) => {
                    const localAddress = parts[1] || '';
                    const state = parts[3] || '';
                    return localAddress.endsWith(`:${safePort}`) && /^LISTENING$/i.test(state);
                })
                .map((parts) => parts[4])
                .filter((pid) => /^\d+$/.test(pid)))];
        } catch {
            return [];
        }
    }

    try {
        const lsofOutput = execFileSync('lsof', ['-t', '-nP', `-iTCP:${safePort}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim();
        return lsofOutput ? [...new Set(lsofOutput.split(/\s+/).filter((pid) => /^\d+$/.test(pid)))] : [];
    } catch {
        return [];
    }
}

function killPid(pid) {
    const numericPid = Number(pid);
    if (!Number.isInteger(numericPid) || numericPid <= 0) {
        console.log(`  ! Skipping invalid PID: ${pid}`);
        return;
    }
    try {
        console.log(`  - Killing PID ${numericPid}...`);
        if (process.platform === 'win32') {
            execFileSync('taskkill', ['/PID', String(numericPid), '/T', '/F'], { stdio: 'ignore' });
        } else {
            process.kill(numericPid, 'SIGKILL');
        }
        console.log(`  ✓ PID ${numericPid} terminated.`);
    } catch (killErr) {
        console.log(`  ! Failed to kill PID ${numericPid}: ${killErr.message}`);
    }
}

// ── Open browser helper ──────────────────────────────────────────────
function openBrowser(url) {
    const platform = process.platform;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
        if (platform === 'darwin') {
            execFileSync('open', [parsed.toString()]);
        } else if (platform === 'win32') {
            execFileSync('cmd', ['/c', 'start', '', parsed.toString()]);
        } else {
            execFileSync('xdg-open', [parsed.toString()]);
        }
    } catch {
        console.log(`Open ${url} manually`);
    }
}

stop();
