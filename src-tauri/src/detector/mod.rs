use anyhow::Result;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;

// New plugin-based detection system
pub mod claude_code_detector;
pub mod cli_detector;
pub mod gemini_detector;
pub mod ollama_detector;

use claude_code_detector::ClaudeCodeDetector;
use cli_detector::CliDetectorRegistry;
use gemini_detector::GeminiDetector;
use ollama_detector::OllamaDetector;

// Global registry instance
static DETECTOR_REGISTRY: Lazy<CliDetectorRegistry> = Lazy::new(|| {
    let mut registry = CliDetectorRegistry::new();

    // Register all detectors
    registry.register(Arc::new(ClaudeCodeDetector::new()));
    registry.register(Arc::new(GeminiDetector::new()));
    registry.register(Arc::new(OllamaDetector::new()));

    log::info!(
        "CLI detector registry initialized with {} detectors",
        registry.registered_tools().len()
    );
    registry
});

/// Information about detected Gemini installation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiInfo {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<PathBuf>,
    pub in_path: bool,
    pub authenticated: Option<bool>,
}

/// Information about detected Claude Code installation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCodeInfo {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<PathBuf>,
    pub in_path: bool,
    pub authenticated: Option<bool>,
}

/// Information about detected Ollama installation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaInfo {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<PathBuf>,
    pub running: bool,
    pub in_path: bool,
}

/// Result of installation instruction request
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct InstallationInstructions {
    pub success: bool,
    pub message: String,
    pub path: Option<PathBuf>,
}

/// Detect Gemini CLI installation using new plugin system
pub async fn detect_gemini() -> Result<Option<GeminiInfo>> {
    detect_gemini_with_path(None).await
}

/// Detect Gemini CLI installation with a preferred path
pub async fn detect_gemini_with_path(
    preferred_path: Option<PathBuf>,
) -> Result<Option<GeminiInfo>> {
    let info = DETECTOR_REGISTRY
        .detect_with_path("gemini", preferred_path)
        .await?;

    if info.installed {
        Ok(Some(GeminiInfo {
            installed: info.installed,
            version: info.version,
            path: info.path,
            in_path: info.in_path,
            authenticated: info.authenticated,
        }))
    } else {
        Ok(None)
    }
}

/// Detect Claude Code installation using new plugin system
pub async fn detect_claude_code() -> Result<Option<ClaudeCodeInfo>> {
    detect_claude_code_with_path(None).await
}

/// Detect Claude Code installation with a preferred path
pub async fn detect_claude_code_with_path(
    preferred_path: Option<PathBuf>,
) -> Result<Option<ClaudeCodeInfo>> {
    let info = DETECTOR_REGISTRY
        .detect_with_path("claude-code", preferred_path)
        .await?;

    if info.installed {
        Ok(Some(ClaudeCodeInfo {
            installed: info.installed,
            version: info.version,
            path: info.path,
            in_path: info.in_path,
            authenticated: info.authenticated,
        }))
    } else {
        Ok(None)
    }
}

/// Detect Ollama installation using new plugin system
pub async fn detect_ollama() -> Result<Option<OllamaInfo>> {
    detect_ollama_with_path(None).await
}

/// Detect Ollama installation with a preferred path
pub async fn detect_ollama_with_path(
    preferred_path: Option<PathBuf>,
) -> Result<Option<OllamaInfo>> {
    let info = DETECTOR_REGISTRY
        .detect_with_path("ollama", preferred_path)
        .await?;

    if info.installed {
        Ok(Some(OllamaInfo {
            installed: info.installed,
            version: info.version,
            path: info.path,
            running: info.running.unwrap_or(false),
            in_path: info.in_path,
        }))
    } else {
        Ok(None)
    }
}

/// Detect all CLI tools at once
pub async fn detect_all_cli_tools(
    claude_path: Option<PathBuf>,
    ollama_path: Option<PathBuf>,
    gemini_path: Option<PathBuf>,
) -> Result<(
    Option<ClaudeCodeInfo>,
    Option<OllamaInfo>,
    Option<GeminiInfo>,
)> {
    // For now detect_all doesn't support preferred paths easily in a batch,
    // so we call them individually or update detect_all.
    // Let's call them individually for simplicity and to honor the paths.

    let claude_info = detect_claude_code_with_path(claude_path).await?;
    let ollama_info = detect_ollama_with_path(ollama_path).await?;
    let gemini_info = detect_gemini_with_path(gemini_path).await?;

    Ok((claude_info, ollama_info, gemini_info))
}

/// Clear detection cache for a specific tool
pub fn clear_detection_cache(tool_name: &str) {
    DETECTOR_REGISTRY.clear_cache(tool_name);
}

/// Clear all detection caches
pub fn clear_all_detection_caches() {
    DETECTOR_REGISTRY.clear_all_cache();
}

