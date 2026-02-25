use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ArtifactError {
    #[error("Failed to read artifact file: {0}")]
    ReadError(#[from] std::io::Error),

    #[error("Failed to parse artifact metadata: {0}")]
    ParseError(String),

    #[error("Invalid artifact structure: {0}")]
    InvalidStructure(String),

    #[error("Artifact not found: {0}")]
    NotFound(String),
}

/// PM artifact types following the insight→decision→requirement→experiment ontology
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactType {
    Insight,
    Evidence,
    Decision,
    Requirement,
    MetricDefinition,
    Experiment,
    PocBrief,
}

impl ArtifactType {
    /// Returns the subdirectory name for this artifact type within a project
    pub fn directory_name(&self) -> &str {
        match self {
            ArtifactType::Insight => "insights",
            ArtifactType::Evidence => "evidence",
            ArtifactType::Decision => "decisions",
            ArtifactType::Requirement => "requirements",
            ArtifactType::MetricDefinition => "metrics",
            ArtifactType::Experiment => "experiments",
            ArtifactType::PocBrief => "poc-briefs",
        }
    }

    /// Human-readable display name
    pub fn display_name(&self) -> &str {
        match self {
            ArtifactType::Insight => "Insight",
            ArtifactType::Evidence => "Evidence",
            ArtifactType::Decision => "Decision",
            ArtifactType::Requirement => "Requirement",
            ArtifactType::MetricDefinition => "Metric",
            ArtifactType::Experiment => "Experiment",
            ArtifactType::PocBrief => "POC Brief",
        }
    }
}

/// A first-class PM artifact with markdown content and structured metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Artifact {
    pub id: String,
    pub artifact_type: ArtifactType,
    pub title: String,
    pub content: String,
    pub project_id: String,
    #[serde(default)]
    pub source_refs: Vec<String>,
    #[serde(default)]
    pub confidence: Option<f64>,
    pub created: DateTime<Utc>,
    pub updated: DateTime<Utc>,
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
    pub path: PathBuf,
}

