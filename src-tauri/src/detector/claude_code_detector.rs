use anyhow::Result;
use async_trait::async_trait;
use regex::Regex;
use std::path::PathBuf;
use std::process::Command;

use super::cli_detector::{check_command_in_path, get_home_based_paths, CliDetector, CliToolInfo};

/// Claude Code CLI detector implementation with enhanced verification
pub struct ClaudeCodeDetector;

impl ClaudeCodeDetector {
    pub fn new() -> Self {
        Self
    }

    /// Verify Claude Code executable with multiple checks
    async fn verify_executable(&self, path: &std::path::Path) -> bool {
        // Check if file exists
        if !path.exists() {
            return false;
        }

        // Try to run --version
        if let Ok(output) = Command::new(path).arg("--version").output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .to_lowercase();
                // Verify it's actually Claude Code
                if stdout.contains("claude") {
                    return true;
                }

                // Also check for version pattern (e.g. "1.0.67") as 'claude' CLI might just output version
                if let Ok(re) = Regex::new(r"^\d+(\.\d+)+") {
                    if re.is_match(&stdout) {
                        return true;
                    }
                }
            }
        }

        // Try --help as fallback
        if let Ok(output) = Command::new(path).arg("--help").output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
                if stdout.contains("claude") {
                    return true;
                }
            }
        }

        false
    }

    /// Check if Claude Code process is running
    async fn check_process_running(&self) -> bool {
        #[cfg(target_os = "windows")]
        {
            if let Ok(output) = Command::new("tasklist")
                .arg("/FI")
                .arg("IMAGENAME eq claude-code.exe")
                .output()
            {
                let stdout = String::from_utf8_lossy(&output.stdout);
                return stdout.contains("claude-code.exe");
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if let Ok(output) = Command::new("pgrep").arg("-f").arg("claude-code").output() {
                return output.status.success() && !output.stdout.is_empty();
            }
        }

        false
    }

    /// Check Claude Code configuration file
    async fn check_config_file(&self) -> Option<PathBuf> {
        let config_paths = self.get_config_paths();

        for path in config_paths {
            if path.exists() {
                log::debug!("Found Claude Code config at: {:?}", path);
                return Some(path);
            }
        }

        None
    }

    /// Get possible configuration file paths
    fn get_config_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();

        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            paths.extend(get_home_based_paths(&[
                ".config/claude-code/config.json",
                ".claude-code/config.json",
                ".claude/config.json",
            ]));
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(app_data) = std::env::var("APPDATA") {
                paths.push(PathBuf::from(&app_data).join("claude-code\\config.json"));
                paths.push(PathBuf::from(&app_data).join("Claude\\config.json"));
            }
        }

        paths
    }

    /// Validate Claude Code installation with comprehensive checks
    async fn validate_installation(&self, path: &std::path::Path) -> bool {
        // Primary check: executable verification
        if !self.verify_executable(path).await {
            return false;
        }

        // Secondary check: try to get version
        if self.get_version(path).await.is_none() {
            log::warn!("Claude Code found but version check failed");
            // Don't fail completely, might still work
        }

        true
    }

    /// Verify Claude Code authentication with /status
    async fn verify_auth(&self, path: &std::path::Path) -> bool {
        log::debug!("Checking Claude Code authentication status...");
        if let Ok(output) = Command::new(path).arg("/status").output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
                log::debug!("Claude Code /status output: {}", stdout);
                
                // Check for various authentication indicators
                // 1. Has API key (not "none")
                if stdout.contains("api key:") && !stdout.contains("api key: none") {
                    log::debug!("Claude Code authenticated: API key found");
                    return true;
                }
                
                // 2. Has organization info
                if stdout.contains("organization:") && !stdout.contains("organization: none") {
                    log::debug!("Claude Code authenticated: Organization found");
                    return true;
                }
                
                // 3. Has email
                if stdout.contains("email:") && !stdout.contains("email: none") {
                    log::debug!("Claude Code authenticated: Email found");
                    return true;
                }
                
                // 4. Legacy check: "logged in" text
                if stdout.contains("logged in") && !stdout.contains("not logged in") {
                    log::debug!("Claude Code authenticated: 'logged in' text found");
                    return true;
                }
                
                log::debug!("Claude Code not authenticated: no authentication indicators found");
            }
        }
        false
    }
}

impl Default for ClaudeCodeDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CliDetector for ClaudeCodeDetector {
    fn tool_name(&self) -> &str {
        "claude-code"
    }

