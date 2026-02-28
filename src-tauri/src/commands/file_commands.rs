use crate::services::file_service::FileService;
use crate::services::project_service::ProjectService;
use crate::services::settings_service::SettingsService;
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchMatch {
    pub file_name: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[tauri::command]
pub async fn read_markdown_file(project_id: String, file_name: String) -> Result<String, String> {
    FileService::read_file(&project_id, &file_name)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn write_markdown_file(project_id: String, file_name: String, content: String) -> Result<(), String> {
    FileService::write_file(&project_id, &file_name, &content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub async fn delete_markdown_file(project_id: String, file_name: String) -> Result<(), String> {
    FileService::delete_file(&project_id, &file_name)
        .map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
pub async fn rename_markdown_file(project_id: String, old_name: String, new_name: String) -> Result<(), String> {
    FileService::rename_file(&project_id, &old_name, &new_name)
        .map_err(|e| format!("Failed to rename file: {}", e))
}

#[tauri::command]
pub async fn search_in_files(
    project_id: String,
    search_text: String,
    case_sensitive: bool,
    use_regex: bool,
) -> Result<Vec<SearchMatch>, String> {
    // File size limit: 10MB to prevent memory issues
    const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024;
    // Regex pattern size limit to prevent ReDoS attacks
    const MAX_REGEX_LENGTH: usize = 1000;
    
    // Get all markdown files in the project
    let files = ProjectService::list_project_files(&project_id)
        .map_err(|e| format!("Failed to list project files: {}", e))?;
    
    // Prepare regex once if needed with validation
    let regex_pattern = if use_regex {
        // Validate regex pattern length to prevent ReDoS
        if search_text.len() > MAX_REGEX_LENGTH {
            return Err(format!(
                "Regex pattern too long ({} chars). Maximum allowed: {} chars",
                search_text.len(),
                MAX_REGEX_LENGTH
            ));
        }
        
        let search_term = if case_sensitive { search_text.clone() } else { search_text.to_lowercase() };
        
        // Validate and compile regex with clear error message
        match regex::Regex::new(&search_term) {
            Ok(re) => Some(re),
            Err(e) => {
                return Err(format!(
                    "Invalid regex pattern: {}. Please check your regular expression syntax.",
                    e
                ));
            }
        }
    } else {
        None
    };
    
    // Process files in parallel using tokio
    let search_tasks: Vec<_> = files
        .into_iter()
        .filter(|file_name| !file_name.starts_with('.'))
        .map(|file_name| {
            let project_id = project_id.clone();
            let search_text = search_text.clone();
            let regex_pattern = regex_pattern.clone();
            
            tokio::spawn(async move {
                // Note: This function performs parallel file searches without locking.
                // Files may be modified between metadata check and read operation.
                // Read errors due to concurrent modifications are caught and logged below.
                
                // Check file size before reading
                let projects_path = match SettingsService::get_projects_path() {
                    Ok(path) => path,
                    Err(_) => return Ok::<Vec<SearchMatch>, String>(Vec::new()),
                };
                
                let file_path = projects_path.join(&project_id).join(&file_name);
                
                if let Ok(metadata) = fs::metadata(&file_path) {
                    if metadata.len() > MAX_FILE_SIZE {
                        log::warn!(
                            "Skipping file '{}' in search: size {} bytes exceeds limit of {} bytes",
                            file_name,
                            metadata.len(),
                            MAX_FILE_SIZE
                        );
                        return Ok::<Vec<SearchMatch>, String>(Vec::new()); // Skip large files
                    }
                }
                
                // Read file content with error recovery for concurrent modifications
                let content = match FileService::read_file(&project_id, &file_name) {
                    Ok(c) => c,
                    Err(e) => {
                        // Log and skip files that fail to read (may be due to concurrent modifications)
                        eprintln!("Skipping file '{}': {}", file_name, e);
                        return Ok(Vec::new());
                    }
                };
                
                let mut file_matches = Vec::new();
                
                // Search in content
                for (line_num, line) in content.lines().enumerate() {
                    let search_line = if case_sensitive { line.to_string() } else { line.to_lowercase() };
                    let search_term = if case_sensitive { search_text.clone() } else { search_text.to_lowercase() };
                    
                    if let Some(ref re) = regex_pattern {
                        if let Some(mat) = re.find(&search_line) {
                            file_matches.push(SearchMatch {
                                file_name: file_name.clone(),
                                line_number: line_num + 1,
                                line_content: line.to_string(),
                                match_start: mat.start(),
                                match_end: mat.end(),
                            });
                        }
                    } else {
                        // Simple text search
                        // Note: Positions are calculated on the lowercased string (search_line).
                        // LIMITATION: This assumes byte positions remain consistent between original
                        // and lowercased strings. This holds true for ASCII but may be incorrect for
                        // certain Unicode characters that change byte length when case-converted
                        // (e.g., Turkish İ -> i). For full Unicode correctness, character-based
                        // indexing would be required instead of byte positions.
                        if let Some(pos) = search_line.find(&search_term) {
                            file_matches.push(SearchMatch {
                                file_name: file_name.clone(),
                                line_number: line_num + 1,
                                line_content: line.to_string(),
                                match_start: pos,
                                match_end: pos + search_term.len(),
                            });
                        }
                    }
                }
                
                Ok(file_matches)
            })
        })
        .collect();
    
    // Collect results from all tasks
    let mut matches = Vec::new();
    for task in search_tasks {
        match task.await {
            Ok(Ok(file_matches)) => matches.extend(file_matches),
            Ok(Err(e)) => eprintln!("Search error: {}", e),
            Err(e) => eprintln!("Task error: {}", e),
        }
    }
    
    Ok(matches)
}

#[tauri::command]
pub async fn replace_in_files(
    project_id: String,
    search_text: String,
    replace_text: String,
    case_sensitive: bool,
    file_names: Vec<String>,
) -> Result<usize, String> {
    let mut total_replacements = 0;
    
    for file_name in file_names {
        // Read file content
        let content = FileService::read_file(&project_id, &file_name)
            .map_err(|e| format!("Failed to read file '{}': {}", file_name, e))?;
        
        // Perform replacement
        let new_content = if case_sensitive {
            content.replace(&search_text, &replace_text)
        } else {
            // Case-insensitive replacement: matches all case variations (e.g., 'hello', 'Hello', 'HELLO')
            // but replaces them with the exact replace_text without preserving original casing.
            // This is consistent with many text editors' default behavior.
            let search_lower = search_text.to_lowercase();
            let content_lower = content.to_lowercase();
            let mut result = String::new();
            let mut last_end = 0;
            
            for (idx, _) in content_lower.match_indices(&search_lower) {
                result.push_str(&content[last_end..idx]);
                result.push_str(&replace_text);
                last_end = idx + search_lower.len();
            }
            result.push_str(&content[last_end..]);
            result
        };
        
        // Count replacements
        let replacements = if case_sensitive {
            content.matches(&search_text).count()
        } else {
            let search_lower = search_text.to_lowercase();
            content.to_lowercase().matches(&search_lower).count()
        };
        total_replacements += replacements;
        
        // Write back if changed
        if content != new_content {
            FileService::write_file(&project_id, &file_name, &new_content)
                .map_err(|e| format!("Failed to write file '{}': {}", file_name, e))?;
        }
    }
    
    Ok(total_replacements)
}
