use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// A single cost record for an AI model invocation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CostRecord {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub provider: String,
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cost_usd: f64,
    #[serde(default)]
    pub artifact_id: Option<String>,
    #[serde(default)]
    pub workflow_run_id: Option<String>,
}

/// Budget configuration and current spend tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CostBudget {
    #[serde(default)]
    pub daily_limit_usd: Option<f64>,
    #[serde(default)]
    pub monthly_limit_usd: Option<f64>,
    #[serde(default)]
    pub current_daily_usd: f64,
    #[serde(default)]
    pub current_monthly_usd: f64,
}

impl Default for CostBudget {
    fn default() -> Self {
        Self {
            daily_limit_usd: None,
            monthly_limit_usd: None,
            current_daily_usd: 0.0,
            current_monthly_usd: 0.0,
        }
    }
}

impl CostBudget {
    /// Check if daily budget is near the threshold (fraction 0.0–1.0)
    pub fn is_near_daily_limit(&self, threshold_fraction: f64) -> bool {
        if let Some(limit) = self.daily_limit_usd {
            self.current_daily_usd >= limit * threshold_fraction
        } else {
            false
        }
    }

    /// Check if monthly budget is near the threshold
    pub fn is_near_monthly_limit(&self, threshold_fraction: f64) -> bool {
        if let Some(limit) = self.monthly_limit_usd {
            self.current_monthly_usd >= limit * threshold_fraction
        } else {
            false
        }
    }

    /// Whether condensed mode should be suggested based on budget proximity
    pub fn should_suggest_condensed(&self, warning_threshold: f64) -> bool {
        self.is_near_daily_limit(warning_threshold) || self.is_near_monthly_limit(warning_threshold)
    }
}

/// Cost telemetry log stored per-project
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CostLog {
    pub records: Vec<CostRecord>,
    pub budget: CostBudget,
}

impl Default for CostLog {
    fn default() -> Self {
        Self {
            records: Vec::new(),
            budget: CostBudget::default(),
        }
    }
}

