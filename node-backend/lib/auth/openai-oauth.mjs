import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { URL } from 'node:url';

const CLIENT_ID = 'pSRE7Bv6vB8K5e9P9C4L6y5D5M2z2P4';
const AUTHORIZE_URL = 'https://auth0.openai.com/authorize';
const TOKEN_URL = 'https://auth0.openai.com/oauth/token';
const AUDIENCE = 'https://api.openai.com/v1';
const REDIRECT_URI = 'http://localhost:51424/auth/callback';
const CALLBACK_PORT = 51424;

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
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        
        if (url.pathname === '/auth/callback') {
          const code = url.searchParams.get('code');
          const receivedState = url.searchParams.get('state');

          if (receivedState !== state) {
            res.writeHead(400);
            res.end('State mismatch error');
            server.close();
            reject(new Error('State mismatch error'));
            return;
          }

          if (!code) {
            res.writeHead(400);
            res.end('No code provided');
            server.close();
            reject(new Error('No code provided'));
            return;
          }

          try {
            const tokens = await this.exchangeCodeForTokens(code, verifier);
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; text-align: center; padding: 60px;">
                  <h2 style="color: #38a169;">✓ Authentication Successful</h2>
                  <p>You can close this tab and return to productOS.</p>
                  <script>setTimeout(() => window.close(), 2000)</script>
                </body>
              </html>
            `);
            
            server.close();
            resolve(tokens);
          } catch (error) {
            res.writeHead(500);
            res.end(`Authentication failed: ${error.message}`);
            server.close();
            reject(error);
          }
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      server.listen(CALLBACK_PORT, () => {
        console.log(`[OpenAI OAuth] Callback server listening on port ${CALLBACK_PORT}`);
        const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${openCmd} "${authUrl.toString()}"`);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timed out'));
      }, 300000);
    });
  }

  static async exchangeCodeForTokens(code, verifier) {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
