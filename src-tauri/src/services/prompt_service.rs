use crate::services::project_service::ProjectService;
use crate::services::settings_service::SettingsService;
use crate::services::context_service::ContextService;
use crate::services::skill_service::SkillService;

pub enum PromptMode {
    General,
    Research,
    Workflow,
    Coding,
    Artifact,
}

pub struct PromptService;

impl PromptService {
    /// Build the full system prompt based on project context, mode, and global rules
    pub fn build_system_prompt(
        project_id: Option<&str>,
        mode: PromptMode,
    ) -> String {
        let mut prompt = String::new();

        // 1. Base Identity & Rules
        prompt.push_str("You are a helpful AI research assistant.\n\n");
        prompt.push_str(&Self::get_file_modification_rules());
        prompt.push_str("\n\n");
        prompt.push_str(&Self::get_workflow_rules());

        // 2. Mode-specific instructions
        match mode {
            PromptMode::Research => {
                prompt.push_str("\n### RESEARCH MODE\nFocus on gathering comprehensive information, citing sources, and documenting findings clearly in research_log.md.\n");
            }
            PromptMode::Workflow => {
                prompt.push_str("\n### WORKFLOW MODE\nFocus on designing or executing structured, multi-step automation. Ensure all steps have clear inputs/outputs and dependencies.\n");
            }
            PromptMode::Coding => {
                prompt.push_str("\n### CODING MODE\nFocus on writing clean, efficient, and well-documented code. Always verify file paths before applying changes.\n");
            }
            PromptMode::Artifact => {
                prompt.push_str("\n### ARTIFACT MODE\nFocus on creating high-quality, structured documents or assets. Follow the project's styling and formatting rules strictly.\n");
            }
            PromptMode::General => {}
        }

        // 3. Project Context (if available)
        if let Some(pid) = project_id {
            if let Ok(project) = ProjectService::load_project_by_id(pid) {
                prompt.push_str(&format!(
                    "\n\n--- PROJECT: {} ---\nGoal: {}\n",
                    project.name, project.goal
                ));

                // Project Personalization Rules
                if let Ok(projects_path) = SettingsService::get_projects_path() {
                    let project_path = projects_path.join(pid);
                    if let Ok(Some(settings)) = SettingsService::load_project_settings(&project_path) {
                        if let Some(rules) = settings.personalization_rules {
                            if !rules.is_empty() {
                                prompt.push_str("\n=== PROJECT PERSONALIZATION RULES ===\n");
                                prompt.push_str(&rules);
                                prompt.push_str("\n=====================================\n");
                            }
                        }
                    }
                }

                // Automatic Context Injection (Recent Files, History)
                if let Ok(project_context) = ContextService::get_project_context(pid) {
                    prompt.push_str("\n\n---\nAUTOMATIC CONTEXT INJECTION (Project Files & History):\n");
                    prompt.push_str(&project_context);
                }
            }
        }

        // 4. Global Skills Injection
        if let Ok(skills) = SkillService::get_all_skills() {
            if !skills.is_empty() {
                prompt.push_str("\n\n---\nREGISTERED SKILLS:\n");
                for skill in skills {
                    if skill.id == "template" { continue; }
                    prompt.push_str(&format!("- {} (ID: {}): {}\n", skill.name, skill.id, skill.description));
                }
            }
        }

        prompt
    }

    fn get_file_modification_rules() -> String {
        r#"You can create or update files in the project by using one of the following formats:

To create a new file:
FILE: path/to/filename.ext
```language
file content...
```

To update an existing file:
UPDATE: path/to/filename.ext
```language
updated file content...
```

Both FILE: and UPDATE: work the same way - they will create the file if it doesn't exist or overwrite it if it does. Use UPDATE: when modifying existing files to make your intent clear."#.to_string()
    }

    fn get_workflow_rules() -> String {
        r#"### INTENT HANDLING RULES:
1. **Direct Chat (STRICT PREFERENCE)**: Always prefer a direct chat response. For simple questions, research lookups, or one-off tasks, respond directly in chat. NEVER suggest or design a workflow for something that can be answered or executed in the current turn.
2. **Workflow Design (RARE EXCEPTION)**: Suggest a workflow ONLY for highly complex, multi-step sequences that require long-running automation or repeatable multi-day project structures.

To formally design a workflow, use the <SAVE_WORKFLOW> tag with a JSON definition. Stop after outputting the tag to allow user review."#.to_string()
    }
}