/// Install Claude Code (guide user through the installation process)
/// Note: This function returns instructions since we can't automatically install
/// Claude Code - the user needs to follow the official installation process
#[allow(dead_code)]
pub async fn install_claude_code() -> Result<InstallationInstructions> {
    log::info!("Preparing Claude Code installation instructions...");

    // We cannot automatically install Claude Code, so we return instructions
    let message = get_claude_code_installation_instructions();

    Ok(InstallationInstructions {
        success: false, // false because we haven't actually installed it
        message,
        path: None,
    })
}

/// Get installation instructions for Claude Code
pub fn get_claude_code_installation_instructions() -> String {
    DETECTOR_REGISTRY
        .get_installation_instructions("claude-code")
        .unwrap_or_else(get_claude_code_installation_instructions_legacy)
}

/// Legacy Claude Code installation instructions (fallback)
fn get_claude_code_installation_instructions_legacy() -> String {
    #[cfg(target_os = "macos")]
    {
        r#"To install Claude Code, please follow these steps:

1. Open your terminal
2. Run the following command:
   curl -fsSL https://claude.ai/install.sh | sh

3. Follow the installation prompts
4. Once installed, restart this application

Alternatively, you can:
- Use Homebrew: brew install claude-code
- Download from: https://claude.ai/download

After installation, Claude Code will be available in your PATH."#
            .to_string()
    }

    #[cfg(target_os = "linux")]
    {
        r#"To install Claude Code, please follow these steps:

1. Open your terminal
2. Run the following command:
   curl -fsSL https://claude.ai/install.sh | sh

3. Follow the installation prompts
4. Once installed, restart this application

After installation, Claude Code will be available in your PATH."#
            .to_string()
    }

    #[cfg(target_os = "windows")]
    {
        r#"To install Claude Code, please follow these steps:

1. Download the installer from: https://claude.ai/download
2. Run the installer and follow the prompts
3. Once installed, restart this application

Claude Code will be added to your system PATH during installation."#
            .to_string()
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        "Please visit https://claude.ai/download for installation instructions for your operating system.".to_string()
    }
}

/// Get installation instructions for Gemini CLI
pub fn get_gemini_installation_instructions() -> String {
    DETECTOR_REGISTRY
        .get_installation_instructions("gemini")
        .unwrap_or_else(|| "Please visit https://ai.google.dev/gemini-api/docs/quickstart for installation instructions.".to_string())
}

/// Get installation instructions for Ollama
pub fn get_ollama_installation_instructions() -> String {
    DETECTOR_REGISTRY
        .get_installation_instructions("ollama")
        .unwrap_or_else(get_ollama_installation_instructions_legacy)
}

/// Legacy Ollama installation instructions (fallback)
fn get_ollama_installation_instructions_legacy() -> String {
    #[cfg(target_os = "macos")]
    {
        r#"To install Ollama, please follow these steps:

1. Download Ollama from: https://ollama.ai/download
2. Double-click the downloaded file to install
3. Once installed, Ollama will start automatically
4. Restart this application

Alternatively, you can use Homebrew:
   brew install ollama"#
            .to_string()
    }

    #[cfg(target_os = "linux")]
    {
        r#"To install Ollama, please follow these steps:

1. Open your terminal
2. Run the following command:
   curl -fsSL https://ollama.ai/install.sh | sh

3. Start the Ollama service:
   ollama serve

4. Restart this application"#
            .to_string()
    }

    #[cfg(target_os = "windows")]
    {
        r#"To install Ollama, please follow these steps:

1. Download Ollama from: https://ollama.ai/download
2. Run the installer and follow the prompts
3. Once installed, Ollama will start automatically
4. Restart this application"#
            .to_string()
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        "Please visit https://ollama.ai/download for installation instructions for your operating system.".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detector::cli_detector::CliDetector;

    #[tokio::test]
    async fn test_detect_claude_code() {
        // This test will pass/fail based on whether Claude Code is installed
        let result = detect_claude_code().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_detect_ollama() {
        // This test will pass/fail based on whether Ollama is installed
        let result = detect_ollama().await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_get_common_paths() {
        let detector = OllamaDetector::new();
        let ollama_paths = detector.get_common_paths();
        assert!(!ollama_paths.is_empty());
    }

    #[test]
    fn test_installation_instructions() {
        let claude_instructions = get_claude_code_installation_instructions();
        assert!(!claude_instructions.is_empty());
        assert!(claude_instructions.contains("Claude Code"));

        let ollama_instructions = get_ollama_installation_instructions();
        assert!(!ollama_instructions.is_empty());
        assert!(ollama_instructions.contains("Ollama"));
    }

    #[tokio::test]
    async fn test_install_claude_code() {
        let result = install_claude_code().await;
        assert!(result.is_ok());

        let install_result = result.unwrap();
        assert!(!install_result.message.is_empty());
    }
}
