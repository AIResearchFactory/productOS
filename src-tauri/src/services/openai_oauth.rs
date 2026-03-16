use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;

/// OpenAI's public OAuth client ID (same one used by Codex CLI).
const OPENAI_CLIENT_ID: &str = "app_EMoamEEZ73f0CkXaXp7hrann";

const OPENAI_AUTH_URL: &str = "https://auth.openai.com/oauth/authorize";
const OPENAI_TOKEN_URL: &str = "https://auth.openai.com/oauth/token";

/// Secrets keys under which tokens are stored.
pub const ACCESS_TOKEN_KEY: &str = "OPENAI_OAUTH_ACCESS_TOKEN";
pub const REFRESH_TOKEN_KEY: &str = "OPENAI_OAUTH_REFRESH_TOKEN";
pub const ACCOUNT_ID_KEY: &str = "OPENAI_OAUTH_ACCOUNT_ID";

// ─── PKCE helpers ───────────────────────────────────────────────────────────

fn generate_code_verifier() -> String {
    let mut buf = [0u8; 64];
    rand::thread_rng().fill_bytes(&mut buf);
    URL_SAFE_NO_PAD.encode(buf)
}

fn generate_code_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

// ─── Public API ─────────────────────────────────────────────────────────────

/// Run the full OAuth 2.0 PKCE flow:
///
/// 1. Start a local callback server on a random port.
/// 2. Open the user's browser to the OpenAI authorize page.
/// 3. Wait for the redirect, extract the authorization code.
/// 4. Exchange the code for access + refresh tokens.
/// 5. Store tokens via SecretsService.
///
/// Returns a human-friendly status message.
pub async fn run_oauth_flow() -> Result<String> {
    let code_verifier = generate_code_verifier();
    let code_challenge = generate_code_challenge(&code_verifier);

    // ── 1. Bind a local callback server ──────────────────────────────────
    // Note: port 1455 is specifically allowlisted for this public client ID.
    let port = 1455;
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))
        .map_err(|e| anyhow!("Failed to bind to port 1455 (required for OpenAI OAuth). Is another app using it? Error: {}", e))?;
    
    let redirect_uri = format!("http://localhost:{}/auth/callback", port);

    log::info!("[OpenAI OAuth] Callback server listening on {}", redirect_uri);

    // ── 2. Build authorize URL and open browser ──────────────────────────
    let state = generate_code_verifier(); // random state for CSRF
    let audience = "https://api.openai.com/v1";
    let scope = "openid profile email offline_access";

    let auth_url = format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&code_challenge={}&code_challenge_method=S256&state={}&scope={}&audience={}&id_token_add_organizations=true&codex_cli_simplified_flow=true",
        OPENAI_AUTH_URL,
        OPENAI_CLIENT_ID,
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&code_challenge),
        urlencoding::encode(&state),
        urlencoding::encode(scope),
        urlencoding::encode(audience),
    );

    log::info!("[OpenAI OAuth] Opening browser for authorization...");
    open_browser(&auth_url)?;

    // ── 3. Wait for the callback ─────────────────────────────────────────
    // Wrap in a timeout so we don't block forever.
    let redirect_uri_clone = redirect_uri.clone();
    let state_clone = state.clone();

    let code = tokio::task::spawn_blocking(move || -> Result<String> {
        // Set a 5-minute timeout
        listener.set_nonblocking(false)?;
        let timeout = std::time::Duration::from_secs(300);
        listener
            .set_nonblocking(false)
            .ok();

        // Use a loop with timeout
        let start = std::time::Instant::now();
        loop {
            if start.elapsed() > timeout {
                return Err(anyhow!("OAuth flow timed out (5 minutes). Please try again."));
            }

            // Accept with a short timeout
            listener
                .set_nonblocking(true)
                .ok();
            match listener.accept() {
                Ok((stream, _)) => {
                    return handle_callback(stream, &state_clone, &redirect_uri_clone);
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    continue;
                }
                Err(e) => return Err(anyhow!("Failed to accept connection: {}", e)),
            }
        }
    })
    .await
    .map_err(|e| anyhow!("OAuth callback task failed: {}", e))??;

    // ── 4. Exchange code for tokens ──────────────────────────────────────
    log::info!("[OpenAI OAuth] Received authorization code, exchanging for token...");

    let client = reqwest::Client::new();
    let token_resp = client
        .post(OPENAI_TOKEN_URL)
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", OPENAI_CLIENT_ID),
            ("code", &code),
            ("redirect_uri", &redirect_uri),
            ("code_verifier", &code_verifier),
        ])
        .send()
        .await
        .map_err(|e| anyhow!("Token exchange request failed: {}", e))?;

    if !token_resp.status().is_success() {
        let status = token_resp.status();
        let body = token_resp
            .text()
            .await
            .unwrap_or_else(|_| "no body".to_string());
        return Err(anyhow!(
            "Token exchange failed (HTTP {}): {}",
            status,
            body
        ));
    }

    let token_json: serde_json::Value = token_resp
        .json()
        .await
        .map_err(|e| anyhow!("Failed to parse token response: {}", e))?;

    let access_token = token_json["access_token"]
        .as_str()
        .ok_or_else(|| anyhow!("No access_token in token response"))?;

    let refresh_token = token_json["refresh_token"].as_str().unwrap_or("");

    // Extract account ID from tokens
    let id_token = token_json["id_token"].as_str();
    let mut account_id = None;

    if let Some(token) = id_token {
        if let Some(claims) = parse_jwt_claims(token) {
            account_id = extract_account_id_from_claims(&claims);
        }
    }

    if account_id.is_none() {
        if let Some(claims) = parse_jwt_claims(access_token) {
            account_id = extract_account_id_from_claims(&claims);
        }
    }

    // ── 5. Store tokens ──────────────────────────────────────────────────
    log::info!("[OpenAI OAuth] Storing tokens...");

    let mut custom = HashMap::new();
    custom.insert(ACCESS_TOKEN_KEY.to_string(), access_token.to_string());
    if !refresh_token.is_empty() {
        custom.insert(REFRESH_TOKEN_KEY.to_string(), refresh_token.to_string());
    }
    if let Some(id) = account_id {
        custom.insert(ACCOUNT_ID_KEY.to_string(), id);
    }
    custom.insert(
        "OPENAI_CLI_AUTH_MARKER".to_string(),
        chrono::Utc::now().to_rfc3339(),
    );

    crate::services::secrets_service::SecretsService::save_secrets(
        &crate::services::secrets_service::Secrets {
            claude_api_key: None,
            gemini_api_key: None,
            n8n_webhook_url: None,
            custom_api_keys: custom,
        },
    )
    .map_err(|e| anyhow!("Failed to store OAuth tokens: {}", e))?;

    Ok("OpenAI authentication successful! You are now logged in with your ChatGPT account.".to_string())
}

