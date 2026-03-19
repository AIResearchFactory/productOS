use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime};

/// Common information structure for all CLI tools
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliToolInfo {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<PathBuf>,
    pub in_path: bool,
    pub running: Option<bool>,
    pub authenticated: Option<bool>,
    pub error: Option<String>,
}

/// Detection result with caching metadata
#[derive(Debug, Clone)]
struct CachedDetectionResult {
    info: CliToolInfo,
    timestamp: SystemTime,
}

/// Trait that all CLI detectors must implement
#[async_trait]
pub trait CliDetector: Send + Sync {
    /// Get the name of the CLI tool
    fn tool_name(&self) -> &str;

    /// Get the command name to check for
    fn command_name(&self) -> &str;

    /// Detect if the CLI tool is installed
    async fn detect(&self) -> Result<CliToolInfo>;

    /// Get version information
    async fn get_version(&self, path: &std::path::Path) -> Option<String>;

    /// Check if the tool is running (optional)
    async fn check_running(&self) -> Option<bool> {
        None
    }

    /// Check authentication status (optional)
    async fn check_authentication(&self) -> Option<bool> {
        None
    }

    /// Get common installation paths for this tool
    fn get_common_paths(&self) -> Vec<PathBuf>;

    /// Get installation instructions
    fn get_installation_instructions(&self) -> String;

    /// Verify if the tool exists at the given path
    async fn verify_path(&self, path: &std::path::Path) -> bool;
}

/// Registry for managing CLI detectors
pub struct CliDetectorRegistry {
    detectors: HashMap<String, Arc<dyn CliDetector>>,
    cache: Arc<RwLock<HashMap<String, CachedDetectionResult>>>,
    cache_duration: Duration,
}

impl CliDetectorRegistry {
    /// Create a new registry with default cache duration (60 seconds)
    pub fn new() -> Self {
        Self {
            detectors: HashMap::new(),
            cache: Arc::new(RwLock::new(HashMap::new())),
            cache_duration: Duration::from_secs(60),
        }
    }

    /// Create a new registry with custom cache duration
    pub fn with_cache_duration(duration: Duration) -> Self {
        Self {
            detectors: HashMap::new(),
            cache: Arc::new(RwLock::new(HashMap::new())),
            cache_duration: duration,
        }
    }

    /// Register a new CLI detector
    pub fn register(&mut self, detector: Arc<dyn CliDetector>) {
        let name = detector.tool_name().to_string();
        log::info!("Registering CLI detector: {}", name);
        self.detectors.insert(name, detector);
    }

    /// Detect a specific CLI tool by name
    pub async fn detect(&self, tool_name: &str) -> Result<CliToolInfo> {
        // Check cache first
        if let Some(cached) = self.get_from_cache(tool_name) {
            log::debug!("Using cached detection result for {}", tool_name);
            return Ok(cached.info);
        }

        // Get detector
        let detector = self
            .detectors
            .get(tool_name)
            .ok_or_else(|| anyhow::anyhow!("No detector registered for {}", tool_name))?;

        // Perform detection
        log::info!("Detecting {} installation...", tool_name);
        let info = detector.detect().await?;

        // Cache the result
        self.cache_result(tool_name, info.clone());

        Ok(info)
    }

    /// Detect with a preferred path first
    pub async fn detect_with_path(
        &self,
        tool_name: &str,
        preferred_path: Option<PathBuf>,
    ) -> Result<CliToolInfo> {
        // If preferred path exists, verify it first
        if let Some(ref path) = preferred_path {
            if let Some(detector) = self.detectors.get(tool_name) {
                if detector.verify_path(path).await {
                    log::debug!("Verified {} at preferred path: {:?}", tool_name, path);
                    // Use a shortened detection or just return success info
                    // For now, we still trigger the detector but it should be faster if it knows the path
                }
            }
        }

        // Fallback to normal detection (which uses cache)
        self.detect(tool_name).await
    }

    /// Detect all registered CLI tools
    pub async fn detect_all(&self) -> HashMap<String, CliToolInfo> {
        let mut results = HashMap::new();

        for (name, detector) in &self.detectors {
            match self.detect(name).await {
                Ok(info) => {
                    results.insert(name.clone(), info);
                }
                Err(e) => {
                    log::error!("Failed to detect {}: {}", name, e);
                    results.insert(
                        name.clone(),
                        CliToolInfo {
                            name: detector.tool_name().to_string(),
                            installed: false,
                            version: None,
                            path: None,
                            in_path: false,
                            running: None,
                            authenticated: None,
                            error: Some(e.to_string()),
                        },
                    );
                }
            }
        }

        results
    }

    /// Clear cache for a specific tool
    pub fn clear_cache(&self, tool_name: &str) {
        if let Ok(mut cache) = self.cache.write() {
            cache.remove(tool_name);
            log::debug!("Cleared cache for {}", tool_name);
        }
    }

    /// Clear all cache
    pub fn clear_all_cache(&self) {
        if let Ok(mut cache) = self.cache.write() {
            cache.clear();
            log::debug!("Cleared all detection cache");
        }
    }

    /// Get installation instructions for a tool
    pub fn get_installation_instructions(&self, tool_name: &str) -> Option<String> {
        self.detectors
            .get(tool_name)
            .map(|d| d.get_installation_instructions())
    }

    /// Check if a tool is registered
    pub fn is_registered(&self, tool_name: &str) -> bool {
        self.detectors.contains_key(tool_name)
    }

    /// Get list of registered tool names
    pub fn registered_tools(&self) -> Vec<String> {
        self.detectors.keys().cloned().collect()
    }

