use anyhow::{anyhow, Result};
use std::process::Stdio;
use tokio::process::Command;

use crate::services::cancellation_service::CANCELLATION_MANAGER;
use crate::services::cli_config_service::CliConfigService;

pub struct CliExecutor;

impl CliExecutor {
    /// Prepare a base command with environment variables and working directory
    pub fn prepare_command(
        command_str: &str,
        api_key: Option<String>,
        api_key_env_var: &str,
        project_path: Option<&str>,
    ) -> Result<Command> {
        let parsed = crate::utils::process::parse_command_string(command_str)
            .map_err(|e| anyhow!(e))?;

        let mut command = crate::utils::process::tokio_command(&parsed.program);
        if !parsed.args.is_empty() {
            command.args(&parsed.args);
        }

        command.stdin(Stdio::null());

        if let Some(key) = api_key {
            command.env(api_key_env_var, key);
        }

        if let Some(path) = project_path {
            command.current_dir(path);

            if let Ok(mcp_secrets) = CliConfigService::collect_mcp_secrets() {
                for (k, v) in mcp_secrets {
                    command.env(k, v);
                }
            }
        }

        Ok(command)
    }

    pub fn map_error(
        err_msg: &str,
        provider_type: &crate::models::ai::ProviderType,
        model_alias: Option<&str>,
    ) -> anyhow::Error {
        crate::services::ai_error_service::AIErrorService::map_error(
            err_msg,
            provider_type,
            model_alias,
        )
    }

    pub async fn register_cancellation(id: &str, child: tokio::process::Child) {
        let manager = CANCELLATION_MANAGER.clone();
        manager.register_process(id.to_string(), child).await;
    }

    pub async fn unregister_cancellation(id: &str) {
        let manager = CANCELLATION_MANAGER.clone();
        let mut processes = manager.active_processes.lock().await;
        processes.remove(id);
    }
}
