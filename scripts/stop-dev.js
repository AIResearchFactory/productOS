import { execSync } from 'child_process';
import http from 'http';

const SERVER_URL = 'http://localhost:51423/api/system/shutdown';

async function stop() {
    console.log('Stopping productOS development environment...');

    // 1. Try Graceful Shutdown of the companion server
    try {
        await new Promise((resolve, reject) => {
            const req = http.request(SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 1000
            }, (res) => {
                resolve(res);
            });
            req.on('error', (e) => reject(e));
            req.end();
        });
        console.log('✓ Sent shutdown signal to companion server.');
    } catch (e) {
        console.log('! Companion server was not reachable or failed to shut down gracefully.');
    }

    // 2. Kill Vite (port 5173) and Companion Server (port 51423) if still running
    const ports = [5173, 51423];
    for (const port of ports) {
        try {
            // Find PID using lsof
            const pid = execSync(`lsof -t -i:${port}`).toString().trim();
            if (pid) {
                console.log(`Killing process on port ${port} (PID: ${pid})...`);
                execSync(`kill -9 ${pid}`);
                console.log(`✓ Killed process on port ${port}.`);
            }
        } catch (e) {
            // No process on that port or error
        }
    }

    console.log('Done.');
}

stop();
