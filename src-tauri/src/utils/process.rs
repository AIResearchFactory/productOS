use std::path::{Path, PathBuf};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(target_os = "windows")]
pub fn windows_hidden_creation_flags() -> u32 {
    CREATE_NO_WINDOW
}

pub fn configure_std_command(command: &mut std::process::Command) -> &mut std::process::Command {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

pub fn configure_tokio_command(
    command: &mut tokio::process::Command,
) -> &mut tokio::process::Command {
    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    command
}

pub fn std_command(program: impl AsRef<std::ffi::OsStr>) -> std::process::Command {
    let mut command = std::process::Command::new(program);
    configure_std_command(&mut command);
    command
}

pub fn tokio_command(program: impl AsRef<std::ffi::OsStr>) -> tokio::process::Command {
    let mut command = tokio::process::Command::new(program);
    configure_tokio_command(&mut command);
    command
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedCommand {
    pub program: String,
    pub args: Vec<String>,
}

pub fn parse_command_string(input: &str) -> Result<ParsedCommand, String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut escaped = false;

    for ch in input.trim().chars() {
        if escaped {
            current.push(ch);
            escaped = false;
            continue;
        }

        match ch {
            '\\' if quote.is_some() => escaped = true,
            '"' | '\'' => {
                if quote == Some(ch) {
                    quote = None;
                } else if quote.is_none() {
                    quote = Some(ch);
                } else {
                    current.push(ch);
                }
            }
            c if c.is_whitespace() && quote.is_none() => {
                if !current.is_empty() {
                    parts.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(ch),
        }
    }

    if escaped {
        current.push('\\');
    }

    if quote.is_some() {
        return Err("Command contains an unmatched quote".to_string());
    }

    if !current.is_empty() {
        parts.push(current);
    }

    let Some(program) = parts.first().cloned() else {
        return Err("CLI command is empty".to_string());
    };

    Ok(ParsedCommand {
        program,
        args: parts.into_iter().skip(1).collect(),
    })
}

pub fn command_exists(cmd: &str) -> bool {
    resolve_command_path(cmd).is_some()
}

pub fn resolve_command_path(cmd: &str) -> Option<PathBuf> {
    let trimmed = cmd.trim();
    if trimmed.is_empty() {
        return None;
    }

    if looks_like_path(trimmed) {
        return resolve_explicit_path(Path::new(trimmed));
    }

    lookup_command_candidates(trimmed).into_iter().next()
}

pub fn lookup_command_candidates(cmd: &str) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    #[cfg(target_os = "windows")]
    {
        let output = std_command("where").arg(cmd).output().ok();
        append_command_output_paths(&mut paths, output);
        append_windows_fallback_paths(&mut paths, cmd);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = std_command("which").arg(cmd).output().ok();
        append_command_output_paths(&mut paths, output);
    }

    dedupe_paths(paths)
}

pub fn open_browser_url(url: &str) -> anyhow::Result<()> {
    #[cfg(target_os = "macos")]
    {
        std_command("open")
            .arg(url)
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to open browser: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std_command("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to open browser: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std_command("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to open browser: {}", e))?;
    }

    Ok(())
}

fn looks_like_path(cmd: &str) -> bool {
    cmd.contains(std::path::MAIN_SEPARATOR)
        || cmd.contains('/')
        || cmd.contains('\\')
        || Path::new(cmd).is_absolute()
}

fn resolve_explicit_path(path: &Path) -> Option<PathBuf> {
    if path.exists() {
        return Some(path.to_path_buf());
    }

    #[cfg(target_os = "windows")]
    {
        for ext in ["exe", "cmd", "bat", "ps1"] {
            let candidate = if path.extension().is_some() {
                path.to_path_buf()
            } else {
                path.with_extension(ext)
            };
            if candidate.exists() {
                return Some(candidate);
            }
        }
    }

    None
}

fn append_command_output_paths(
    paths: &mut Vec<PathBuf>,
    output: Option<std::process::Output>,
) {
    if let Some(output) = output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for line in stdout.lines().map(str::trim).filter(|line| !line.is_empty()) {
                paths.push(PathBuf::from(line));
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn append_windows_fallback_paths(paths: &mut Vec<PathBuf>, cmd: &str) {
    let mut candidates = Vec::new();

    if let Ok(app_data) = std::env::var("APPDATA") {
        let base = PathBuf::from(app_data).join("npm");
        candidates.push(base.join(cmd));
        candidates.push(base.join(format!("{cmd}.cmd")));
        candidates.push(base.join(format!("{cmd}.exe")));
        candidates.push(base.join(format!("{cmd}.ps1")));
    }

    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let base = PathBuf::from(&local_app_data);
        let npm = base.join("npm");
        candidates.push(npm.join(cmd));
        candidates.push(npm.join(format!("{cmd}.cmd")));
        candidates.push(npm.join(format!("{cmd}.exe")));
        candidates.push(
            base.join("Microsoft")
                .join("WinGet")
                .join("Links")
                .join(format!("{cmd}.exe")),
        );
        candidates.push(base.join("Microsoft").join("WindowsApps").join(format!("{cmd}.exe")));

        for pattern in [
            format!("{}\\Programs\\Python\\Python*\\Scripts\\{cmd}.exe", base.display()),
            format!("{}\\Programs\\Python\\Python*\\Scripts\\{cmd}", base.display()),
        ] {
            if let Ok(entries) = glob::glob(&pattern) {
                for entry in entries.flatten() {
                    candidates.push(entry);
                }
            }
        }
    }

    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        let base = PathBuf::from(user_profile);
        candidates.push(base.join(".local").join("bin").join(format!("{cmd}.exe")));
        candidates.push(base.join(".local").join("bin").join(cmd));
    }

    for candidate in candidates {
        if candidate.exists() {
            paths.push(candidate);
        }
    }
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = std::collections::HashSet::new();
    let mut deduped = Vec::new();

    for path in paths {
        let key = path.to_string_lossy().to_string();
        #[cfg(target_os = "windows")]
        let key = key.to_lowercase();

        if seen.insert(key) {
            deduped.push(path);
        }
    }

    deduped
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_command_string_basic() {
        let parsed = parse_command_string("codex login status").unwrap();
        assert_eq!(parsed.program, "codex");
        assert_eq!(parsed.args, vec!["login", "status"]);
    }

    #[test]
    fn test_parse_command_string_with_quotes() {
        let parsed = parse_command_string("\"C:\\\\Program Files\\\\Codex\\\\codex.exe\" --profile default").unwrap();
        assert_eq!(parsed.program, "C:\\Program Files\\Codex\\codex.exe");
        assert_eq!(parsed.args, vec!["--profile", "default"]);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_windows_hidden_creation_flags_constant() {
        assert_eq!(windows_hidden_creation_flags(), 0x08000000);
    }
}
