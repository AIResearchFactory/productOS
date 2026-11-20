import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';

const CLIENT_ID = 'pSRE7Bv6vB8K5e9P9C4L6y5D5M2z2P4';
const AUTHORIZE_URL = 'https://auth0.openai.com/authorize';
const TOKEN_URL = 'https://auth0.openai.com/oauth/token';
const AUDIENCE = 'https://api.openai.com/v1';
const REDIRECT_URI = 'http://localhost:51424/auth/callback';
const CALLBACK_PORT = 51424;

function openUrlInBrowser(rawUrl) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('OAuth URL must use https:');
  }
  const safeUrl = parsed.toString();
  let child;
  if (process.platform === 'darwin') {
    child = spawn('open', [safeUrl], { detached: true, stdio: 'ignore' });
  } else if (process.platform === 'win32') {
    child = spawn('rundll32', ['url.dll,FileProtocolHandler', safeUrl], { detached: true, stdio: 'ignore' });
  } else {
    child = spawn('xdg-open', [safeUrl], { detached: true, stdio: 'ignore' });
  }
  child.on('error', () => {});
  child.unref();
}

export class OpenAiOAuth {
  static generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
  }

  static generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  static async login() {
    const verifier = this.generateCodeVerifier();
    const challenge = this.generateCodeChallenge(verifier);
    const state = crypto.randomBytes(16).toString('hex');

    const authUrl = new URL(AUTHORIZE_URL);
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid profile email offline_access model.request model.read organization.read organization.write thread.read thread.write');
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('audience', AUDIENCE);

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutHandle = null;

      const cleanup = () => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        try { server.close(); } catch {}
      };

      const finishResolve = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const finishReject = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      };

      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        const plainHeaders = {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Content-Type-Options': 'nosniff',
        };

        if (url.pathname === '/auth/callback') {
          const code = url.searchParams.get('code');
          const receivedState = url.searchParams.get('state');

          if (receivedState !== state) {
            res.writeHead(400, plainHeaders);
            res.end('State mismatch error');
            finishReject(new Error('State mismatch error'));
            return;
          }

          if (!code) {
            res.writeHead(400, plainHeaders);
            res.end('No code provided');
            finishReject(new Error('No code provided'));
            return;
          }

          try {
            const tokens = await this.exchangeCodeForTokens(code, verifier);

            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
            });
            res.end(`
              <html>
                <body style="font-family: system-ui; text-align: center; padding: 60px;">
                  <h2 style="color: #38a169;">✓ Authentication Successful</h2>
                  <p>You can close this tab and return to productOS.</p>
                  <script>setTimeout(() => window.close(), 2000)</script>
                </body>
              </html>
            `);

            finishResolve(tokens);
          } catch (error) {
            res.writeHead(500, plainHeaders);
            res.end(`Authentication failed: ${error.message}`);
            finishReject(error);
          }
        } else {
          res.writeHead(404, plainHeaders);
          res.end('Not found');
        }
      });

      server.on('error', (err) => {
        finishReject(err);
      });

      server.listen(CALLBACK_PORT, '127.0.0.1', () => {
        console.log(`[OpenAI OAuth] Callback server listening on 127.0.0.1:${CALLBACK_PORT}`);
        try {
          openUrlInBrowser(authUrl.toString());
        } catch (err) {
          console.error('[OpenAI OAuth] Failed to open browser:', err.message);
        }
      });

      // Timeout after 5 minutes
      timeoutHandle = setTimeout(() => {
        finishReject(new Error('Authentication timed out'));
      }, 300000);
      timeoutHandle.unref?.();
    });
  }

  static async exchangeCodeForTokens(code, verifier) {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    return await response.json();
  }

  static async refreshToken(refreshToken) {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    return await response.json();
  }
}
