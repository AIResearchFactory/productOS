use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResearchLogEntry {
    pub timestamp: String,
    pub provider: String,
    pub command: Option<String>,
    pub content: String,
}
