use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

pub struct FileService;

use crate::services::settings_service::SettingsService;

impl FileService {
    /// Get the path to a project's file
    /// Validates that file_name doesn't escape the project directory (path traversal protection)
    fn get_file_path(project_id: &str, file_name: &str) -> Result<PathBuf> {
        // Reject file names with path traversal components
        if file_name.contains("..") || file_name.contains('/') || file_name.contains('\\') {
            anyhow::bail!("Invalid file name: must not contain path separators or '..'");
        }

        // Reject empty or hidden file names
        if file_name.is_empty() || file_name.starts_with('.') {
            anyhow::bail!("Invalid file name: must not be empty or start with '.'");
        }

        let projects_path = SettingsService::get_projects_path()
            .context("Failed to get projects path")?;
        let project_dir = projects_path.join(project_id);
        let file_path = project_dir.join(file_name);

        // Double-check: canonicalize and verify it's still within the project directory
        // (belt-and-suspenders approach)
        if let Ok(canonical) = file_path.canonicalize() {
            if let Ok(canonical_project) = project_dir.canonicalize() {
                if !canonical.starts_with(&canonical_project) {
                    anyhow::bail!("File path escapes project directory");
                }
            }
        }

        Ok(file_path)
    }

    /// Read a file from a project
    pub fn read_file(project_id: &str, file_name: &str) -> Result<String> {
        let file_path = Self::get_file_path(project_id, file_name)?;

        if !file_path.exists() {
            anyhow::bail!("File does not exist: {}", file_name);
        }

        fs::read_to_string(&file_path)
            .context("Failed to read file")
    }

    /// Write content to a file in a project
    pub fn write_file(project_id: &str, file_name: &str, content: &str) -> Result<()> {
        let file_path = Self::get_file_path(project_id, file_name)?;

        // Ensure parent directory exists
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).context("Failed to create directory")?;
        }

        fs::write(&file_path, content)
            .context("Failed to write file")
    }

    /// Rename a file in a project
    pub fn rename_file(project_id: &str, old_name: &str, new_name: &str) -> Result<()> {
        let old_path = Self::get_file_path(project_id, old_name)?;
        let new_path = Self::get_file_path(project_id, new_name)?;

        if !old_path.exists() {
            anyhow::bail!("Source file does not exist: {}", old_name);
        }

        if new_path.exists() {
            anyhow::bail!("Destination file already exists: {}", new_name);
        }

        if let Some(parent) = new_path.parent() {
            fs::create_dir_all(parent).context("Failed to create directory")?;
        }

        fs::rename(&old_path, &new_path)
            .context("Failed to rename file")
    }

    /// Delete a file from a project
    pub fn delete_file(project_id: &str, file_name: &str) -> Result<()> {
        let file_path = Self::get_file_path(project_id, file_name)?;

        if !file_path.exists() {
            anyhow::bail!("File does not exist: {}", file_name);
        }

        fs::remove_file(&file_path)
            .context("Failed to delete file")
    }
}

#[cfg(test)]
mod tests {
    use tempfile::TempDir;

    #[test]
    fn test_write_and_read_file() {
        let _temp_dir = TempDir::new().unwrap();
        let _project_id = "test-project";
        let _file_name = "test.md";
        let _content = "Test content";

        // This test would need to mock the home directory
        // For now, it's a placeholder
    }
}
