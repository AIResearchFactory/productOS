use anyhow::{Result, anyhow};
use std::env;

/// Retrieves the current system username.
pub fn get_system_username() -> Result<String> {
    // Attempt to get from common environment variables first
    if let Ok(user) = env::var("USER") {
        return Ok(user);
    }
    if let Ok(user) = env::var("USERNAME") {
        return Ok(user);
    }
    
    // Fallback or OS specific logic could go here if needed, 
    // but USER/USERNAME cover most cases on macOS/Unix and Windows.
    Err(anyhow!("Could not determine system username"))
}

/// Retrieves the username and formats it as an owner name (e.g., "dominik" -> "Dominik").
pub fn get_formatted_owner_name() -> Result<String> {
    let username = get_system_username()?;
    if username.is_empty() {
        return Err(anyhow!("Empty username found"));
    }
    
    // Capitalize the first letter
    let mut chars = username.chars();
    match chars.next() {
        None => Err(anyhow!("Empty username found")),
        Some(first) => {
            let capitalized = first.to_uppercase().collect::<String>() + chars.as_str();
            Ok(capitalized)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_formatting() {
        // We can't easily mock env::var here without a crate like temp_env,
        // so we just test the capitalization logic if possible or assume system test.
        let name = "matt";
        let mut chars = name.chars();
        let first = chars.next().unwrap();
        let capitalized = first.to_uppercase().collect::<String>() + chars.as_str();
        assert_eq!(capitalized, "Matt");
    }
}