    fn command_name(&self) -> &str {
        "claude-code"
    }

    async fn detect(&self) -> Result<CliToolInfo> {
        log::debug!("Detecting Claude Code installation with enhanced verification...");

        let mut claude_path: Option<PathBuf> = None;
        let mut in_path = false;

        // Strategy 1: Check PATH environment variable
        // Check for 'claude-code' first
        if let Some(path) = check_command_in_path("claude-code").await {
            if self.validate_installation(&path).await {
                claude_path = Some(path);
                in_path = true;
                log::info!("Claude Code found in PATH at: {:?}", claude_path);
            }
        }

        // Check for 'claude' if not found
        if claude_path.is_none() {
            if let Some(path) = check_command_in_path("claude").await {
                if self.validate_installation(&path).await {
                    claude_path = Some(path);
                    in_path = true;
                    log::info!(
                        "Claude Code found in PATH as 'claude' at: {:?}",
                        claude_path
                    );
                }
            }
        }

        // Strategy 2: Check common installation directories
        if claude_path.is_none() {
            let common_paths = self.get_common_paths();
            for path in common_paths {
                if path.exists() && self.validate_installation(&path).await {
                    claude_path = Some(path);
                    log::info!("Claude Code found at common path: {:?}", claude_path);
                    break;
                }
            }
        }

        // Strategy 3: Shell probe (Mac/Linux only)
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        if claude_path.is_none() {
            // Check claude-code
            if let Some(path) = super::cli_detector::probe_shell_path("claude-code").await {
                if self.validate_installation(&path).await {
                    claude_path = Some(path);
                    in_path = true;
                    log::info!("Claude Code found via shell probe at: {:?}", claude_path);
                }
            }
            // Check claude
            if claude_path.is_none() {
                if let Some(path) = super::cli_detector::probe_shell_path("claude").await {
                    if self.validate_installation(&path).await {
                        claude_path = Some(path);
                        in_path = true;
                        log::info!(
                            "Claude Code found via shell probe as 'claude' at: {:?}",
                            claude_path
                        );
                    }
                }
            }
        }

        // Strategy 4: Check for configuration file (indicates installation)
        if claude_path.is_none() {
            if let Some(config_path) = self.check_config_file().await {
                log::info!("Claude Code config found at: {:?}", config_path);
                // Config exists but executable not found - partial installation
                return Ok(CliToolInfo {
                    name: self.tool_name().to_string(),
                    installed: false,
                    version: None,
                    path: None,
                    in_path: false,
                    running: None,
                    authenticated: None,
                    error: Some("Configuration found but executable not in PATH".to_string()),
                });
            }
        }

        // If found, get additional information
        if let Some(path) = &claude_path {
            let version = self.get_version(path).await;
            let running = Some(self.check_process_running().await);

            log::info!(
                "Claude Code detected - Version: {:?}, Running: {:?}",
                version,
                running
            );

            let authenticated = Some(self.verify_auth(path).await);

            return Ok(CliToolInfo {
                name: self.tool_name().to_string(),
                installed: true,
                version,
                path: Some(path.clone()),
                in_path,
                running,
                authenticated,
                error: None,
            });
        }

        log::debug!("Claude Code not detected");
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

    async fn get_version(&self, path: &std::path::Path) -> Option<String> {
        let output = Command::new(path).arg("--version").output().ok()?;

        if output.status.success() {
            let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();

            // Extract version using regex for robust parsing
            // Handles formats like "claude-code 1.0.0", "version: 1.0.0", "v1.0.0", etc.
            let re = Regex::new(r"\d+\.\d+\.\d+").unwrap();
            let version = re
                .find(&version_str)
                .map(|m| m.as_str().to_string())
                .unwrap_or_default();

            if !version.is_empty() {
                return Some(version);
            }
        }

        None
    }

    async fn check_running(&self) -> Option<bool> {
        Some(self.check_process_running().await)
    }

    async fn check_authentication(&self) -> Option<bool> {
        // Quick check: find path and verify auth
        if let Some(path) = check_command_in_path("claude-code").await {
            return Some(self.verify_auth(&path).await);
        }
        if let Some(path) = check_command_in_path("claude").await {
            return Some(self.verify_auth(&path).await);
        }
        None
    }

    fn get_common_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();

        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            // Home-based paths
            paths.extend(get_home_based_paths(&[
                ".local/bin/claude-code",
                ".npm-global/bin/claude-code",
                "bin/claude-code",
                ".cargo/bin/claude-code",
                ".nvm/versions/node/*/bin/claude-code",
            ]));

            // System paths
            paths.push(PathBuf::from("/usr/local/bin/claude-code"));
            paths.push(PathBuf::from("/opt/homebrew/bin/claude-code"));
            paths.push(PathBuf::from("/usr/bin/claude-code"));
            paths.push(PathBuf::from("/opt/claude-code/bin/claude-code"));

            // Snap installation
            paths.push(PathBuf::from("/snap/bin/claude-code"));
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
                paths.push(PathBuf::from(&app_data).join("Programs\\Claude Code\\claude-code.exe"));
                paths.push(PathBuf::from(&app_data).join("npm\\claude-code.cmd"));
                paths.push(
                    PathBuf::from(&app_data)
                        .join("npm\\node_modules\\claude-code\\bin\\claude-code.cmd"),
                );
            }