/// Retrieve the stored OAuth access token (if any).
pub fn get_stored_access_token() -> Option<String> {
    crate::services::secrets_service::SecretsService::get_secret(ACCESS_TOKEN_KEY)
        .ok()
        .flatten()
        .filter(|t| !t.trim().is_empty())
}

/// Retrieve the stored account ID (if any).
pub fn get_stored_account_id() -> Option<String> {
    crate::services::secrets_service::SecretsService::get_secret(ACCOUNT_ID_KEY)
        .ok()
        .flatten()
        .filter(|t| !t.trim().is_empty())
}

/// Clear all stored OAuth tokens.
pub fn clear_tokens() {
    let mut custom = HashMap::new();
    custom.insert(ACCESS_TOKEN_KEY.to_string(), String::new());
    custom.insert(REFRESH_TOKEN_KEY.to_string(), String::new());
    custom.insert(ACCOUNT_ID_KEY.to_string(), String::new());
    custom.insert("OPENAI_CLI_AUTH_MARKER".to_string(), String::new());

    let _ = crate::services::secrets_service::SecretsService::save_secrets(
        &crate::services::secrets_service::Secrets {
            claude_api_key: None,
            gemini_api_key: None,
            n8n_webhook_url: None,
            custom_api_keys: custom,
        },
    );
}

// ─── JWT helpers ──────────────────────────────────────────────────────────

