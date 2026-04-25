use app_lib::installer::InstallationManager;
use std::fs;
use std::path::PathBuf;
use tempfile::TempDir;

#[tokio::test]
async fn test_onboarding_installation_flow() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_path = temp_dir.path().join("ai-researcher-test");

    // 1. Initialize InstallationManager
    std::env::set_var("PROJECTS_DIR", app_data_path.join("projects"));
    std::env::set_var("APP_DATA_DIR", &app_data_path);
    
    let manager = InstallationManager::new(app_data_path.clone());
    assert!(manager.is_first_install());

    // 2. Perform installation steps (simulate parts of run_installation to keep it isolated)
    // Create directory structure
    app_lib::directory::create_directory_structure(&app_data_path)
        .await
        .expect("Failed to create structure");
    assert!(app_data_path.join("projects").exists());
    assert!(app_data_path.join("skills").exists());

    // Create default files
    app_lib::directory::create_default_files(&app_data_path)
        .await
        .expect("Failed to create default files");
    assert!(app_data_path.join("README.md").exists());

    // 3. Test Gemini specific state in config
    let config = manager.config();
    // Initially false
    assert!(!config.gemini_detected);

    // 4. Test state persistence (which now includes gemini_detected)
    let manager_mut = InstallationManager::new(app_data_path.clone());
    // Simulate Gemini being detected
    // In a real run_installation this would be set by detectors
    // Here we just verify the struct has the field and it's serializable
    let mut installation_config = manager_mut.config().clone();
    installation_config.gemini_detected = true;
    installation_config.claude_code_detected = true;

    let state_file = app_data_path.join(".installation_state.json");
    let state_json = serde_json::to_string_pretty(&installation_config).unwrap();
    fs::write(&state_file, state_json).unwrap();

    // Load it back
    let loaded_config = InstallationManager::load_installation_state(&app_data_path).unwrap();
    assert!(loaded_config.gemini_detected);
    assert!(loaded_config.claude_code_detected);
}

#[tokio::test]
async fn test_onboarding_update_flow_preserves_gemini() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_path = temp_dir.path().join("ai-researcher-update-test");
    fs::create_dir_all(&app_data_path).unwrap();

    // Create an initial state with gemini detected
    let initial_config = app_lib::installer::InstallationConfig {
        app_data_path: app_data_path.clone(),
        is_first_install: false,
        claude_code_detected: true,
        ollama_detected: true,
        gemini_detected: true,
    };

    let state_file = app_data_path.join(".installation_state.json");
    fs::write(&state_file, serde_json::to_string(&initial_config).unwrap()).unwrap();

    // Initialize UpdateManager
    let update_manager = app_lib::updater::UpdateManager::new(initial_config);

    // Perform backup (should include installation state)
    let backup_path = update_manager
        .backup_user_data()
        .await
        .expect("Backup failed");
    assert!(backup_path.exists());
    assert!(backup_path.join(".installation_state.json").exists());

    // Verify backup content
    let backed_up_state = fs::read_to_string(backup_path.join(".installation_state.json")).unwrap();
    assert!(backed_up_state.contains("\"gemini_detected\":true"));
}

#[tokio::test]
async fn test_app_config_persistence_with_gemini() {
    let temp_dir = TempDir::new().unwrap();
    let app_data_path = temp_dir.path().join("ai-researcher-config-test");
    fs::create_dir_all(&app_data_path).unwrap();

    // Create an AppConfig with gemini enabled
    let mut config = app_lib::config::AppConfig::new(app_data_path.clone(), "0.2.0".to_string());
    config.gemini_enabled = true;
    config.gemini_path = Some(PathBuf::from("/usr/bin/gemini"));

    // Save to a custom path for testing
    let config_path = app_data_path.join("config.json");
    config.save(&config_path).expect("Failed to save config");

    // Load it back
    let loaded = app_lib::config::AppConfig::load(&config_path).expect("Failed to load config");
    assert!(loaded.gemini_enabled);
    assert_eq!(loaded.gemini_path, Some(PathBuf::from("/usr/bin/gemini")));
}
