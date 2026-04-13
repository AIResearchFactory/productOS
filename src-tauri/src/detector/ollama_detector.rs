use anyhow::Result;
use async_trait::async_trait;
use std::path::PathBuf;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use super::cli_detector::{check_command_in_path, get_home_based_paths, CliDetector, CliToolInfo};

/// Ollama CLI detector implementation
pub struct OllamaDetector;

impl OllamaDetector {
    pub fn new() -> Self {
        Self
    }

    fn base_command(path: &std::path::Path) -> Command {
        #[cfg(target_os = "windows")]
        let mut cmd = Command::new(path);
        #[cfg(not(target_os = "windows"))]
        let cmd = Command::new(path);

        #[cfg(target_os = "windows")]
        {
            cmd.creation_flags(CREATE_NO_WINDOW);
        }
        cmd
    }

    /// Check if Ollama service is running
    async fn check_service_running(&self) -> bool {
        // Try to connect to Ollama API
        let client = reqwest::Client::new();
        let result = client
            .get("http://localhost:11434/api/tags")
            .timeout(std::time::Duration::from_secs(2))
            .send()
            .await;

        result.is_ok()
    }

    /// Verify Ollama executable
    async fn verify_executable(&self, path: &std::path::Path) -> bool {
        if !path.exists() {
            return false;
        }

        // Try to run --version
        if let Ok(output) = Self::base_command(path).arg("--version").output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).to_lowercase();
                if stdout.contains("ollama") {
                    return true;
                }
            }
        }

        // Try list command as fallback
        if let Ok(output) = Self::base_command(path).arg("list").output() {
            // Even if no models, command should work
            return output.status.success()
                || String::from_utf8_lossy(&output.stderr).contains("ollama");
        }

        false
    }
}

impl Default for OllamaDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CliDetector for OllamaDetector {
    fn tool_name(&self) -> &str {
        "ollama"
    }

    fn command_name(&self) -> &str {
        "ollama"
    }

    async fn detect(&self) -> Result<CliToolInfo> {
        log::debug!("Detecting Ollama installation...");

        let mut ollama_path: Option<PathBuf> = None;
        let mut in_path = false;

        // Strategy 1: Check PATH environment variable
        if let Some(path) = check_command_in_path("ollama").await {
            if self.verify_executable(&path).await {
                ollama_path = Some(path);
                in_path = true;
                log::info!("Ollama found in PATH at: {:?}", ollama_path);
            }
        }

        // Strategy 2: Check common installation directories
        if ollama_path.is_none() {
            let common_paths = self.get_common_paths();
            for path in common_paths {
                if path.exists() && self.verify_executable(&path).await {
                    ollama_path = Some(path);
                    log::info!("Ollama found at common path: {:?}", ollama_path);
                    break;
                }
            }
        }

        // Strategy 3: Shell probe (Mac/Linux only)
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        if ollama_path.is_none() {
            if let Some(path) = super::cli_detector::probe_shell_path("ollama").await {
                if self.verify_executable(&path).await {
                    ollama_path = Some(path);
                    in_path = true;
                    log::info!("Ollama found via shell probe at: {:?}", ollama_path);
                }
            }
        }

        // If found, get additional information
        if let Some(path) = &ollama_path {
            let version = self.get_version(path).await;
            let running = Some(self.check_service_running().await);

            log::info!(
                "Ollama detected - Version: {:?}, Running: {:?}",
                version,
                running
            );

            return Ok(CliToolInfo {
                name: self.tool_name().to_string(),
                installed: true,
                version,
                path: Some(path.clone()),
                in_path,
                running,
                authenticated: None,
                error: None,
            });
        }

        log::debug!("Ollama not detected");
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
        let output = Self::base_command(path).arg("--version").output().ok()?;

        if output.status.success() {
            let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();

            // Parse version from output like "ollama version is 0.1.0"
            let version = version_str
                .split_whitespace()
                .last()
                .unwrap_or(&version_str)
                .trim_start_matches('v')
                .to_string();

            if !version.is_empty() {
                return Some(version);
            }
        }

        None
    }

