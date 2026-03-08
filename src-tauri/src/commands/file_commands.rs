use crate::services::file_service::FileService;
use crate::services::project_service::ProjectService;
use crate::services::settings_service::SettingsService;
use crate::services::ai_service::AIService;
use std::sync::Arc;
use crate::models::ai::Message;
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
pub async fn write_markdown_file(
    project_id: String,
    file_name: String,
    content: String,
) -> Result<(), String> {
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

        let search_term = if case_sensitive {
            search_text.clone()
        } else {
            search_text.to_lowercase()
        };

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
                    let search_line = if case_sensitive {
                        line.to_string()
                    } else {
                        line.to_lowercase()
                    };
                    let search_term = if case_sensitive {
                        search_text.clone()
                    } else {
                        search_text.to_lowercase()
                    };

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

fn is_safe_path(path: &str) -> Result<(), String> {
    use std::path::Path;
    let p = Path::new(path);

    // 1. Check for path traversal (..)
    if p.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Invalid path: Path traversal components (..) are not allowed.".to_string());
    }

    // 2. Prevent writing to sensitive system areas
    if p.is_absolute() {
        let forbidden = [
            "/etc", "/var", "/usr", "/bin", "/sbin", "/lib", "/root", "/proc", "/sys", "/dev",
            "C:\\Windows", "C:\\System32",
        ];
        for prefix in forbidden {
            if p.starts_with(prefix) {
                return Err(format!("Security Error: Access to {} is restricted.", prefix));
            }
        }
    }

    Ok(())
}

/// Validate a source path used for reading only (import operations).
/// Only prevents path traversal; does not block system directories since
/// the user may legitimately select files from anywhere on their system.
fn is_safe_source_path(path: &str) -> Result<(), String> {
    use std::path::Path;
    let p = Path::new(path);
    if p.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Invalid path: Path traversal components (..) are not allowed.".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn import_document(project_id: String, source_path: String) -> Result<String, String> {
    use std::path::Path;
    use std::process::Command;

    is_safe_source_path(&source_path)?;
    
    let path = Path::new(&source_path);
    if !path.is_file() {
        return Err("Invalid source path: Not a file or does not exist.".to_string());
    }

    let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("imported_doc");
    let _ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    
    let new_file_name = format!("{}.md", file_stem);
    
    // Check if pandoc is installed
    let pandoc_check = Command::new("pandoc")
        .arg("--version")
        .output();

    if pandoc_check.is_err() {
        return Err("PANDOC_MISSING: Pandoc is not installed or not in PATH. Please install it to import documents.".to_string());
    }

    // We use pandoc for conversion
    let output = Command::new("pandoc")
        .arg("--")
        .arg(&source_path)
        .arg("-t")
        .arg("markdown")
        .output()
        .map_err(|e| format!("Failed to run pandoc conversion: {}", e))?;
        
    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Pandoc conversion failed: {}", err_msg));
    }
    
    let markdown_content = String::from_utf8_lossy(&output.stdout).to_string();
    
    FileService::write_file(&project_id, &new_file_name, &markdown_content)
        .map_err(|e| format!("Failed to write imported file: {}", e))?;
        
    Ok(new_file_name)
}

#[tauri::command]
pub async fn import_transcript(
    project_id: String,
    source_path: String,
    ai_service: tauri::State<'_, Arc<AIService>>,
) -> Result<String, String> {
    use std::path::Path;

    is_safe_source_path(&source_path)?;
    
    let path = Path::new(&source_path);
    let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("meeting_transcript");
    
    // 1. Read VTT
    let content = fs::read_to_string(&source_path)
        .map_err(|e| format!("Failed to read transcript file: {}", e))?;
        
    // 2. Clean VTT
    let transcript = clean_vtt(&content);
    
    // 3. Summarize with AIService
    let prompt = format!(
        "You are an expert meeting analyst. Please summarize the following meeting transcript into a structured Markdown document.

The document MUST include:
1. Title: A concise, descriptive title for the meeting.
2. Date: The date and time of the meeting (if present in transcript, else state 'Unknown').
3. Participants: A clear list of individuals who spoke.
4. Summary: A well-structured overview of the key topics discussed.
5. Action Items: A bulleted list of tasks, responsibilities, and next steps agreed upon.
6. Decisions Made: A clear list of key decisions finalized during the session.

TRANSCRIPT:
{}
", transcript);

    let messages = vec![Message {
        role: "user".to_string(),
        content: prompt,
        tool_calls: None,
        tool_results: None,
    }];

    let response = ai_service.chat(messages, None, Some(project_id.clone()))
        .await
        .map_err(|e| format!("AI summarization failed: {}", e))?;
        
    let summary_filename = format!("{}_summary.md", file_stem);
    
    // 4. Save to project
    FileService::write_file(&project_id, &summary_filename, &response.content)
        .map_err(|e| format!("Failed to save transcript summary: {}", e))?;
        
    Ok(summary_filename)
}

fn clean_vtt(content: &str) -> String {
    let mut transcript = String::new();
    let re_timestamp = regex::Regex::new(r"^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}").unwrap();
    
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed == "WEBVTT" || re_timestamp.is_match(trimmed) {
            continue;
        }
        // Remove line prefixes like 'NOTE' or IDs if any
        if trimmed.starts_with("NOTE") {
            continue;
        }
        transcript.push_str(trimmed);
        transcript.push('\n');
    }
    transcript
}

