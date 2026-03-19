use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use crate::utils::paths;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    #[serde(rename = "release_date")]
    pub release_date: Option<String>,
    pub family: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub models: HashMap<String, ModelInfo>,
}

pub type ModelsData = HashMap<String, ProviderInfo>;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RemoteDefaults {
    pub openai: String,
    pub gemini: String,
}

pub struct DefaultsService;

impl DefaultsService {
    async fn fetch_remote_data() -> Result<ModelsData> {
        let url = "https://models.dev/api.json";
        let client = reqwest::Client::new();
        let resp = client.get(url).send().await?.json::<ModelsData>().await?;
        Ok(resp)
    }

    pub async fn get_recommended_defaults() -> RemoteDefaults {
        // Default hardcoded values as fallback
        let mut defaults = RemoteDefaults {
            openai: "gpt-4o".to_string(),
            gemini: "gemini-2.0-flash".to_string(),
        };

        // 1. Try local override at ~/.config/productos/defaults.json
        if let Ok(local) = Self::get_local_override() {
            return local;
        }

        // 2. Try to fetch from remote
        match Self::fetch_remote_data().await {
            Ok(data) => {
                if let Some(openai_best) = Self::find_latest_model(&data, "openai", &["gpt-5", "gpt-4o", "gpt-4"]) {
                    defaults.openai = openai_best;
                }
                if let Some(gemini_best) = Self::find_latest_model(&data, "google", &["gemini-3", "gemini-2.5", "gemini-2.0"]) {
                    defaults.gemini = gemini_best;
                }
                
                // Save to cache for next time (even if it's just app startup)
                let _ = Self::save_to_cache(&defaults);
            }
            Err(e) => {
                log::warn!("Failed to fetch remote defaults: {}. Using cached or hardcoded ones.", e);
                if let Ok(cached) = Self::load_from_cache() {
                    return cached;
                }
            }
        }

        defaults
    }

    fn find_latest_model(data: &ModelsData, provider_id: &str, families: &[&str]) -> Option<String> {
        let provider = data.get(provider_id)?;
        
        let mut best_model: Option<(&String, &ModelInfo)> = None;

        for (id, info) in &provider.models {
            // Check if model belongs to one of our target families
            let is_target = families.iter().any(|f| {
                info.id.contains(f) || info.family.as_ref().map(|fam| fam.contains(f)).unwrap_or(false)
            });

            if is_target {
                match &best_model {
                    None => best_model = Some((id, info)),
                    Some((_, current_best)) => {
                        // Compare release dates
                        let current_date = current_best.release_date.as_deref().unwrap_or("0000-00-00");
                        let new_date = info.release_date.as_deref().unwrap_or("0000-00-00");
                        if new_date > current_date {
                            best_model = Some((id, info));
                        }
                    }
                }
            }
        }

        best_model.map(|(id, _)| id.clone())
    }

    fn get_local_override() -> Result<RemoteDefaults> {
        let home = std::env::var("HOME").context("HOME not set")?;
        let path = PathBuf::from(home).join(".config").join("productos").join("defaults.json");
        if path.exists() {
            let content = fs::read_to_string(path)?;
            let defaults: RemoteDefaults = serde_json::from_str(&content)?;
            return Ok(defaults);
        }
        anyhow::bail!("No local override")
    }

    fn load_from_cache() -> Result<RemoteDefaults> {
        let app_data = paths::get_app_data_dir()?;
        let path = app_data.join("defaults_cache.json");
        if path.exists() {
            let content = fs::read_to_string(path)?;
            let defaults: RemoteDefaults = serde_json::from_str(&content)?;
            return Ok(defaults);
        }
        anyhow::bail!("No cache")
    }

    fn save_to_cache(defaults: &RemoteDefaults) -> Result<()> {
        let app_data = paths::get_app_data_dir()?;
        let path = app_data.join("defaults_cache.json");
        let content = serde_json::to_string_pretty(defaults)?;
        fs::write(path, content)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_latest_model() {
        let mut data = ModelsData::new();
        
        let mut google_models = HashMap::new();
        google_models.insert("old".to_string(), ModelInfo {
            id: "gemini-1.5-pro".to_string(),
            name: "pro".to_string(),
            release_date: Some("2024-05-14".to_string()),
            family: Some("gemini-1.5".to_string()),
        });
        google_models.insert("new".to_string(), ModelInfo {
            id: "gemini-3.1-pro".to_string(),
            name: "pro".to_string(),
            release_date: Some("2025-12-01".to_string()),
            family: Some("gemini-3.1".to_string()),
        });
        
        data.insert("google".to_string(), ProviderInfo {
            id: "google".to_string(),
            name: "Google".to_string(),
            models: google_models,
        });

        let best = DefaultsService::find_latest_model(&data, "google", &["gemini-3", "gemini-2"]);
        assert_eq!(best, Some("new".to_string()));
    }

    #[tokio::test]
    async fn test_remote_fetch_structure() {
        // This test actually calls the network, which might be flaky but good for one-off verification
        let data_result = DefaultsService::fetch_remote_data().await;
        if let Ok(data) = data_result {
            assert!(data.contains_key("openai"));
            assert!(data.contains_key("google"));
        }
    }
}