/// JSON sidecar metadata stored alongside markdown files
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactSidecar {
    pub id: String,
    pub artifact_type: ArtifactType,
    pub title: String,
    pub project_id: String,
    #[serde(default)]
    pub source_refs: Vec<String>,
    #[serde(default)]
    pub confidence: Option<f64>,
    pub created: String,
    pub updated: String,
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

impl Artifact {
    /// Create a new artifact with defaults
    pub fn new(
        id: String,
        artifact_type: ArtifactType,
        title: String,
        project_id: String,
        path: PathBuf,
    ) -> Self {
        let now = Utc::now();
        Self {
            id,
            artifact_type,
            title,
            content: String::new(),
            project_id,
            source_refs: Vec::new(),
            confidence: None,
            created: now,
            updated: now,
            metadata: HashMap::new(),
            path,
        }
    }

    /// Load artifact from markdown file + JSON sidecar
    pub fn load<P: AsRef<Path>>(artifact_dir: P, id: &str) -> Result<Self, ArtifactError> {
        let dir = artifact_dir.as_ref();
        let md_path = dir.join(format!("{}.md", id));
        let sidecar_path = dir.join(format!("{}.json", id));

        if !md_path.exists() {
            return Err(ArtifactError::NotFound(format!(
                "Markdown file not found: {:?}",
                md_path
            )));
        }

        let content = fs::read_to_string(&md_path)?;

        let sidecar: ArtifactSidecar = if sidecar_path.exists() {
            let sidecar_content = fs::read_to_string(&sidecar_path)?;
            serde_json::from_str(&sidecar_content)
                .map_err(|e| ArtifactError::ParseError(format!("Failed to parse sidecar: {}", e)))?
        } else {
            return Err(ArtifactError::NotFound(format!(
                "Sidecar JSON not found: {:?}",
                sidecar_path
            )));
        };

        let created = DateTime::parse_from_rfc3339(&sidecar.created)
            .map_err(|e| ArtifactError::ParseError(format!("Invalid created date: {}", e)))?
            .with_timezone(&Utc);

        let updated = DateTime::parse_from_rfc3339(&sidecar.updated)
            .map_err(|e| ArtifactError::ParseError(format!("Invalid updated date: {}", e)))?
            .with_timezone(&Utc);

        Ok(Artifact {
            id: sidecar.id,
            artifact_type: sidecar.artifact_type,
            title: sidecar.title,
            content,
            project_id: sidecar.project_id,
            source_refs: sidecar.source_refs,
            confidence: sidecar.confidence,
            created,
            updated,
            metadata: sidecar.metadata,
            path: dir.to_path_buf(),
        })
    }

    /// Save artifact as markdown file + JSON sidecar
    pub fn save(&self) -> Result<(), ArtifactError> {
        // Ensure directory exists
        if !self.path.exists() {
            fs::create_dir_all(&self.path)?;
        }

        let md_path = self.path.join(format!("{}.md", self.id));
        let sidecar_path = self.path.join(format!("{}.json", self.id));

        // Write markdown content
        fs::write(&md_path, &self.content)?;

        // Write JSON sidecar
        let sidecar = ArtifactSidecar {
            id: self.id.clone(),
            artifact_type: self.artifact_type.clone(),
            title: self.title.clone(),
            project_id: self.project_id.clone(),
            source_refs: self.source_refs.clone(),
            confidence: self.confidence,
            created: self.created.to_rfc3339(),
            updated: self.updated.to_rfc3339(),
            metadata: self.metadata.clone(),
        };

        let sidecar_json = serde_json::to_string_pretty(&sidecar)
            .map_err(|e| ArtifactError::ParseError(format!("Failed to serialize sidecar: {}", e)))?;

        fs::write(&sidecar_path, sidecar_json)?;

        Ok(())
    }

    /// Validate artifact structure
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if self.id.is_empty() {
            errors.push("Artifact ID cannot be empty".to_string());
        }
        if self.title.is_empty() {
            errors.push("Artifact title cannot be empty".to_string());
        }
        if self.project_id.is_empty() {
            errors.push("Project ID cannot be empty".to_string());
        }
        if let Some(confidence) = self.confidence {
            if !(0.0..=1.0).contains(&confidence) {
                errors.push(format!("Confidence must be 0.0–1.0, got {}", confidence));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Convert artifact to markdown with frontmatter-style header
    pub fn to_markdown(&self) -> String {
        let mut md = String::new();
        md.push_str(&format!("# {}\n\n", self.title));
        md.push_str(&format!(
            "> **Type**: {} | **Created**: {}\n\n",
            self.artifact_type.display_name(),
            self.created.format("%Y-%m-%d")
        ));

        if !self.source_refs.is_empty() {
            md.push_str("## Sources\n\n");
            for source in &self.source_refs {
                md.push_str(&format!("- {}\n", source));
            }
            md.push('\n');
        }

        if !self.content.is_empty() {
            md.push_str(&self.content);
        }

        md
    }

    /// Check if this artifact is high-impact (PRD, POC Brief, or Decision)
    pub fn is_high_impact(&self) -> bool {
        matches!(
            self.artifact_type,
            ArtifactType::Decision | ArtifactType::Requirement | ArtifactType::PocBrief
        )
    }

    /// Determine if this artifact should trigger auto-escalation
    pub fn should_escalate(&self, threshold: f64) -> bool {
        if let Some(confidence) = self.confidence {
            confidence < threshold && self.is_high_impact()
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_artifact_creation() {
        let artifact = Artifact::new(
            "test-insight-1".to_string(),
            ArtifactType::Insight,
            "User prefers dark mode".to_string(),
            "project-1".to_string(),
            PathBuf::from("/tmp/test"),
        );

        assert_eq!(artifact.id, "test-insight-1");
        assert_eq!(artifact.artifact_type, ArtifactType::Insight);
        assert_eq!(artifact.title, "User prefers dark mode");
        assert!(artifact.content.is_empty());
        assert!(artifact.confidence.is_none());
    }

    #[test]
    fn test_artifact_validation() {
        let mut artifact = Artifact::new(
            String::new(),
            ArtifactType::Decision,
            String::new(),
            String::new(),
            PathBuf::from("/tmp/test"),
        );

        let errors = artifact.validate().unwrap_err();
        assert_eq!(errors.len(), 3); // id, title, project_id all empty

        artifact.id = "valid-id".to_string();
        artifact.title = "Valid Title".to_string();
        artifact.project_id = "project-1".to_string();
        assert!(artifact.validate().is_ok());

        // Invalid confidence
        artifact.confidence = Some(1.5);
        let errors = artifact.validate().unwrap_err();
        assert!(errors[0].contains("Confidence"));
    }

    #[test]
    fn test_artifact_save_and_load() {
        let temp_dir = TempDir::new().unwrap();
        let artifact_dir = temp_dir.path().join("insights");

        let mut artifact = Artifact::new(
            "insight-001".to_string(),
            ArtifactType::Insight,
            "Users want faster onboarding".to_string(),
            "project-alpha".to_string(),
            artifact_dir.clone(),
        );
        artifact.content = "## Observation\n\nUsers drop off during step 3 of onboarding.".to_string();
        artifact.confidence = Some(0.85);
        artifact.source_refs = vec!["interview-2025-01-15".to_string()];
        artifact.metadata.insert(
            "signal_strength".to_string(),
            serde_json::Value::String("strong".to_string()),
        );

        // Save
        artifact.save().unwrap();

        // Verify files exist
        assert!(artifact_dir.join("insight-001.md").exists());
        assert!(artifact_dir.join("insight-001.json").exists());

        // Load
        let loaded = Artifact::load(&artifact_dir, "insight-001").unwrap();
        assert_eq!(loaded.id, "insight-001");
        assert_eq!(loaded.artifact_type, ArtifactType::Insight);
        assert_eq!(loaded.title, "Users want faster onboarding");
        assert_eq!(loaded.confidence, Some(0.85));
        assert_eq!(loaded.source_refs.len(), 1);
        assert!(loaded.metadata.contains_key("signal_strength"));
    }

    #[test]
    fn test_artifact_to_markdown() {
        let mut artifact = Artifact::new(
            "dec-001".to_string(),
            ArtifactType::Decision,
            "Use React for frontend".to_string(),
            "project-1".to_string(),
            PathBuf::from("/tmp/test"),
        );
        artifact.content = "We decided to use React because...".to_string();
        artifact.source_refs = vec!["tech-review-2025".to_string()];

        let md = artifact.to_markdown();
        assert!(md.contains("# Use React for frontend"));
        assert!(md.contains("Decision"));
        assert!(md.contains("tech-review-2025"));
    }

    #[test]
    fn test_artifact_type_directories() {
        assert_eq!(ArtifactType::Insight.directory_name(), "insights");
        assert_eq!(ArtifactType::Evidence.directory_name(), "evidence");
        assert_eq!(ArtifactType::Decision.directory_name(), "decisions");
        assert_eq!(ArtifactType::Requirement.directory_name(), "requirements");
        assert_eq!(ArtifactType::MetricDefinition.directory_name(), "metrics");
        assert_eq!(ArtifactType::Experiment.directory_name(), "experiments");
        assert_eq!(ArtifactType::PocBrief.directory_name(), "poc-briefs");
    }

    #[test]
    fn test_escalation_logic() {
        let mut artifact = Artifact::new(
            "dec-001".to_string(),
            ArtifactType::Decision,
            "Critical decision".to_string(),
            "project-1".to_string(),
            PathBuf::from("/tmp/test"),
        );

        // No confidence → no escalation
        assert!(!artifact.should_escalate(0.6));

        // High confidence → no escalation
        artifact.confidence = Some(0.9);
        assert!(!artifact.should_escalate(0.6));

        // Low confidence + high impact → escalate
        artifact.confidence = Some(0.4);
        assert!(artifact.should_escalate(0.6));

        // Low confidence + low impact → no escalation
        let mut insight = Artifact::new(
            "ins-001".to_string(),
            ArtifactType::Insight,
            "Minor insight".to_string(),
            "project-1".to_string(),
            PathBuf::from("/tmp/test"),
        );
        insight.confidence = Some(0.4);
        assert!(!insight.should_escalate(0.6));
    }
}
