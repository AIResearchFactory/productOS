use serde::{Serialize, Deserialize};
use thiserror::Error;

#[derive(Debug, Error, Serialize, Deserialize)]
#[serde(tag = "type", content = "message")]
pub enum AppError {
    #[error("Internal error: {0}")]
    Internal(String),
    
    #[error("Not found: {0}")]
    NotFound(String),
    
    #[error("IO error: {0}")]
    Io(String),
    
    #[error("Settings error: {0}")]
    Settings(String),
    
    #[error("AI Service error: {0}")]
    Ai(String),
    
    #[error("Auth error: {0}")]
    Auth(String),
    
    #[error("Validation error: {0}")]
    Validation(String),
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err.to_string())
    }
}



impl From<crate::models::project::ProjectError> for AppError {
    fn from(err: crate::models::project::ProjectError) -> Self {
        match err {
            crate::models::project::ProjectError::ReadError(e) => AppError::Io(e.to_string()),
            crate::models::project::ProjectError::ParseError(e) => AppError::Internal(e),
            crate::models::project::ProjectError::InvalidStructure(e) => AppError::Validation(e),
            crate::models::project::ProjectError::SettingsError(e) => AppError::Settings(e),
        }
    }
}

impl From<crate::models::settings::SettingsError> for AppError {
    fn from(err: crate::models::settings::SettingsError) -> Self {
        match err {
            crate::models::settings::SettingsError::ReadError(e) => AppError::Io(e.to_string()),
            crate::models::settings::SettingsError::ParseError(e) => AppError::Settings(e),
            crate::models::settings::SettingsError::WriteError(e) => AppError::Settings(e),
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;