    async fn check_running(&self) -> Option<bool> {
        Some(self.check_service_running().await)
    }

    fn get_common_paths(&self) -> Vec<PathBuf> {
        let mut paths = Vec::new();

        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            // Home-based paths
            paths.extend(get_home_based_paths(&[
                ".local/bin/ollama",
                "bin/ollama",
                ".ollama/bin/ollama",
            ]));

            // System paths
            paths.push(PathBuf::from("/usr/local/bin/ollama"));
            paths.push(PathBuf::from("/opt/homebrew/bin/ollama"));
            paths.push(PathBuf::from("/usr/bin/ollama"));
            paths.push(PathBuf::from("/opt/ollama/bin/ollama"));

            // Snap installation
            paths.push(PathBuf::from("/snap/bin/ollama"));
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(app_data) = std::env::var("LOCALAPPDATA") {
                paths.push(PathBuf::from(&app_data).join("Programs\\Ollama\\ollama.exe"));
                paths.push(PathBuf::from(&app_data).join("Ollama\\ollama.exe"));
            }

            if let Ok(program_files) = std::env::var("ProgramFiles") {
                paths.push(PathBuf::from(&program_files).join("Ollama\\ollama.exe"));
            }

            if let Ok(user_profile) = std::env::var("USERPROFILE") {
                paths.push(PathBuf::from(&user_profile).join(".local\\bin\\ollama.exe"));
            }
        }

        paths
    }

    fn get_installation_instructions(&self) -> String {
        #[cfg(target_os = "macos")]
        {
            r#"To install Ollama, please follow these steps:

1. Download Ollama from: https://ollama.ai/download
2. Double-click the downloaded file to install
3. Once installed, Ollama will start automatically
4. Alternatively, install using Homebrew:
   brew install ollama

5. Start Ollama service:
   ollama serve

6. Verify installation:
   ollama --version
   ollama list

7. Pull a model to test:
   ollama pull llama2

8. Restart this application

After installation, Ollama will be available in your PATH."#
                .to_string()
        }

        #[cfg(target_os = "linux")]
        {
            r#"To install Ollama, please follow these steps:

1. Open your terminal
2. Run the installation script:
   curl -fsSL https://ollama.ai/install.sh | sh

3. Start the Ollama service:
   ollama serve

   Or enable as a system service:
   sudo systemctl enable ollama
   sudo systemctl start ollama

4. Verify installation:
   ollama --version
   ollama list

5. Pull a model to test:
   ollama pull llama2

6. Restart this application

After installation, Ollama will be available in your PATH."#
                .to_string()
        }

        #[cfg(target_os = "windows")]
        {
            r#"To install Ollama, please follow these steps:

1. Download Ollama from: https://ollama.ai/download
2. Run the installer and follow the prompts
3. Once installed, Ollama will start automatically
4. Verify installation:
   ollama --version
   ollama list

5. Pull a model to test:
   ollama pull llama2

6. Restart this application

Ollama will be added to your system PATH during installation."#
                .to_string()
        }

        #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
        {
            "Please visit https://ollama.ai/download for installation instructions for your operating system.".to_string()
        }
    }

    async fn verify_path(&self, path: &std::path::Path) -> bool {
        self.verify_executable(path).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ollama_detector_metadata() {
        let detector = OllamaDetector::new();
        assert_eq!(detector.tool_name(), "ollama");
        assert_eq!(detector.command_name(), "ollama");
    }

    #[test]
    fn test_common_paths_not_empty() {
        let detector = OllamaDetector::new();
        let paths = detector.get_common_paths();
        assert!(!paths.is_empty());
    }

    #[test]
    fn test_installation_instructions() {
        let detector = OllamaDetector::new();
        let instructions = detector.get_installation_instructions();
        assert!(!instructions.is_empty());
        assert!(instructions.contains("Ollama"));
    }

    #[tokio::test]
    async fn test_detect_returns_result() {
        let detector = OllamaDetector::new();
        let result = detector.detect().await;
        assert!(result.is_ok());

        let info = result.unwrap();
        assert_eq!(info.name, "ollama");
    }
}

// Made with Bob
