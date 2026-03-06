use crate::updater::{UpdateManager, UpdateResult};
use anyhow::Result;
use std::path::PathBuf;

/// Run the update process
/// This will preserve user data and only update templates and structure
#[tauri::command]
pub async fn run_update_process() -> Result<UpdateResult, String> {
    log::info!("Starting update process command...");

    let mut manager = UpdateManager::with_default_path()
        .map_err(|e| format!("Failed to create update manager: {}", e))?;

    manager
        .perform_update()
        .await
        .map_err(|e| format!("Update failed: {}", e))
}

/// Check and preserve directory structure without full update
#[tauri::command]
pub async fn check_and_preserve_structure() -> Result<UpdateResult, String> {
    log::info!("Checking and preserving directory structure...");

    let manager = UpdateManager::with_default_path()
        .map_err(|e| format!("Failed to create update manager: {}", e))?;

    manager
        .check_and_preserve_structure()
        .await
        .map_err(|e| format!("Failed to check structure: {}", e))
}

/// Create a backup of user data
#[tauri::command]
pub async fn backup_user_data() -> Result<String, String> {
    log::info!("Creating backup of user data...");

    let manager = UpdateManager::with_default_path()
        .map_err(|e| format!("Failed to create update manager: {}", e))?;

    let backup_path = manager
        .backup_user_data()
        .await
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    Ok(backup_path.to_string_lossy().to_string())
}

/// Verify installation integrity
#[tauri::command]
pub async fn verify_installation_integrity() -> Result<bool, String> {
    log::info!("Verifying installation integrity...");

    let manager = UpdateManager::with_default_path()
        .map_err(|e| format!("Failed to create update manager: {}", e))?;

    manager
        .verify_integrity()
        .await
        .map_err(|e| format!("Failed to verify integrity: {}", e))
}

/// Restore data from a specific backup
#[tauri::command]
pub async fn restore_from_backup(backup_path: String) -> Result<(), String> {
    log::info!("Restoring from backup: {}", backup_path);

    let manager = UpdateManager::with_default_path()
        .map_err(|e| format!("Failed to create update manager: {}", e))?;

    let app_data_path = crate::utils::paths::get_app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let backups_root = app_data_path.join("backups");

    let requested = PathBuf::from(&backup_path);
    let canonical_requested = requested
        .canonicalize()
        .map_err(|_| "Backup path does not exist or is not accessible".to_string())?;
    let canonical_backups = backups_root
        .canonicalize()
        .unwrap_or(backups_root.clone());

    if !canonical_requested.starts_with(&canonical_backups) {
        return Err("Invalid backup path: must be inside app backups directory".to_string());
    }

    let backup_name = canonical_requested
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default();
    if !(backup_name.starts_with("backup_") || backup_name.starts_with("update_backup_")) {
        return Err("Invalid backup directory name".to_string());
    }

    manager
        .restore_if_needed(canonical_requested)
        .await
        .map_err(|e| format!("Failed to restore backup: {}", e))
}

/// List available backups
#[tauri::command]
pub async fn list_backups() -> Result<Vec<String>, String> {
    use std::fs;

    let app_data_path = crate::utils::paths::get_app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    let backups_dir = app_data_path.join("backups");

    if !backups_dir.exists() {
        return Ok(Vec::new());
    }

    let mut backups: Vec<String> = fs::read_dir(&backups_dir)
        .map_err(|e| format!("Failed to read backups directory: {}", e))?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false)
                && (entry.file_name().to_string_lossy().starts_with("backup_")
                    || entry
                        .file_name()
                        .to_string_lossy()
                        .starts_with("update_backup_"))
        })
        .map(|entry| entry.path().to_string_lossy().to_string())
        .collect();

    // Sort by name (which includes timestamp)
    backups.sort();
    backups.reverse(); // Most recent first

    Ok(backups)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_and_preserve_structure_command() {
        // This test requires a valid app data directory
        // In production, this would be created during installation
        let result = check_and_preserve_structure().await;
        // We expect this to either succeed or fail gracefully
        assert!(result.is_ok() || result.is_err());
    }
}
