use crate::models::ai::{ChatResponse, Message, ProviderType};
use crate::services::agent_orchestrator::AgentOrchestrator;
use crate::services::ai_service::AIService;
use crate::services::project_service::ProjectService;
use crate::services::settings_service::SettingsService;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn send_message(
    _ai_service: State<'_, Arc<AIService>>,
    orchestrator: State<'_, Arc<AgentOrchestrator>>,
    messages: Vec<Message>,
    project_id: Option<String>,
    skill_id: Option<String>,
    skill_params: Option<HashMap<String, String>>,
) -> Result<ChatResponse, String> {
    // 1. Context Construction (Hoisted from God Method)
    let system_prompt = build_system_prompt(&project_id);

    // 2. Delegate to Orchestrator (Streaming version)
    orchestrator
        .run_agent_loop_stream(
            messages,
            Some(system_prompt),
            project_id,
            skill_id,
            skill_params,
        )
        .await
        .map_err(|e| e.to_string())
}

/// Helper to build the system prompt based on project context
fn build_system_prompt(project_id: &Option<String>) -> String {
    let mut prompt = String::from("You are a helpful AI research assistant.

You can create or update files in the project by using one of the following formats:

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

Both FILE: and UPDATE: work the same way - they will create the file if it doesn't exist or overwrite it if it does. Use UPDATE: when modifying existing files to make your intent clear.

If you generate significant insights, summaries, or code, please proactively offer to save them to a file for the user.

### INTENT HANDLING RULES:
1. **Direct Chat (STRICT PREFERENCE)**: Always prefer a direct chat response. For simple questions, research lookups, or one-off tasks, respond directly in chat. NEVER suggest or design a workflow for something that can be answered or executed in the current turn.
2. **Workflow Design (RARE EXCEPTION)**: Suggest a workflow ONLY for highly complex, multi-step sequences that require long-running automation or repeatable multi-day project structures. Do not suggest workflows for common research requests.

To formally design a workflow that can be executed or scheduled in the application, use the following xml tag:
<SAVE_WORKFLOW>
{
  \"id\": \"unique-slug-id\",
  \"name\": \"Descriptive Name\",
  \"description\": \"What it does\",
  \"project_id\": \"current_project_id\",
  \"steps\": [
    {
      \"id\": \"step1\",
      \"name\": \"Gather Info\",
      \"step_type\": \"agent\",
      \"config\": {
        \"skill_id\": \"research-assistant\",
        \"parameters\": { \"topic\": \"{{topic}}\" },
        \"output_file\": \"research.md\"
      },
      \"depends_on\": []
    }
  ],
  \"version\": \"1.0.0\",
  \"created\": \"Date time when it was created\",
  \"updated\": \"Date time when it was updated\",
  \"status\": \"Draft\",
  \"last_run\": \"Date time when it was last run\"
}
</SAVE_WORKFLOW>
CRITICAL WORKFLOW CREATION RULES — read carefully before designing any workflow:

1. NEVER execute the workflow yourself. The <SAVE_WORKFLOW> JSON is parsed and managed entirely by the application's workflow engine module. Your role is to design and present it; the application saves and runs it.

2. APPROVAL FIRST: After outputting a <SAVE_WORKFLOW> block, STOP. The application will present it as an approval card for the user to review. Do NOT include a <SUGGEST_WORKFLOW> tag in the same response — the user will be offered a run button automatically once they approve.

3. DYNAMIC FILE INPUTS: If the user references a file (e.g. competitors.md, input.csv), treat it as a dynamic workflow parameter — do NOT open, read, or expand its contents into individual steps. Reference it as a parameter like {{input_file}} so the workflow can be re-run with different files at any time.

4. PARALLEL vs SEQUENTIAL STEPS:
   - Steps that do not depend on the output of another step should have empty depends_on: [] — the engine will run these concurrently.
   - Steps that require the output of a previous step must list its id in depends_on — the engine will run them after their dependencies complete.
   - Think carefully: research/fetch steps with independent topics can run in parallel; summarisation or aggregation steps that need prior results run sequentially.

