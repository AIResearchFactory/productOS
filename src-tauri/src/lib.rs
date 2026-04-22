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
