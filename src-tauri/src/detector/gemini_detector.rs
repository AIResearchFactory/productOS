use anyhow::Result;
use async_trait::async_trait;
use regex::Regex;
use std::path::PathBuf;
use std::process::Command;

use super::cli_detector::{check_command_in_path, get_home_based_paths, CliDetector, CliToolInfo};

/// Gemini CLI detector implementation
pub struct GeminiDetector;

impl GeminiDetector {
    pub fn new() -> Self {
        Self
    }

    /// Internal detection implementation
    async fn detect_impl(&self) -> Result<CliToolInfo> {
        let commands = ["gemini", "gemini-cli", "antigravity"];

        for cmd in commands {
            log::debug!("Detecting Gemini CLI installation for command: {}...", cmd);

            let mut gemini_path: Option<PathBuf> = None;
            let mut in_path = false;

            // Strategy 1: Check PATH environment variable
            if let Some(path) = check_command_in_path(cmd).await {
                if self.verify_executable(&path).await {
                    gemini_path = Some(path);
                    in_path = true;
                }
            }

            // Strategy 2: Check common installation directories
            if gemini_path.is_none() {
                let common_paths = self.get_common_paths_for_cmd(cmd);
                for path in common_paths {
                    if path.exists() && self.verify_executable(&path).await {
                        gemini_path = Some(path);
                        break;
                    }
                }
            }

            // Strategy 3: Shell probe (Mac/Linux only)
            #[cfg(any(target_os = "macos", target_os = "linux"))]
            if gemini_path.is_none() {
                if let Some(path) = super::cli_detector::probe_shell_path(cmd).await {
                    if self.verify_executable(&path).await {
                        gemini_path = Some(path);
                        in_path = true;
                    }
                }
            }

            // If found, return info
            if let Some(path) = gemini_path {
                log::info!("Found Gemini CLI for '{}' at {:?}", cmd, path);
                let version = self.get_version(&path).await;
                return Ok(CliToolInfo {
                    name: self.tool_name().to_string(),
                    installed: true,
                    version,
                    path: Some(path),
                    in_path,
                    running: None,
                    authenticated: None,
                    error: None,
                });
            }
        }

        log::debug!("Gemini CLI not detected");
        Ok(CliToolInfo {
            name: self.tool_name().to_string(),
            installed: false,
            version: None,
            path: None,
            in_path: false,
            running: None,
            authenticated: None,
            error: None,
        })
    }

    /// Check if Gemini CLI is authenticated
    async fn check_auth_status(&self, path: &std::path::Path) -> Option<bool> {
        let output = Command::new(path).arg("models").arg("list").output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let combined = format!("{} {}", stdout, stderr).to_lowercase();

                if out.status.success() {
                    if combined.contains("not authenticated")
                        || combined.contains("api key")
                        || combined.contains("unauthorized")
                        || combined.contains("authentication required")
                    {
                        return Some(false);
                    }
                    Some(true)
                } else if combined.contains("not authenticated")
                    || combined.contains("api key")
                    || combined.contains("unauthorized")
                    || combined.contains("authentication required")
                {
                    Some(false)
                } else {
                    None
                }
            }
            Err(_) => None,
        }
    }

    /// Verify Gemini CLI executable
    async fn verify_executable(&self, path: &std::path::Path) -> bool {
        if !path.exists() {
            return false;
        }

        if let Ok(output) = Command::new(path).arg("--version").output() {
            if output.status.success() {
                return true;
            }

            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            let stderr = String::from_utf8_lossy(&output.stderr).to_lowercase();
            let combined = format!("{} {}", stdout, stderr);

            if combined.contains("gemini") || combined.contains("google") {
                return true;
            }

            let re = Regex::new(r"\d+\.\d+(\.\d+)?").unwrap_or_else(|_| Regex::new("").unwrap());
            if re.is_match(&combined) {
                return true;
            }
        }

        if let Ok(output) = Command::new(path).arg("--help").output() {
            if output.status.success() {
                return true;
            }
            let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if stdout.contains("gemini") || stdout.contains("google") {
                return true;
            }
        }

        false
    }

    fn get_common_paths_for_cmd(&self, cmd: &str) -> Vec<PathBuf> {
        let mut paths = Vec::new();

        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            let relative_paths = [
                format!(".local/bin/{}", cmd),
                format!(".npm-global/bin/{}", cmd),
                format!("bin/{}", cmd),
                format!(".cargo/bin/{}", cmd),
                format!("go/bin/{}", cmd),
                format!(".nvm/versions/node/*/bin/{}", cmd),
                format!(".nodenv/versions/*/bin/{}", cmd),
                format!(".asdf/shims/{}", cmd),
            ];

            paths.extend(get_home_based_paths(
                &relative_paths
                    .iter()
                    .map(|s| s.as_str())
                    .collect::<Vec<_>>(),
            ));

            paths.push(PathBuf::from(format!("/usr/local/bin/{}", cmd)));
            paths.push(PathBuf::from(format!("/opt/homebrew/bin/{}", cmd)));
            paths.push(PathBuf::from(format!("/usr/bin/{}", cmd)));
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
                paths.push(PathBuf::from(&app_data).join(format!("Programs\\Gemini\\{}.exe", cmd)));
                paths.push(PathBuf::from(&app_data).join(format!("npm\\{}.cmd", cmd)));
            }
            if let Ok(program_files) = std::env::var("ProgramFiles") {
                paths.push(PathBuf::from(&program_files).join(format!("Gemini\\{}.exe", cmd)));
            }
        }

        paths
    }
}

impl Default for GeminiDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CliDetector for GeminiDetector {
    fn tool_name(&self) -> &str {
        "gemini"
    }

    fn command_name(&self) -> &str {
        "gemini"
    }

    async fn detect(&self) -> Result<CliToolInfo> {
        self.detect_impl().await
    }

    async fn get_version(&self, path: &std::path::Path) -> Option<String> {
        let output = Command::new(path).arg("--version").output().ok()?;

        if output.status.success() {
            let version_str = String::from_utf8_lossy(&output.stdout);
            let version = version_str
                .split_whitespace()
                .last()
                .unwrap_or(version_str.trim())
                .trim_start_matches('v')
                .to_string();

            if !version.is_empty() {
                return Some(version);
            }
        }

        None
    }

    async fn check_authentication(&self) -> Option<bool> {
        if let Ok(info) = self.detect_impl().await {
            if info.installed && info.path.is_some() {
                return self.check_auth_status(&info.path.unwrap()).await;
            }
        }
        None
    }

    fn get_common_paths(&self) -> Vec<PathBuf> {
        self.get_common_paths_for_cmd("gemini")
    }

    fn get_installation_instructions(&self) -> String {
        "Please install Gemini CLI via pip or npm.".to_string()
    }

    async fn verify_path(&self, path: &std::path::Path) -> bool {
        self.verify_executable(path).await
    }
}
