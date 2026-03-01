use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum WorkflowError {
    #[error("Failed to read workflow file: {0}")]
    ReadError(#[from] std::io::Error),

    #[error("Failed to parse workflow: {0}")]
    ParseError(String),

    #[error("Invalid workflow structure: {0}")]
    InvalidStructure(String),

    #[error("Validation failed:\n- {}", .0.join("\n- "))]
    ValidationError(Vec<String>),

    #[error("Workflow not found: {0}")]
    NotFound(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Dependency cycle detected")]
    DependencyCycle,
}

/// Represents a workflow with steps and configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<WorkflowStep>,
    pub version: String,
    pub created: String,
    pub updated: String,
    pub status: Option<String>,
    pub last_run: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: String,
    pub name: String,
    #[serde(default = "default_step_type")]
    pub step_type: StepType,
    pub config: StepConfig,
    pub depends_on: Vec<String>, // IDs of steps that must complete before this one
}

fn default_step_type() -> StepType {
    StepType::Agent
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StepType {
    Input,
    Agent,
    Iteration,
    Synthesis,
    Conditional,
    // Legacy types for backward compatibility
    Skill,
    ApiCall,
    Script,
    Condition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepConfig {
    // Common fields
    pub skill_id: Option<String>,
    pub parameters: serde_json::Value,
    pub timeout: Option<u64>,
    pub continue_on_error: Option<bool>,
    pub max_retries: Option<u32>,

    // Input step fields
    pub source_type: Option<String>, // TextInput, FileUpload, ProjectFile, ExternalUrl
    pub source_value: Option<String>,
    pub output_file: Option<String>,

    // Agent/Skill step fields
    pub input_files: Option<Vec<String>>,

    // Iteration step fields
    pub items_source: Option<String>,
    pub parallel: Option<bool>,
    pub output_pattern: Option<String>,

    // Conditional step fields
    pub condition: Option<String>,
    pub then_step: Option<String>,
    pub else_step: Option<String>,
}

impl Workflow {
    /// Validate workflow structure
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Check required fields are present
        if self.id.is_empty() {
            errors.push("workflow id cannot be empty".to_string());
        }

        if self.project_id.is_empty() {
            errors.push("project_id cannot be empty".to_string());
        }

        if self.name.is_empty() {
            errors.push("name cannot be empty".to_string());
        }

        // Validate workflow_id format (alphanumeric + hyphens + underscores)
        let valid_id = self
            .id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_');
        if !valid_id {
            errors.push(format!(
                "workflow id '{}' contains invalid characters (only alphanumeric, hyphens, and underscores allowed)",
                self.id
            ));
        }

        // Validate version format
        if !self.version.is_empty() {
            let parts: Vec<&str> = self.version.split('.').collect();
            if parts.len() != 3 || parts.iter().any(|p| p.parse::<u32>().is_err()) {
                errors.push(format!(
                    "version '{}' is not in valid semver format (expected x.y.z)",
                    self.version
                ));
            }
        }

        // Validate steps (Allowing empty steps can cause issues during execution)
        if self.steps.is_empty() {
            errors.push("workflow must have at least one step".to_string());
        }

        // Validate step dependencies
        let step_ids: std::collections::HashSet<_> = self.steps.iter().map(|s| &s.id).collect();
        for step in &self.steps {
            for dep_id in &step.depends_on {
                if !step_ids.contains(dep_id) {
                    errors.push(format!(
                        "step '{}' depends on non-existent step '{}'",
                        step.id, dep_id
                    ));
                }
            }
        }

        // Check for circular dependencies using depth-first search
        if let Err(cycle_error) = self.detect_cycles() {
            errors.push(cycle_error);
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Detect circular dependencies in workflow steps using DFS
    fn detect_cycles(&self) -> Result<(), String> {
        use std::collections::{HashMap, HashSet};

        // Build adjacency list
        let mut graph: HashMap<&str, Vec<&str>> = HashMap::new();
        for step in &self.steps {
            graph.insert(
                &step.id,
                step.depends_on.iter().map(|s| s.as_str()).collect(),
            );
        }

        // Track visited nodes and nodes in current path
        let mut visited: HashSet<&str> = HashSet::new();
        let mut rec_stack: HashSet<&str> = HashSet::new();

        // DFS helper function
        fn dfs<'a>(
            node: &'a str,
            graph: &HashMap<&'a str, Vec<&'a str>>,
            visited: &mut HashSet<&'a str>,
            rec_stack: &mut HashSet<&'a str>,
            path: &mut Vec<&'a str>,
        ) -> Result<(), String> {
            visited.insert(node);
            rec_stack.insert(node);
            path.push(node);

            if let Some(neighbors) = graph.get(node) {
                for &neighbor in neighbors {
                    if !visited.contains(neighbor) {
                        dfs(neighbor, graph, visited, rec_stack, path)?;
                    } else if rec_stack.contains(neighbor) {
                        // Found a cycle - build error message with cycle path
                        let cycle_start = path.iter().position(|&n| n == neighbor).unwrap();
                        let cycle_path: Vec<&str> = path[cycle_start..].to_vec();
                        return Err(format!(
                            "circular dependency detected: {} → {} → {}",
                            cycle_path.join(" → "),
                            neighbor,
                            cycle_path[0]
                        ));
                    }
                }
            }

            rec_stack.remove(node);
            path.pop();
            Ok(())
        }

        // Check each node
        for step in &self.steps {
            if !visited.contains(step.id.as_str()) {
                let mut path = Vec::new();
                dfs(&step.id, &graph, &mut visited, &mut rec_stack, &mut path)?;
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_valid_workflow() {
        let workflow = Workflow {
            id: "test-workflow".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Workflow".to_string(),
            description: "A test workflow".to_string(),
            steps: vec![WorkflowStep {
                id: "step1".to_string(),
                name: "Step 1".to_string(),
                step_type: StepType::Skill,
                config: StepConfig {
                    skill_id: Some("skill-1".to_string()),
                    parameters: serde_json::json!({}),
                    timeout: None,
                    continue_on_error: None,
                    max_retries: None,
                    source_type: None,
                    source_value: None,
                    output_file: None,
                    input_files: None,
                    items_source: None,
                    parallel: None,
                    output_pattern: None,
                    condition: None,
                    then_step: None,
                    else_step: None,
                },
                depends_on: vec![],
            }],
            version: "1.0.0".to_string(),
            created: "2024-11-13".to_string(),
            updated: "2024-11-13".to_string(),
            status: None,
            last_run: None,
        };

        assert!(workflow.validate().is_ok());
    }

    #[test]
    fn test_validate_invalid_id() {
        let workflow = Workflow {
            id: "test workflow!".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Workflow".to_string(),
            description: "A test workflow".to_string(),
            steps: vec![],
            version: "1.0.0".to_string(),
            created: "".to_string(),
            updated: "".to_string(),
            status: None,
            last_run: None,
        };

        let result = workflow.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("invalid characters")));
    }

    #[test]
    fn test_validate_empty_steps() {
        let workflow = Workflow {
            id: "test-workflow".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Workflow".to_string(),
            description: "A test workflow".to_string(),
            steps: vec![],
            version: "1.0.0".to_string(),
            created: "2024-11-13".to_string(),
            updated: "2024-11-13".to_string(),
            status: None,
            last_run: None,
        };

        let result = workflow.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("at least one step")));
    }

    #[test]
    fn test_validate_circular_dependency_detection() {
        // Test simple circular dependency: A -> B -> A
        let workflow = Workflow {
            id: "test-circular".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Circular".to_string(),
            description: "Testing circular dependencies".to_string(),
            steps: vec![
                WorkflowStep {
                    id: "step-a".to_string(),
                    name: "Step A".to_string(),
                    step_type: StepType::Skill,
                    config: StepConfig {
                        skill_id: Some("skill-1".to_string()),
                        parameters: serde_json::json!({}),
                        timeout: None,
                        continue_on_error: None,
                        max_retries: None,
                        source_type: None,
                        source_value: None,
                        output_file: None,
                        input_files: None,
                        items_source: None,
                        parallel: None,
                        output_pattern: None,
                        condition: None,
                        then_step: None,
                        else_step: None,
                    },
                    depends_on: vec!["step-b".to_string()],
                },
                WorkflowStep {
                    id: "step-b".to_string(),
                    name: "Step B".to_string(),
                    step_type: StepType::Skill,
                    config: StepConfig {
                        skill_id: Some("skill-2".to_string()),
                        parameters: serde_json::json!({}),
                        timeout: None,
                        continue_on_error: None,
                        max_retries: None,
                        source_type: None,
                        source_value: None,
                        output_file: None,
                        input_files: None,
                        items_source: None,
                        parallel: None,
                        output_pattern: None,
                        condition: None,
                        then_step: None,
                        else_step: None,
                    },
                    depends_on: vec!["step-a".to_string()],
                },
            ],
            version: "1.0.0".to_string(),
            created: "2024-11-13".to_string(),
            updated: "2024-11-13".to_string(),
            status: None,
            last_run: None,
        };

        // Now validate() detects cycles
        let result = workflow.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("circular dependency")));
    }

    #[test]
    fn test_validate_complex_circular_dependency() {
        // Test complex circular dependency: A -> B -> C -> A
        let workflow = Workflow {
            id: "test-complex-circular".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Complex Circular".to_string(),
            description: "Testing complex circular dependencies".to_string(),
            steps: vec![
                WorkflowStep {
                    id: "step-a".to_string(),
                    name: "Step A".to_string(),
                    step_type: StepType::Skill,
                    config: StepConfig {
                        skill_id: Some("skill-1".to_string()),
                        parameters: serde_json::json!({}),
                        timeout: None,
                        continue_on_error: None,
                        max_retries: None,
                        source_type: None,
                        source_value: None,
                        output_file: None,
                        input_files: None,
                        items_source: None,
                        parallel: None,
                        output_pattern: None,
                        condition: None,
                        then_step: None,
                        else_step: None,
                    },
                    depends_on: vec!["step-c".to_string()],
                },
                WorkflowStep {
                    id: "step-b".to_string(),
                    name: "Step B".to_string(),
                    step_type: StepType::Skill,
                    config: StepConfig {
                        skill_id: Some("skill-2".to_string()),
                        parameters: serde_json::json!({}),
                        timeout: None,
                        continue_on_error: None,
                        max_retries: None,
                        source_type: None,
                        source_value: None,
                        output_file: None,
                        input_files: None,
                        items_source: None,
                        parallel: None,
                        output_pattern: None,
                        condition: None,
                        then_step: None,
                        else_step: None,
                    },
                    depends_on: vec!["step-a".to_string()],
                },
                WorkflowStep {
                    id: "step-c".to_string(),
                    name: "Step C".to_string(),
                    step_type: StepType::Skill,
                    config: StepConfig {
                        skill_id: Some("skill-3".to_string()),
                        parameters: serde_json::json!({}),
                        timeout: None,
                        continue_on_error: None,
                        max_retries: None,
                        source_type: None,
                        source_value: None,
                        output_file: None,
                        input_files: None,
                        items_source: None,
                        parallel: None,
                        output_pattern: None,
                        condition: None,
                        then_step: None,
                        else_step: None,
                    },
                    depends_on: vec!["step-b".to_string()],
                },
            ],
            version: "1.0.0".to_string(),
            created: "2024-11-13".to_string(),
            updated: "2024-11-13".to_string(),
            status: None,
            last_run: None,
        };

        // This test verifies that cycle detection works correctly
        let result = workflow.validate();
        assert!(result.is_err()); // Should detect the circular dependency
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("circular dependency")));
    }

    #[test]
    fn test_validate_valid_dependency_chain() {
        // Test valid linear dependency: A -> B -> C (no cycles)
        let workflow = Workflow {
            id: "test-valid-chain".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Valid Chain".to_string(),
            description: "Testing valid dependency chain".to_string(),
            steps: vec![
                WorkflowStep {
                    id: "step-a".to_string(),
                    name: "Step A".to_string(),
                    step_type: StepType::Input,
                    config: StepConfig {
                        skill_id: None,
                        parameters: serde_json::json!({}),
                        timeout: None,
                        continue_on_error: None,
                        max_retries: None,
                        source_type: Some("TextInput".to_string()),
                        source_value: Some("input".to_string()),
                        output_file: Some("input.txt".to_string()),
                        input_files: None,
                        items_source: None,
                        parallel: None,
                        output_pattern: None,
                        condition: None,
                        then_step: None,
                        else_step: None,
                    },
                    depends_on: vec![],
                },
                WorkflowStep {
                    id: "step-b".to_string(),
                    name: "Step B".to_string(),
                    step_type: StepType::Agent,
                    config: StepConfig {
                        skill_id: Some("skill-1".to_string()),
                        parameters: serde_json::json!({}),
                        timeout: None,
                        continue_on_error: None,
                        max_retries: None,
                        source_type: None,
                        source_value: None,
                        output_file: None,
                        input_files: Some(vec!["input.txt".to_string()]),
                        items_source: None,
                        parallel: None,
                        output_pattern: None,
                        condition: None,
                        then_step: None,
                        else_step: None,
                    },
                    depends_on: vec!["step-a".to_string()],
                },
                WorkflowStep {
                    id: "step-c".to_string(),
                    name: "Step C".to_string(),
                    step_type: StepType::Synthesis,
                    config: StepConfig {
                        skill_id: None,
                        parameters: serde_json::json!({}),
                        timeout: None,
                        continue_on_error: None,
                        max_retries: None,
                        source_type: None,
                        source_value: None,
                        output_file: None,
                        input_files: None,
                        items_source: None,
                        parallel: None,
                        output_pattern: None,
                        condition: None,
                        then_step: None,
                        else_step: None,
                    },
                    depends_on: vec!["step-b".to_string()],
                },
            ],
            version: "1.0.0".to_string(),
            created: "2024-11-13".to_string(),
            updated: "2024-11-13".to_string(),
            status: None,
            last_run: None,
        };

        let result = workflow.validate();
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_nonexistent_dependency() {
        // Test that validation catches references to non-existent steps
        let workflow = Workflow {
            id: "test-nonexistent".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Nonexistent".to_string(),
            description: "Testing nonexistent dependency".to_string(),
            steps: vec![WorkflowStep {
                id: "step-a".to_string(),
                name: "Step A".to_string(),
                step_type: StepType::Skill,
                config: StepConfig {
                    skill_id: Some("skill-1".to_string()),
                    parameters: serde_json::json!({}),
                    timeout: None,
                    continue_on_error: None,
                    max_retries: None,
                    source_type: None,
                    source_value: None,
                    output_file: None,
                    input_files: None,
                    items_source: None,
                    parallel: None,
                    output_pattern: None,
                    condition: None,
                    then_step: None,
                    else_step: None,
                },
                depends_on: vec!["nonexistent-step".to_string()],
            }],
            version: "1.0.0".to_string(),
            created: "2024-11-13".to_string(),
            updated: "2024-11-13".to_string(),
            status: None,
            last_run: None,
        };

        let result = workflow.validate();
        assert!(result.is_err());
        let errors = result.unwrap_err();
        assert!(errors.iter().any(|e| e.contains("non-existent step")));
    }
}

// ===== Execution Structures =====

/// Represents a workflow execution instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecution {
    pub workflow_id: String,
    pub started: String,
    pub completed: Option<String>,
    pub status: ExecutionStatus,
    pub step_results: HashMap<String, StepResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExecutionStatus {
    Running,
    Completed,
    Failed,
    PartialSuccess,
}

/// Result of executing a single step
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    pub step_id: String,
    pub status: StepStatus,
    pub started: String,
    pub completed: Option<String>,
    pub output_files: Vec<String>,
    pub error: Option<String>,
    pub logs: Vec<String>,
    pub next_step_id: Option<String>, // For conditional steps
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

/// Progress information for workflow execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowProgress {
    pub workflow_id: String,
    pub step_name: String,
    pub status: String,
    pub progress_percent: u32,
}