    // Private helper methods

    fn get_from_cache(&self, tool_name: &str) -> Option<CachedDetectionResult> {
        if let Ok(cache) = self.cache.read() {
            if let Some(cached) = cache.get(tool_name) {
                // Check if cache is still valid
                if let Ok(elapsed) = cached.timestamp.elapsed() {
                    if elapsed < self.cache_duration {
                        return Some(cached.clone());
                    }
                }
            }
        }
        None
    }

    fn cache_result(&self, tool_name: &str, info: CliToolInfo) {
        if let Ok(mut cache) = self.cache.write() {
            cache.insert(
                tool_name.to_string(),
                CachedDetectionResult {
                    info,
                    timestamp: SystemTime::now(),
                },
            );
        }
    }
}

impl Default for CliDetectorRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper function to check if a command exists in PATH
pub async fn check_command_in_path(cmd: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    let check = tokio::process::Command::new("where").arg(cmd).output().await;

    #[cfg(not(target_os = "windows"))]
    let check = tokio::process::Command::new("which").arg(cmd).output().await;

    if let Ok(output) = check {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let first_line = path_str.lines().next().unwrap_or("").trim();
            if !first_line.is_empty() {
                return Some(PathBuf::from(first_line));
            }
        }
    }
    None
}

/// Helper to probe user's shell for a command (Unix-like systems)
#[cfg(any(target_os = "macos", target_os = "linux"))]
pub async fn probe_shell_path(cmd: &str) -> Option<PathBuf> {
    use std::os::unix::fs::PermissionsExt;
    // Use absolute paths for shells to ensure they can be found even with a minimal PATH
    let shells = [
        ("/bin/zsh", "zsh"),
        ("/bin/bash", "bash"),
        ("zsh", "zsh"),
        ("bash", "bash"),
    ];

    for (shell_path, shell_name) in shells {
        // Try to get PATH from login shell
        let output = tokio::process::Command::new(shell_path)
            .arg("-l")
            .arg("-c")
            .arg("echo $PATH")
            .output()
            .await;

        if let Ok(out) = output {
            if out.status.success() {
                let path_str = String::from_utf8_lossy(&out.stdout).trim().to_string();

                // Split paths
                for dir_str in path_str.split(':') {
                    if dir_str.is_empty() {
                        continue;
                    }
                    let dir = PathBuf::from(dir_str);
                    let file_path = dir.join(cmd);

                    if file_path.exists() && file_path.is_file() {
                        // Check if executable
                        if let Ok(metadata) = std::fs::metadata(&file_path) {
                            if metadata.permissions().mode() & 0o111 != 0 {
                                log::info!(
                                    "Found {} via {} PATH probe at {:?}",
                                    cmd,
                                    shell_name,
                                    file_path
                                );
                                return Some(file_path);
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// Helper to get common home-based paths
pub fn get_home_based_paths(relative_paths: &[&str]) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(home) = std::env::var("HOME") {
        let home_path = PathBuf::from(&home);
        for rel_path in relative_paths {
            paths.push(home_path.join(rel_path));
        }
    }

    paths
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockDetector {
        name: String,
    }

    #[async_trait]
    impl CliDetector for MockDetector {
        fn tool_name(&self) -> &str {
            &self.name
        }

        fn command_name(&self) -> &str {
            &self.name
        }

        async fn detect(&self) -> Result<CliToolInfo> {
            Ok(CliToolInfo {
                name: self.name.clone(),
                installed: true,
                version: Some("1.0.0".to_string()),
                path: Some(PathBuf::from("/usr/bin/mock")),
                in_path: true,
                running: None,
                authenticated: None,
                error: None,
            })
        }

        async fn get_version(&self, _path: &std::path::Path) -> Option<String> {
            Some("1.0.0".to_string())
        }

        fn get_common_paths(&self) -> Vec<PathBuf> {
            vec![PathBuf::from("/usr/bin/mock")]
        }

        fn get_installation_instructions(&self) -> String {
            "Install mock tool".to_string()
        }

        async fn verify_path(&self, path: &std::path::Path) -> bool {
            path.exists()
        }
    }

    #[tokio::test]
    async fn test_registry_registration() {
        let mut registry = CliDetectorRegistry::new();
        let detector = Arc::new(MockDetector {
            name: "mock".to_string(),
        });

        registry.register(detector);
        assert!(registry.is_registered("mock"));
        assert_eq!(registry.registered_tools(), vec!["mock"]);
    }

    #[tokio::test]
    async fn test_registry_detection() {
        let mut registry = CliDetectorRegistry::new();
        let detector = Arc::new(MockDetector {
            name: "mock".to_string(),
        });

        registry.register(detector);
        let result = registry.detect("mock").await;
        assert!(result.is_ok());

        let info = result.unwrap();
        assert_eq!(info.name, "mock");
        assert!(info.installed);
    }

    #[tokio::test]
    async fn test_cache_functionality() {
        let registry = CliDetectorRegistry::with_cache_duration(Duration::from_secs(1));
        let mut reg = registry;
        let detector = Arc::new(MockDetector {
            name: "mock".to_string(),
        });

        reg.register(detector);

        // First detection
        let _ = reg.detect("mock").await;

        // Second detection should use cache
        let result = reg.detect("mock").await;
        assert!(result.is_ok());

        // Clear cache
        reg.clear_cache("mock");

        // Should detect again
        let result = reg.detect("mock").await;
        assert!(result.is_ok());
    }
}

// Made with Bob
