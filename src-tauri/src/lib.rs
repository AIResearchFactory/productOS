// Modules
pub mod config;
pub mod models;
pub mod services;
pub mod utils;

// New installation modules
pub mod detector;
pub mod directory;
pub mod installer;
pub mod updater;

// We preserve the commands module as it contains the logic used by Axum routes
pub mod commands;

// Server module for headless PWA mode
pub mod server;

/// Entry point for the application when running in standalone mode.
/// This initializes a Tokio runtime and starts the Axum server.
pub fn run() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("Failed to create Tokio runtime");
    
    rt.block_on(async {
        server::start_server().await;
    });
}