pub fn parse_jwt_claims(token: &str) -> Option<serde_json::Value> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return None;
    }

    let payload = parts[1];
    let decoded = URL_SAFE_NO_PAD.decode(payload).ok()?;
    serde_json::from_slice(&decoded).ok()
}

fn extract_account_id_from_claims(claims: &serde_json::Value) -> Option<String> {
    // 1. Direct field
    if let Some(id) = claims["chatgpt_account_id"].as_str() {
        return Some(id.to_string());
    }

    // 2. Nested in OpenAI auth object
    if let Some(id) = claims["https://api.openai.com/auth"]["chatgpt_account_id"].as_str() {
        return Some(id.to_string());
    }

    // 3. Organization ID
    if let Some(orgs) = claims["organizations"].as_array() {
        if let Some(org) = orgs.first() {
            if let Some(id) = org["id"].as_str() {
                return Some(id.to_string());
            }
        }
    }

    None
}

// ─── Internal helpers ───────────────────────────────────────────────────────

fn handle_callback(
    mut stream: std::net::TcpStream,
    expected_state: &str,
    _redirect_uri: &str,
) -> Result<String> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;

    // Parse GET /auth/callback?code=...&state=...
    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| anyhow!("Invalid HTTP request"))?;

    let query_string = path
        .split('?')
        .nth(1)
        .ok_or_else(|| anyhow!("No query parameters in callback"))?;

    let params: HashMap<String, String> = query_string
        .split('&')
        .filter_map(|pair| {
            let mut kv = pair.splitn(2, '=');
            Some((
                urlencoding::decode(kv.next()?).ok()?.to_string(),
                urlencoding::decode(kv.next().unwrap_or("")).ok()?.to_string(),
            ))
        })
        .collect();

    // Check for errors
    if let Some(err) = params.get("error") {
        let desc = params.get("error_description").cloned().unwrap_or_default();
        let html = format!(
            r#"<html><body style="font-family:system-ui;text-align:center;padding:60px">
            <h2 style="color:#e53e3e">Authentication Failed</h2>
            <p>{}: {}</p>
            <p>You can close this tab.</p>
            </body></html>"#,
            err, desc
        );
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            html.len(),
            html
        );
        stream.write_all(response.as_bytes())?;
        stream.flush()?;
        return Err(anyhow!("OAuth error: {} – {}", err, desc));
    }

    // Validate state
    let received_state = params
        .get("state")
        .ok_or_else(|| anyhow!("No state in callback"))?;
    if received_state != expected_state {
        return Err(anyhow!("State mismatch — possible CSRF attack"));
    }

    // Extract code
    let code = params
        .get("code")
        .ok_or_else(|| anyhow!("No authorization code in callback"))?
        .clone();

    // Send success page
    let html = r#"<html><body style="font-family:system-ui;text-align:center;padding:60px">
    <h2 style="color:#38a169">✓ Authentication Successful</h2>
    <p>You can close this tab and return to productOS.</p>
    <script>setTimeout(()=>window.close(),2000)</script>
    </body></html>"#;

    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        html.len(),
        html
    );
    stream.write_all(response.as_bytes())?;
    stream.flush()?;

    Ok(code)
}

fn open_browser(url: &str) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| anyhow!("Failed to open browser: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", url])
            .spawn()
            .map_err(|e| anyhow!("Failed to open browser: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| anyhow!("Failed to open browser: {}", e))?;
    }

    Ok(())
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_code_verifier_length() {
        let v = generate_code_verifier();
        // 64 bytes → 86 base64url chars (no padding)
        assert_eq!(v.len(), 86);
        // Must be URL-safe
        assert!(v.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));
    }

    #[test]
    fn test_code_challenge_is_s256() {
        let verifier = "test_verifier_1234567890";
        let challenge = generate_code_challenge(verifier);
        // Should be a valid base64url string
        assert!(!challenge.is_empty());
        assert!(challenge.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'));

        // Deterministic
        assert_eq!(challenge, generate_code_challenge(verifier));
    }

    #[test]
    fn test_different_verifiers_produce_different_challenges() {
        let v1 = generate_code_verifier();
        let v2 = generate_code_verifier();
        assert_ne!(v1, v2);
        assert_ne!(generate_code_challenge(&v1), generate_code_challenge(&v2));
    }
}
