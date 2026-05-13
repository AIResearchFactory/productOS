import { execSync } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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
    if (process.platform === 'win32') {
        try {
            const output = execSync(`netstat -ano -p tcp | findstr :${port}`, { encoding: 'utf8' });
            return [...new Set(output
                .split(/\r?\n/)
                .map((line) => line.trim().split(/\s+/))
                .filter((parts) => parts.length >= 5)
                .filter((parts) => {
                    const localAddress = parts[1] || '';
                    const state = parts[3] || '';
                    return localAddress.endsWith(`:${port}`) && /^(LISTENING|ESTABLISHED)$/i.test(state);
                })
                .map((parts) => parts[4])
                .filter(Boolean))];
        } catch {
            return [];
        }
    }

    try {
        const lsofOutput = execSync(`lsof -t -i:${port}`, { encoding: 'utf8' }).trim();
        return lsofOutput ? [...new Set(lsofOutput.split(/\s+/).filter(Boolean))] : [];
    } catch {
        return [];
    }
}

function killPid(pid) {
    try {
        console.log(`  - Killing PID ${pid}...`);
        if (process.platform === 'win32') {
            execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
        } else {
            execSync(`kill -9 ${pid}`);
        }
        console.log(`  ✓ PID ${pid} terminated.`);
    } catch (killErr) {
        console.log(`  ! Failed to kill PID ${pid}: ${killErr.message}`);
    }
}

// ── Open browser helper ──────────────────────────────────────────────
function openBrowser(url) {
    const platform = process.platform;
    try {
        if (platform === 'darwin') {
            execSync(`open "${url}"`);
        } else if (platform === 'win32') {
            execSync(`start "" "${url}"`);
        } else {
            execSync(`xdg-open "${url}"`);
        }
    } catch {
        console.log(`Open ${url} manually`);
    }
}

stop();