impl CostLog {
    /// Load cost log from a JSON file
    pub fn load<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let path = path.as_ref();
        if !path.exists() {
            return Ok(Self::default());
        }
        let content =
            fs::read_to_string(path).map_err(|e| format!("Failed to read cost log: {}", e))?;
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse cost log: {}", e))
    }

    /// Save cost log to a JSON file
    pub fn save<P: AsRef<Path>>(&self, path: P) -> Result<(), String> {
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize cost log: {}", e))?;
        fs::write(path, content).map_err(|e| format!("Failed to write cost log: {}", e))?;
        Ok(())
    }

    /// Add a cost record and update running totals
    pub fn add_record(&mut self, record: CostRecord) {
        self.budget.current_daily_usd += record.cost_usd;
        self.budget.current_monthly_usd += record.cost_usd;
        self.records.push(record);
    }

    /// Total cost across all records
    pub fn total_cost(&self) -> f64 {
        self.records.iter().map(|r| r.cost_usd).sum()
    }

    /// Average cost per artifact (only records linked to artifacts)
    pub fn average_cost_per_artifact(&self) -> Option<f64> {
        let artifact_records: Vec<_> = self
            .records
            .iter()
            .filter(|r| r.artifact_id.is_some())
            .collect();
        if artifact_records.is_empty() {
            None
        } else {
            let total: f64 = artifact_records.iter().map(|r| r.cost_usd).sum();
            Some(total / artifact_records.len() as f64)
        }
    }

    /// Compute specific model cost per million tokens (returns USD)
    pub fn compute_cost_usd(model: &str, in_tokens: u64, out_tokens: u64) -> f64 {
        let lower = model.to_lowercase();
        let (in_rate_per_m, out_rate_per_m) = if lower.contains("sonnet") {
            (3.0, 15.0)
        } else if lower.contains("opus") {
            (15.0, 75.0)
        } else if lower.contains("haiku") {
            (0.25, 1.25)
        } else if lower.contains("gpt-4o") || lower.contains("gpt-4.1") {
            (5.0, 15.0)
        } else if lower.contains("gemini-1.5-pro") || lower.contains("gemini-2.5-pro") {
            (3.5, 10.5)
        } else if lower.contains("gemini-1.5-flash") || lower.contains("gemini-2.5-flash") {
            (0.075, 0.3)
        } else if lower.contains("gpt-4") {
            (10.0, 30.0)
        } else if lower.contains("gpt-3.5") {
            (0.5, 1.5)
        } else {
            // Default generic cloud model approx
            (1.0, 3.0)
        };
        
        // If it's a completely local model, cost is 0
        if lower.contains("llama") || lower.contains("mistral") || lower.contains("qwen") || lower.contains("deepseek") || lower.contains("phi") {
            return 0.0;
        }

        let in_cost = (in_tokens as f64 / 1_000_000.0) * in_rate_per_m;
        let out_cost = (out_tokens as f64 / 1_000_000.0) * out_rate_per_m;
        in_cost + out_cost
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cost_budget_thresholds() {
        let budget = CostBudget {
            daily_limit_usd: Some(10.0),
            monthly_limit_usd: Some(100.0),
            current_daily_usd: 8.5,
            current_monthly_usd: 75.0,
        };

        // 0.8 threshold: daily 8.5 >= 10*0.8=8.0 → true
        assert!(budget.is_near_daily_limit(0.8));
        // 0.9 threshold: daily 8.5 >= 10*0.9=9.0 → false
        assert!(!budget.is_near_daily_limit(0.9));

        // Monthly 75 >= 100*0.8=80 → false
        assert!(!budget.is_near_monthly_limit(0.8));
        // Monthly 75 >= 100*0.7=70 → true
        assert!(budget.is_near_monthly_limit(0.7));

        assert!(budget.should_suggest_condensed(0.8));
    }

    #[test]
    fn test_cost_log_operations() {
        let mut log = CostLog::default();

        let record = CostRecord {
            id: "cost-001".to_string(),
            timestamp: Utc::now(),
            provider: "openai".to_string(),
            model: "gpt-4.1-mini".to_string(),
            input_tokens: 1000,
            output_tokens: 500,
            cost_usd: 0.05,
            artifact_id: Some("insight-001".to_string()),
            workflow_run_id: None,
        };

        log.add_record(record);

        assert_eq!(log.total_cost(), 0.05);
        assert_eq!(log.budget.current_daily_usd, 0.05);
        assert_eq!(log.average_cost_per_artifact(), Some(0.05));
    }

    #[test]
    fn test_cost_log_serialization() {
        let temp_dir = tempfile::TempDir::new().unwrap();
        let log_path = temp_dir.path().join("cost_log.json");

        let mut log = CostLog::default();
        log.budget.daily_limit_usd = Some(5.0);
        log.add_record(CostRecord {
            id: "cost-001".to_string(),
            timestamp: Utc::now(),
            provider: "anthropic".to_string(),
            model: "claude-sonnet-4".to_string(),
            input_tokens: 2000,
            output_tokens: 1000,
            cost_usd: 0.12,
            artifact_id: None,
            workflow_run_id: Some("wf-001".to_string()),
        });

        log.save(&log_path).unwrap();
        let loaded = CostLog::load(&log_path).unwrap();

        assert_eq!(loaded.records.len(), 1);
        assert_eq!(loaded.budget.daily_limit_usd, Some(5.0));
        assert_eq!(loaded.total_cost(), 0.12);
    }

    // ===== C6: No artifact-linked records =====
    #[test]
    fn test_average_cost_no_artifacts() {
        let mut log = CostLog::default();
        log.add_record(CostRecord {
            id: "cost-no-art".to_string(),
            timestamp: Utc::now(),
            provider: "openai".to_string(),
            model: "gpt-4.1-mini".to_string(),
            input_tokens: 100,
            output_tokens: 50,
            cost_usd: 0.01,
            artifact_id: None, // No artifact
            workflow_run_id: None,
        });
        assert_eq!(log.average_cost_per_artifact(), None);
    }

    // ===== C7: No budget set → never triggers =====
    #[test]
    fn test_no_budget_never_triggers() {
        let budget = CostBudget::default(); // No limits set
        assert!(!budget.is_near_daily_limit(0.5));
        assert!(!budget.is_near_monthly_limit(0.5));
        assert!(!budget.should_suggest_condensed(0.8));
    }

    // ===== C8: Multiple records accumulate correctly =====
    #[test]
    fn test_multiple_records_accumulate() {
        let mut log = CostLog::default();
        log.budget.daily_limit_usd = Some(1.0);

        for i in 0..10 {
            log.add_record(CostRecord {
                id: format!("cost-{:03}", i),
                timestamp: Utc::now(),
                provider: "anthropic".to_string(),
                model: "claude-sonnet-4".to_string(),
                input_tokens: 500,
                output_tokens: 250,
                cost_usd: 0.05,
                artifact_id: if i % 2 == 0 {
                    Some(format!("art-{}", i))
                } else {
                    None
                },
                workflow_run_id: None,
            });
        }

        assert_eq!(log.records.len(), 10);
        assert!((log.total_cost() - 0.50).abs() < 0.001);
        assert!((log.budget.current_daily_usd - 0.50).abs() < 0.001);
        assert!((log.budget.current_monthly_usd - 0.50).abs() < 0.001);

        // 5 artifact-linked records, each $0.05 → average = $0.05
        assert_eq!(log.average_cost_per_artifact(), Some(0.05));

        // 10 × 0.05 = ~0.50 (f64 precision: ~0.4999999)
        // threshold 0.49: 0.4999... >= 1.0 * 0.49 = 0.49 → true
        assert!(log.budget.is_near_daily_limit(0.49));
        // threshold 0.8: 0.4999... >= 1.0 * 0.8 = 0.8 → false
        assert!(!log.budget.is_near_daily_limit(0.8));
    }

    // ===== Budget suggest condensed with both limits =====
    #[test]
    fn test_suggest_condensed_monthly_only() {
        let budget = CostBudget {
            daily_limit_usd: Some(100.0),  // Far from daily limit
            monthly_limit_usd: Some(10.0), // Close to monthly limit
            current_daily_usd: 1.0,
            current_monthly_usd: 9.0, // 90% of monthly
        };
        // Daily: 1.0 >= 100*0.8 = 80 → false
        // Monthly: 9.0 >= 10*0.8 = 8.0 → true
        assert!(budget.should_suggest_condensed(0.8));
    }
}
