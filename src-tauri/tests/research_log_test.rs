use app_lib::services::research_log_service::ResearchLogService;
use std::fs;
use std::sync::{Mutex, OnceLock};
use tempfile::TempDir;

fn env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn create_project_for_log(base: &std::path::Path, id: &str, name: &str) {
    let project_path = base.join(id);
    fs::create_dir_all(project_path.join(".metadata")).unwrap();

    let project_meta = serde_json::json!({
        "id": id,
        "name": name,
        "goal": "Logging test",
        "skills": ["testing"],
        "created": "2025-01-01T00:00:00Z"
    });

    fs::write(
        project_path.join(".metadata").join("project.json"),
        serde_json::to_string(&project_meta).unwrap(),
    )
    .unwrap();
}

#[test]
fn test_research_log_creates_file_with_header_and_entry() {
    let _guard = env_lock().lock().unwrap();
    let temp_dir = TempDir::new().unwrap();
    let projects_dir = temp_dir.path().join("projects");
    std::env::set_var("PROJECTS_DIR", &projects_dir);
    fs::create_dir_all(&projects_dir).unwrap();
    create_project_for_log(&projects_dir, "log-project", "Log Project");

    ResearchLogService::log_event(
        "log-project",
        "claude",
        Some("summarize docs"),
        "Generated findings",
    )
    .unwrap();

    let log_path = projects_dir.join("log-project").join("research_log.md");
    assert!(log_path.exists());

    let content = fs::read_to_string(log_path).unwrap();
    assert!(content.contains("# Research Log: Log Project"));
    assert!(content.contains("**Provider**: claude"));
    assert!(content.contains("**Command**: `summarize docs`"));
    assert!(content.contains("#### Agent Output:"));
    assert!(content.contains("Generated findings"));
}

#[test]
fn test_research_log_appends_multiple_entries_and_skips_command_when_missing() {
    let _guard = env_lock().lock().unwrap();
    let temp_dir = TempDir::new().unwrap();
    let projects_dir = temp_dir.path().join("projects");
    std::env::set_var("PROJECTS_DIR", &projects_dir);
    fs::create_dir_all(&projects_dir).unwrap();
    create_project_for_log(&projects_dir, "log-project-2", "Log Project 2");

    ResearchLogService::log_event("log-project-2", "openai", None, "First output").unwrap();
    ResearchLogService::log_event("log-project-2", "openai", None, "Second output").unwrap();

    let content = fs::read_to_string(projects_dir.join("log-project-2").join("research_log.md")).unwrap();

    let interactions = content.matches("### Interaction:").count();
    assert_eq!(interactions, 2);
    assert!(!content.contains("**Command**:"));
    assert!(content.contains("First output"));
    assert!(content.contains("Second output"));
}

#[test]
fn test_research_log_fails_for_missing_project() {
    let _guard = env_lock().lock().unwrap();
    let temp_dir = TempDir::new().unwrap();
    let projects_dir = temp_dir.path().join("projects");
    std::env::set_var("PROJECTS_DIR", &projects_dir);

    let result = ResearchLogService::log_event("missing-project", "claude", None, "x");
    assert!(result.is_err());
}
