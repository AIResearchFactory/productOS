use anyhow::{anyhow, Result};
use regex::Regex;
use std::path::{Path, PathBuf};

use crate::models::ai::OpenAiCliConfig;
use crate::utils::process::{parse_command_string, resolve_command_path, std_command, tokio_command};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DetectedOpenAiCli {
    pub command_name: String,
    pub path: PathBuf,
    pub version: Option<String>,
    pub in_path: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenAiCliAuthProbe {
    pub connected: bool,
    pub method: String,
    pub details: String,
}

pub fn detect_openai_cli(config: Option<&OpenAiCliConfig>) -> Option<DetectedOpenAiCli> {
    let mut candidates: Vec<(String, Option<PathBuf>)> = Vec::new();

    if let Some(config) = config {
        if let Ok(parsed) = parse_command_string(&config.command) {
            candidates.push((parsed.program.clone(), config.detected_path.clone()));
        }
        if let Some(path) = &config.detected_path {
            let command_name = path
                .file_stem()
                .and_then(|stem| stem.to_str())
                .unwrap_or("codex")
                .to_string();
            candidates.push((command_name, Some(path.clone())));
        }
    }

    candidates.push(("codex".to_string(), None));
    candidates.push(("openai".to_string(), None));

    for (command_name, preferred_path) in candidates {
        if let Some(detected) = detect_candidate(&command_name, preferred_path.as_deref()) {
            return Some(detected);
        }
    }

    None
}

pub async fn probe_openai_cli_auth(config: &OpenAiCliConfig) -> OpenAiCliAuthProbe {
    let Some(detected) = detect_openai_cli(Some(config)) else {
        return OpenAiCliAuthProbe {
            connected: false,
            method: "openai-cli-login".to_string(),
            details: "OpenAI/Codex CLI not found. Install Codex CLI or configure a working command first.".to_string(),
        };
    };

    if is_codex_command(&detected.command_name) {
        return match tokio::time::timeout(std::time::Duration::from_secs(3), async {
            tokio_command(&detected.path)
                .args(["login", "status"])
                .output()
                .await
        })
        .await
        {
            Ok(Ok(output)) => parse_codex_auth_output(&output),
            Ok(Err(err)) => OpenAiCliAuthProbe {
                connected: false,
                method: "openai-cli-login".to_string(),
                details: format!("Failed to query Codex login status: {}", err),
            },
            Err(_) => OpenAiCliAuthProbe {
                connected: false,
                method: "openai-cli-login".to_string(),
                details: "Timed out while checking Codex login status. Please retry after opening a terminal and verifying `codex login status`.".to_string(),
            },
        };
    }

    OpenAiCliAuthProbe {
        connected: false,
        method: "openai-cli-login".to_string(),
        details: format!(
            "The configured CLI (`{}`) is installed, but this build does not support ChatGPT session login/status detection. On Windows, use `codex login` manually in your own terminal or configure OPENAI_API_KEY instead.",
            detected.command_name
        ),
    }
}

pub async fn logout_openai_cli(config: &OpenAiCliConfig) -> Result<()> {
    let Some(detected) = detect_openai_cli(Some(config)) else {
        return Ok(());
    };

    if is_codex_command(&detected.command_name) {
        let _ = tokio::time::timeout(std::time::Duration::from_secs(5), async {
            tokio_command(&detected.path).arg("logout").output().await
        })
        .await;
        return Ok(());
    }

    Err(anyhow!(
        "The configured OpenAI CLI does not support managed logout in productOS."
    ))
}

pub fn manual_login_command(config: &OpenAiCliConfig) -> Result<String> {
    let parsed = parse_command_string(&config.command).map_err(|e| anyhow!(e))?;
    let mut parts = vec![parsed.program];
    parts.extend(parsed.args);
    parts.push("login".to_string());
    Ok(parts.join(" "))
}

fn detect_candidate(command_name: &str, preferred_path: Option<&Path>) -> Option<DetectedOpenAiCli> {
    let resolved_path = preferred_path
        .and_then(verify_candidate)
        .or_else(|| resolve_command_path(command_name).and_then(|path| verify_candidate(path.as_path())));

    let path = resolved_path?;
    let version = get_version(&path);
    let in_path = resolve_command_path(command_name).is_some();

    Some(DetectedOpenAiCli {
        command_name: normalize_command_name(command_name, &path),
        path,
        version,
        in_path,
    })
}

fn verify_candidate(path: &Path) -> Option<PathBuf> {
    if !path.exists() {
        return None;
    }

    let output = std_command(path).arg("--version").output().ok()?;
    let combined = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
    .to_lowercase();

    if combined.contains("codex") || combined.contains("openai") {
        return Some(path.to_path_buf());
    }

    let version_re = Regex::new(r"\d+(\.\d+)+").ok()?;
    if output.status.success() && version_re.is_match(&combined) {
        return Some(path.to_path_buf());
    }

    None
}

fn get_version(path: &Path) -> Option<String> {
    let output = std_command(path).arg("--version").output().ok()?;
    let combined = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let version_re = Regex::new(r"\d+(\.\d+)+").ok()?;
    version_re
        .find(&combined)
        .map(|capture| capture.as_str().to_string())
}

fn normalize_command_name(command_name: &str, path: &Path) -> String {
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(command_name)
        .to_lowercase();

    if stem == "codex" || stem == "codex-cli" {
        "codex".to_string()
    } else if stem == "openai" {
        "openai".to_string()
    } else {
        command_name.to_lowercase()
    }
}

fn is_codex_command(command_name: &str) -> bool {
    matches!(command_name.to_lowercase().as_str(), "codex" | "codex-cli")
}

fn parse_codex_auth_output(output: &std::process::Output) -> OpenAiCliAuthProbe {
    let combined = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let normalized = combined.to_lowercase();

    let connected = output.status.success()
        && !normalized.contains("not logged")
        && !normalized.contains("not authenticated")
        && !normalized.contains("login required");

    OpenAiCliAuthProbe {
        connected,
        method: "openai-cli-login".to_string(),
        details: if connected {
            "Codex CLI session is authenticated.".to_string()
        } else if combined.trim().is_empty() {
            "Codex CLI is installed but not logged in. On Windows, run `codex login` manually in your own terminal, then refresh status here.".to_string()
        } else {
            format!(
                "Codex CLI is installed but not logged in yet. On Windows, run `codex login` manually in your own terminal, then refresh status here. Latest status: {}",
                combined.trim()
            )
        },
    }
}
