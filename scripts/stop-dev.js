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
        try {
            // Find all PIDs using lsof
            const lsofOutput = execSync(`lsof -t -i:${port}`, { encoding: 'utf8' }).trim();
            if (lsofOutput) {
                const pids = lsofOutput.split(/\s+/).filter(Boolean);
                console.log(`Found ${pids.length} process(es) on port ${port}: ${pids.join(', ')}`);

                for (const pid of pids) {
                    try {
                        console.log(`  - Killing PID ${pid}...`);
                        execSync(`kill -9 ${pid}`);
                        console.log(`  ✓ PID ${pid} terminated.`);
                    } catch (killErr) {
                        console.log(`  ! Failed to kill PID ${pid}: ${killErr.message}`);
                    }
                }
            } else {
                console.log(`✓ No processes found on port ${port}.`);
            }
        } catch (e) {
            // execSync fails if lsof returns nothing (no process found)
            console.log(`✓ Port ${port} is clear.`);
        }
    }

    console.log('--- Stop Sequence Complete ---');

    // 3. Open landing page
    const landingPath = path.join(ROOT, 'landing', 'server-stopped.html');
    if (fs.existsSync(landingPath) && !process.env.CI) {
        openBrowser(`file://${landingPath}`);
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