#[tauri::command]
pub async fn export_document(project_id: String, file_name: String, target_path: String, export_format: String) -> Result<(), String> {
    use std::process::{Command, Stdio};
    use std::io::Write;
    
    is_safe_path(&target_path)?;
    
    let content = FileService::read_file(&project_id, &file_name)
        .map_err(|e| format!("Failed to read file: {}", e))?;
        
    let mut cmd = Command::new("pandoc");
    cmd.arg("-f").arg("markdown").arg("-o").arg(&target_path);
    
    // For PDF generation, pandoc might need a pdf engine on macOS, like wkhtmltopdf or basictex
    if export_format.to_lowercase() == "pdf" {
        // Just let pandoc handle it, might fail if no pdf engine is present
    }
    
    let mut child = match cmd.stdin(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn() {
            Ok(c) => c,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Err("PANDOC_MISSING: Pandoc is not installed or not in PATH. Please install it to export documents.".to_string());
            }
            Err(e) => return Err(format!("Failed to spawn pandoc: {}", e)),
        };
        
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(content.as_bytes()).map_err(|e| format!("Failed to write to pandoc stdin: {}", e))?;
    }
    
    let output = child.wait_with_output().map_err(|e| format!("Failed to wait for pandoc: {}", e))?;
    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Pandoc export failed (if PDF export fails, you may need a pdf engine like wkhtmltopdf or basictex installed). Error: {}", err_msg));
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    fn is_pandoc_installed() -> bool {
        std::process::Command::new("pandoc")
            .arg("--version")
            .output()
            .is_ok()
    }

    #[tokio::test]
    async fn test_import_and_export_document() {
        if !is_pandoc_installed() {
            println!("Pandoc not installed, skipping test");
            return;
        }

        // 1. Create a dummy project
        match ProjectService::create_project(
            "Test Import Export",
            "Unit test project",
            vec![],
        ) {
            Ok(project) => {
                let project_id = project.id;
                
                // 2. Create a dummy test file to import
                let temp_dir = env::temp_dir();
                let source_file = temp_dir.join("test_import_doc.txt");
                let content = "Hello, this is a test document.";
                fs::write(&source_file, content).expect("Failed to write source file");

                // 3. Import the document
                let source_path_str = source_file.to_string_lossy().to_string();
                let import_result = import_document(project_id.clone(), source_path_str).await;
                
                assert!(import_result.is_ok(), "Import failed: {:?}", import_result.err());
                let new_file_name = import_result.unwrap();
                assert_eq!(new_file_name, "test_import_doc.md");

                // Verify the file was written to the project
                let read_content = read_markdown_file(project_id.clone(), new_file_name.clone()).await;
                assert!(read_content.is_ok());
                assert!(read_content.unwrap().contains("Hello, this is a test document."));

                // 4. Export the document
                let target_file = temp_dir.join("test_export_doc.docx");
                let target_path_str = target_file.to_string_lossy().to_string();
                
                let export_result = export_document(
                    project_id.clone(),
                    new_file_name,
                    target_path_str.clone(),
                    "docx".to_string(),
                ).await;

                assert!(export_result.is_ok(), "Export failed: {:?}", export_result.err());
                assert!(fs::metadata(&target_file).is_ok(), "Exported file does not exist");

                // Cleanup
                let _ = fs::remove_file(source_file);
                let _ = fs::remove_file(target_file);
                let _ = ProjectService::delete_project(&project_id);
            },
            Err(e) => {
                println!("Failed to create project: {}", e);
            }
        }
    }

    #[test]
    fn test_clean_vtt() {
        let vtt = "WEBVTT

00:00:00.000 --> 00:00:05.000
John: Hello everyone.

00:00:05.500 --> 00:00:10.000
Jane: Hi John.
";
        let cleaned = clean_vtt(vtt);
        assert!(cleaned.contains("John: Hello everyone."));
        assert!(cleaned.contains("Jane: Hi John."));
        assert!(!cleaned.contains("WEBVTT"));
        assert!(!cleaned.contains("00:00:00.000"));
    }
}
