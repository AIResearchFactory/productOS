#[cfg(target_os = "macos")]
use std::process::Command;

#[cfg(target_os = "windows")]
pub fn windows_hidden_creation_flags() -> u32 {
    crate::utils::process::windows_hidden_creation_flags()
}

/// Fix the PATH environment variable on macOS when running as a bundled app.
/// GUI apps on macOS don't inherit the shell PATH, which breaks CLI tool detection.
#[cfg(target_os = "macos")]
pub fn fix_macos_env() {
    if let Ok(path) = std::env::var("PATH") {
        if path.contains("/opt/homebrew/bin") || path.contains("/usr/local/bin") {
            return;
        }
    }

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    let output = Command::new(shell)
        .arg("-l")
        .arg("-c")
        .arg("echo $PATH")
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !path.is_empty() {
                log::info!("Fixed macOS PATH environment: {}", path);
                std::env::set_var("PATH", path);
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn fix_macos_env() {}

/// Check if a command exists in the system PATH or common fallback locations.
pub fn command_exists(cmd: &str) -> bool {
    crate::utils::process::command_exists(cmd)
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "windows")]
    #[test]
    fn test_windows_hidden_creation_flags_constant() {
        assert_eq!(super::windows_hidden_creation_flags(), 0x08000000);
    }
}
