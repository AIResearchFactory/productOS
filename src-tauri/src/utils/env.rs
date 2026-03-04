use std::process::Command;

/// Fix the PATH environment variable on macOS when running as a bundled app.
/// GUI apps on macOS don't inherit the shell PATH, which breaks CLI tool detection.
#[cfg(target_os = "macos")]
pub fn fix_macos_env() {
    // If PATH already looks like it has homebrew/common paths, skip
    if let Ok(path) = std::env::var("PATH") {
        if path.contains("/opt/homebrew/bin") || path.contains("/usr/local/bin") {
            // Path might already be fixed or inherited from terminal
            return;
        }
    }

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    // Run login shell to get the full path
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

/// Check if a command exists in the system PATH
pub fn command_exists(cmd: &str) -> bool {
    #[cfg(windows)]
    let check_cmd = "where";
    #[cfg(not(windows))]
    let check_cmd = "which";

    Command::new(check_cmd)
        .arg(cmd)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