5. PARAMETERS over hardcoded values: Use template parameters like {{topic}}, {{input_file}}, {{output_format}} rather than hardcoding values. This makes the workflow reusable.

You can suggest running an existing workflow by using:
<SUGGEST_WORKFLOW>
{
  \"project_id\": \"current_project_id\",
  \"workflow_id\": \"workflow_id\",
  \"parameters\": {
    \"param1\": \"value1\"
  }
}
</SUGGEST_WORKFLOW>
Only use <SUGGEST_WORKFLOW> for workflows that already exist in the project. Never suggest running a workflow in the same response where you are creating it — the user will be prompted to run it after they approve the workflow creation.");

    if let Some(pid) = project_id {
        if let Ok(project) = ProjectService::load_project_by_id(pid) {
            prompt.push_str(&format!(
                "\n\nYou are working on the project: {}\nProject Goal: {}\n",
                project.name, project.goal
            ));

            if !project.skills.is_empty() {
                prompt.push_str("\nAvailable Skills in this project:\n");
                for skill in &project.skills {
                    prompt.push_str(&format!("- {}\n", skill));
                }
            }

            if let Ok(projects_path) = SettingsService::get_projects_path() {
                let project_path = projects_path.join(pid);
                if let Ok(Some(settings)) = SettingsService::load_project_settings(&project_path) {
                    if let Some(rules) = settings.personalization_rules {
                        if !rules.is_empty() {
                            prompt.push_str("\n\n=== PROJECT PERSONALIZATION RULES ===\n");
                            prompt.push_str("Follow these writing rules and guidelines when generating content for this project:\n");
                            prompt.push_str(&rules);
                            prompt.push_str("\n=====================================\n");
                        }
                    }
                }
            }
        }

        if let Ok(files) = ProjectService::list_project_files(pid) {
            if !files.is_empty() {
                prompt.push_str("\nThe project contains the following files:\n");
                for file in files {
                    prompt.push_str(&format!("- {}\n", file));
                }
            }
        }
    }
    prompt
}

#[tauri::command]
pub async fn switch_provider(
    state: State<'_, Arc<AIService>>,
    provider_type: ProviderType,
) -> Result<(), String> {
    state
        .switch_provider(provider_type)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_chat_history(
    project_id: String,
    chat_file: String,
) -> Result<Vec<Message>, String> {
    use crate::services::chat_service::ChatService;
    let old_messages = ChatService::load_chat_from_file(&project_id, &chat_file)
        .await
        .map_err(|e| format!("Failed to load chat history: {}", e))?;

    Ok(old_messages
        .into_iter()
        .map(|m| Message {
            role: m.role,
            content: m.content,
            tool_calls: None,
            tool_results: None,
        })
        .collect())
}

#[tauri::command]
pub async fn get_chat_files(project_id: String) -> Result<Vec<String>, String> {
    use crate::services::chat_service::ChatService;
    ChatService::get_chat_files(&project_id)
        .await
        .map_err(|e| format!("Failed to get chat files: {}", e))
}

#[tauri::command]
pub async fn save_chat(
    project_id: String,
    messages: Vec<Message>,
    model: String,
) -> Result<String, String> {
    use crate::models::chat::ChatMessage;
    use crate::services::chat_service::ChatService;

    let chat_messages = messages
        .into_iter()
        .map(|m| ChatMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    ChatService::save_chat_to_file(&project_id, chat_messages, &model)
        .await
        .map_err(|e| format!("Failed to save chat: {}", e))
}

#[tauri::command]
pub async fn get_ollama_models() -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let res = client
        .get("http://localhost:11434/api/tags")
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    if !res.status().is_success() {
        return Err(format!(
            "Ollama API returned detailed error: {}",
            res.status()
        ));
    }

    let body = res
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let mut models = Vec::new();
    if let Some(models_arr) = json.get("models").and_then(|v| v.as_array()) {
        for model in models_arr {
            if let Some(name) = model.get("name").and_then(|v| v.as_str()) {
                models.push(name.to_string());
            }
        }
    }

    Ok(models)
}
