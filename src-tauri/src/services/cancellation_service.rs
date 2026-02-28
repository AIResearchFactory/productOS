use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use anyhow::Result;
use once_cell::sync::Lazy;
use tokio_util::sync::CancellationToken;

pub static CANCELLATION_MANAGER: Lazy<Arc<CancellationService>> = Lazy::new(|| Arc::new(CancellationService::new()));

pub struct CancellationService {
    // Maps a process ID (e.g., "chat") to a cancel trigger or process handle
    pub active_processes: Mutex<HashMap<String, tokio::process::Child>>,
    // Added token support for API-based providers
    pub active_tokens: Mutex<HashMap<String, CancellationToken>>,
}

impl CancellationService {
    pub fn new() -> Self {
        Self {
            active_processes: Mutex::new(HashMap::new()),
            active_tokens: Mutex::new(HashMap::new()),
        }
    }

    pub fn global() -> Arc<Self> {
        CANCELLATION_MANAGER.clone()
    }

    pub async fn register_process(&self, id: String, child: tokio::process::Child) {
        let mut processes = self.active_processes.lock().await;
        processes.insert(id, child);
    }

    pub async fn register_token(&self, id: String, token: CancellationToken) {
        let mut tokens = self.active_tokens.lock().await;
        tokens.insert(id, token);
    }

    pub async fn cancel_process(&self, id: &str) -> Result<()> {
        log::info!("Canceling execution for: {}", id);
        
        // 1. Kill CLI process
        let mut processes = self.active_processes.lock().await;
        if let Some(mut child) = processes.remove(id) {
            log::info!("Killing OS process for {}", id);
            let _ = child.kill().await;
        }

        // 2. Trigger cancellation token
        let mut tokens = self.active_tokens.lock().await;
        if let Some(token) = tokens.remove(id) {
            log::info!("Triggering cancellation token for {}", id);
            token.cancel();
        }

        Ok(())
    }
}