            if let Ok(program_files) = std::env::var("ProgramFiles") {
                paths.push(PathBuf::from(&program_files).join("Claude Code\\claude-code.exe"));
                paths.push(PathBuf::from(&program_files).join("Claude\\claude-code.exe"));
            }

            if let Ok(user_profile) = std::env::var("USERPROFILE") {
                paths.push(PathBuf::from(&user_profile).join(".local\\bin\\claude-code.exe"));
            }
        }

        paths
    }

    fn get_installation_instructions(&self) -> String {
        #[cfg(target_os = "macos")]
        {
            r#"To install Claude Code, please follow these steps:

1. Open your terminal
2. Install using one of these methods:

   Option A - Using the official installer (recommended):
   curl -fsSL https://claude.ai/install.sh | sh

   Option B - Using Homebrew:
   brew install claude-code

   Option C - Using npm:
   npm install -g claude-code

   Option D - Download from:
   https://claude.ai/download

3. Verify installation:
   claude-code --version

4. Configure authentication (if required):
   claude-code login

5. Restart this application

After installation, Claude Code will be available in your PATH."#
                .to_string()
        }

        #[cfg(target_os = "linux")]
        {
            r#"To install Claude Code, please follow these steps:

1. Open your terminal
2. Install using one of these methods:

   Option A - Using the official installer (recommended):
   curl -fsSL https://claude.ai/install.sh | sh

   Option B - Using npm:
   npm install -g claude-code

   Option C - Using snap:
   sudo snap install claude-code

   Option D - Download from:
   https://claude.ai/download

3. Verify installation:
   claude-code --version

4. Configure authentication (if required):
   claude-code login

5. Restart this application

After installation, Claude Code will be available in your PATH."#
                .to_string()
        }

        #[cfg(target_os = "windows")]
        {
            r#"To install Claude Code, please follow these steps:

1. Download the installer from: https://claude.ai/download
2. Run the installer and follow the prompts
3. Alternatively, install using npm:
   npm install -g claude-code

4. Verify installation:
   claude-code --version

5. Configure authentication (if required):
   claude-code login

6. Restart this application

Claude Code will be added to your system PATH during installation."#
                .to_string()
        }

        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        {
            "Please visit https://claude.ai/download for installation instructions for your operating system.".to_string()
        }
    }

    async fn verify_path(&self, path: &std::path::Path) -> bool {
        self.validate_installation(path).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_code_detector_metadata() {
        let detector = ClaudeCodeDetector::new();
        assert_eq!(detector.tool_name(), "claude-code");
        assert_eq!(detector.command_name(), "claude-code");
    }

    #[test]
    fn test_common_paths_not_empty() {
        let detector = ClaudeCodeDetector::new();
        let paths = detector.get_common_paths();
        assert!(!paths.is_empty());
    }

    #[test]
    fn test_config_paths_not_empty() {
        let detector = ClaudeCodeDetector::new();
        let paths = detector.get_config_paths();
        assert!(!paths.is_empty());
    }

    #[test]
    fn test_installation_instructions() {
        let detector = ClaudeCodeDetector::new();
        let instructions = detector.get_installation_instructions();
        assert!(!instructions.is_empty());
        assert!(instructions.contains("Claude Code"));
    }

    #[tokio::test]
    async fn test_detect_returns_result() {
        let detector = ClaudeCodeDetector::new();
        let result = detector.detect().await;
        assert!(result.is_ok());

        let info = result.unwrap();
        assert_eq!(info.name, "claude-code");
    }
}

// Made with Bob
