// Modules
mod commands;
pub mod config;
pub mod models;
pub mod services;
mod utils;

// New installation modules
pub mod detector;
pub mod directory;
pub mod installer;
pub mod updater;

use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;
use utils::paths;

#[cfg(target_os = "macos")]
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

#[cfg(target_os = "macos")]
fn build_native_menu(
    app: &tauri::AppHandle,
) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    let pkg_info = app.package_info();
    let app_name = &pkg_info.name;

    // App menu
    let app_menu = SubmenuBuilder::new(app, app_name)
        .item(&PredefinedMenuItem::about(app, None, None)?)
        .separator()
        .item(&MenuItemBuilder::with_id("check_for_updates", "Check for Updates...").build(app)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("settings", "Settings")
                .accelerator("Cmd+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    // File menu
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id("new_project", "New Project")
                .accelerator("CmdOrCtrl+N")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("new_file", "New File")
                .accelerator("CmdOrCtrl+Shift+N")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("close_file", "Close File")
                .accelerator("CmdOrCtrl+W")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("close_project", "Close Project")
                .accelerator("CmdOrCtrl+Shift+W")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("import_document", "Import Document...")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("export_document", "Export Document...")
                .build(app)?,
        )
        .build()?;

    // Edit menu
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("find", "Find")
                .accelerator("CmdOrCtrl+F")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("replace", "Replace")
                .accelerator("CmdOrCtrl+H")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("find_in_files", "Find in Files")
                .accelerator("CmdOrCtrl+Shift+F")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("replace_in_files", "Replace in Files")
                .accelerator("CmdOrCtrl+Shift+H")
                .build(app)?,
        )
        .build()?;

    // Selection menu
    let selection_menu = SubmenuBuilder::new(app, "Selection")
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .item(
            &MenuItemBuilder::with_id("expand_selection", "Expand Selection")
                .accelerator("Alt+Shift+Right")
                .build(app)?,
        )
        .separator()
        .item(&MenuItemBuilder::with_id("copy_as_markdown", "Copy as Markdown").build(app)?)
        .build()?;

    // Help menu
    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::with_id("welcome", "Welcome").build(app)?)
        .item(&MenuItemBuilder::with_id("release_notes", "Release Notes").build(app)?)
        .item(&MenuItemBuilder::with_id("documentation", "Documentation").build(app)?)
        .build()?;

    // Build the main menu
    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&selection_menu)
        .item(&help_menu)
        .build()?;

    Ok(menu)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Fix macOS environment before doing anything else
    utils::env::fix_macos_env();

    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize directory structure on app startup
            if let Err(e) = paths::initialize_directory_structure() {
                log::error!("Failed to initialize directory structure: {}", e);
                return Err(e.into());
            }

            // Encryption initialization will happen on demand when secrets are accessed
            log::info!("Encryption service ready (lazy initialization)");

            // Set up file watcher
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                // Initialize file watcher
                let base_path =
                    match services::settings_service::SettingsService::get_projects_path() {
                        Ok(path) => path,
                        Err(e) => {
                            log::error!("Failed to get projects directory for file watcher: {}", e);
                            return;
                        }
                    };
                let mut watcher = services::file_watcher::FileWatcherService::new();

                if let Err(e) = watcher.start_watching(&base_path, move |event| {
                    // Emit events to frontend
                    match event {
                        services::file_watcher::WatchEvent::ProjectAdded(id) => {
                            let _ = app_handle.emit("project-added", id);
                        }
                        services::file_watcher::WatchEvent::ProjectRemoved(id) => {
                            let _ = app_handle.emit("project-removed", id);
                        }
                        services::file_watcher::WatchEvent::FileChanged(project_id, file_name) => {
                            let _ = app_handle.emit("file-changed", (project_id, file_name));
                        }
                    }
                }) {
                    log::error!("Failed to start file watcher: {}", e);
                }
            });

            // Initialize AI Service
            let ai_service = tauri::async_runtime::block_on(async {
                services::ai_service::AIService::new().await
            })
            .map_err(|e| {
                log::error!("Failed to initialize AI Service: {}", e);
                e
            })?;
            let ai_service = Arc::new(ai_service);
            let orchestrator = services::agent_orchestrator::AgentOrchestrator::new(
                ai_service.clone(),
                app.handle().clone(),
            );
            app.manage(ai_service);
            app.manage(Arc::new(orchestrator));

            // Build and set native menu on macOS
            #[cfg(target_os = "macos")]
            {
                let menu = build_native_menu(app.handle())?;
                app.set_menu(menu)?;

                // Set up menu event handler
                app.on_menu_event(move |app, event| match event.id().as_ref() {
                    "new_project" => {
                        let _ = app.emit("menu:new-project", ());
                    }
                    "new_file" => {
                        let _ = app.emit("menu:new-file", ());
                    }
                    "close_file" => {
                        let _ = app.emit("menu:close-file", ());
                    }
                    "close_project" => {
                        let _ = app.emit("menu:close-project", ());
                    }
                    "import_document" => {
                        let _ = app.emit("menu:import-document", ());
                    }
                    "export_document" => {
                        let _ = app.emit("menu:export-document", ());
                    }
                    "find" => {
                        let _ = app.emit("menu:find", ());
                    }
                    "replace" => {
                        let _ = app.emit("menu:replace", ());
                    }
                    "find_in_files" => {
                        let _ = app.emit("menu:find-in-files", ());
                    }
                    "replace_in_files" => {
                        let _ = app.emit("menu:replace-in-files", ());
                    }
                    "expand_selection" => {
                        let _ = app.emit("menu:expand-selection", ());
                    }
                    "copy_as_markdown" => {
                        let _ = app.emit("menu:copy-as-markdown", ());
                    }
                    "welcome" => {
                        let _ = app.emit("menu:welcome", ());
                    }
                    "release_notes" => {
                        let _ = app.emit("menu:release-notes", ());
                    }
                    "documentation" => {
                        let _ = app.emit("menu:documentation", ());
                    }
                    "check_for_updates" => {
                        let _ = app.emit("menu:check-for-updates", ());
                    }
                    "settings" => {
                        let _ = app.emit("menu:settings", ());
                    }
                    _ => {}
                });
            }

            // Start background scheduler for workflow cron jobs
            services::workflow_scheduler_service::WorkflowSchedulerService::spawn(app.handle().clone());

            // Set up periodic update check (every 12 hours)
            let app_handle_for_updater = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    log::info!("Checking for updates in background...");
                    match app_handle_for_updater.updater() {
                        Ok(updater) => match updater.check().await {
                            Ok(Some(update)) => {
                                log::info!("Update available: {}", update.version);
                                let _ =
                                    app_handle_for_updater.emit("update-available", update.version);
                            }
                            Ok(None) => {
                                log::info!("App is up to date");
                            }
                            Err(e) => {
                                log::error!("Failed to check for updates: {}", e);
                            }
                        },
                        Err(e) => {
                            log::error!("Failed to get updater: {}", e);
                        }
                    }
                    // Wait for 12 hours before next check
                    tokio::time::sleep(Duration::from_secs(12 * 60 * 60)).await;
                }
            });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::settings_commands::get_app_data_directory,
      commands::settings_commands::get_global_settings,
      commands::settings_commands::save_global_settings,
      commands::settings_commands::get_project_settings,
      commands::settings_commands::save_project_settings,
      commands::project_commands::get_all_projects,
      commands::project_commands::get_project,
      commands::project_commands::create_project,
      commands::project_commands::get_project_files,
      commands::project_commands::delete_project,
      commands::project_commands::rename_project,
      commands::project_commands::get_project_cost,
      commands::file_commands::read_markdown_file,
      commands::file_commands::write_markdown_file,
      commands::file_commands::delete_markdown_file,
      commands::file_commands::rename_markdown_file,
      commands::file_commands::search_in_files,
      commands::file_commands::replace_in_files,
      commands::file_commands::import_document,
      commands::file_commands::import_transcript,
      commands::file_commands::export_document,
      commands::chat_commands::send_message,
      commands::chat_commands::switch_provider,
      commands::chat_commands::load_chat_history,
      commands::chat_commands::get_chat_files,
      commands::chat_commands::save_chat,
      commands::chat_commands::get_ollama_models,
      commands::secrets_commands::save_secrets,
      commands::secrets_commands::has_claude_api_key,
      commands::secrets_commands::has_gemini_api_key,
      commands::secrets_commands::has_secret,
      commands::secrets_commands::list_saved_secret_ids,
      commands::secrets_commands::test_encryption,
      commands::secrets_commands::reset_encryption_key,
      commands::skill_commands::get_all_skills,
      commands::skill_commands::get_skill,
      commands::skill_commands::save_skill,
      commands::skill_commands::delete_skill,
      commands::skill_commands::create_skill_template,
      commands::skill_commands::get_skills_by_category,
      commands::skill_commands::render_skill_prompt,
      commands::skill_commands::validate_skill,
      commands::skill_commands::create_skill,
      commands::skill_commands::update_skill,
      commands::skill_commands::import_skill,
      commands::workflow_commands::get_project_workflows,
      commands::workflow_commands::get_workflow,
      commands::workflow_commands::create_workflow,
      commands::workflow_commands::save_workflow,
      commands::workflow_commands::delete_workflow,
      commands::workflow_commands::execute_workflow,
      commands::workflow_commands::set_workflow_schedule,
      commands::workflow_commands::clear_workflow_schedule,
      commands::workflow_commands::validate_workflow,
      commands::workflow_commands::add_workflow_step,
      commands::workflow_commands::remove_workflow_step,
      commands::markdown_commands::render_markdown_to_html,
      commands::markdown_commands::extract_markdown_links,
      commands::markdown_commands::generate_markdown_toc,
      commands::installation_commands::check_installation_status,
      commands::installation_commands::detect_claude_code,
      commands::installation_commands::detect_ollama,
      commands::installation_commands::detect_gemini,
      commands::installation_commands::detect_all_cli_tools,
      commands::installation_commands::get_claude_code_install_instructions,
      commands::installation_commands::get_ollama_install_instructions,
      commands::installation_commands::get_gemini_install_instructions,
      commands::installation_commands::clear_cli_detection_cache,
      commands::installation_commands::clear_all_cli_detection_caches,
      commands::installation_commands::run_installation,
      commands::installation_commands::verify_directory_structure,
      commands::installation_commands::redetect_dependencies,
      commands::installation_commands::backup_installation,
      commands::installation_commands::cleanup_old_backups,
      commands::installation_commands::is_first_install,
      commands::update_commands::run_update_process,
      commands::update_commands::check_and_preserve_structure,
      commands::update_commands::backup_user_data,
      commands::update_commands::verify_installation_integrity,
      commands::update_commands::restore_from_backup,
      commands::update_commands::list_backups,
      commands::config_commands::get_app_config,
      commands::config_commands::save_app_config,
      commands::config_commands::config_exists,
      commands::config_commands::update_claude_code_config,
      commands::config_commands::update_ollama_config,
      commands::config_commands::update_last_check,
      commands::config_commands::reset_config,
      commands::settings_commands::authenticate_gemini,
      commands::settings_commands::add_custom_cli,
      commands::settings_commands::remove_custom_cli,
      commands::settings_commands::list_available_providers,
      commands::menu_commands::trigger_new_project,
      commands::menu_commands::trigger_new_file,
      commands::menu_commands::trigger_close_file,
      commands::menu_commands::trigger_close_project,
      commands::menu_commands::trigger_find,
      commands::menu_commands::trigger_replace,
      commands::menu_commands::trigger_find_in_files,
      commands::menu_commands::trigger_replace_in_files,
      commands::menu_commands::trigger_select_all,
      commands::menu_commands::trigger_expand_selection,
      commands::menu_commands::trigger_copy_as_markdown,
      commands::menu_commands::trigger_welcome,
      commands::menu_commands::trigger_release_notes,
      commands::menu_commands::trigger_documentation,
      commands::menu_commands::trigger_check_for_updates,
      commands::menu_commands::trigger_settings,
      commands::settings_commands::get_system_username,
      commands::settings_commands::get_formatted_owner_name,
      commands::mcp::get_mcp_servers,
      commands::mcp::add_mcp_server,
      commands::mcp::remove_mcp_server,
      commands::mcp::toggle_mcp_server,
      commands::mcp::update_mcp_server,
      commands::mcp::fetch_mcp_marketplace,
      commands::mcp::sync_mcp_with_clis,
      commands::mcp::test_litellm_connection,
      commands::artifact_commands::create_artifact,
      commands::artifact_commands::get_artifact,
      commands::artifact_commands::list_artifacts,
      commands::artifact_commands::save_artifact,
      commands::artifact_commands::delete_artifact,
      commands::cancellation::stop_agent_execution,
    ])
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .run(tauri::generate_context!())
    .unwrap_or_else(|e| {
      log::error!("Fatal error while running Tauri application: {}", e);
      std::process::exit(1);
    });
}
