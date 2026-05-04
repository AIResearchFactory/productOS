import { getProjectContext } from './context.mjs';

export const PromptMode = {
  General: 'General',
  Research: 'Research',
  Workflow: 'Workflow',
  Coding: 'Coding',
  Artifact: 'Artifact',
};

export class PromptService {
  static getFileModificationRules() {
    return `You can create or update files in the project by using one of the following formats:

To create a new file:
FILE: path/to/filename.ext
\`\`\`language
file content...
\`\`\`

To update an existing file:
UPDATE: path/to/filename.ext
\`\`\`language
updated file content...
\`\`\`

Both FILE: and UPDATE: work the same way - they will create the file if it doesn't exist or overwrite it if it does. Use UPDATE: when modifying existing files to make your intent clear.`;
  }

  static getWorkflowRules() {
    return `### INTENT HANDLING RULES:
1. **Direct Chat (STRICT PREFERENCE)**: Always prefer a direct chat response. For simple questions, research lookups, or one-off tasks, respond directly in chat. NEVER suggest or design a workflow for something that can be answered or executed in the current turn.
2. **Workflow Design (RARE EXCEPTION)**: Suggest a workflow ONLY for highly complex, multi-step sequences that require long-running automation or repeatable multi-day project structures.

To formally design a workflow, use the <SAVE_WORKFLOW> tag with a JSON definition. Stop after outputting the tag to allow user review.`;
  }

  static getProjectStructureRules() {
    return `### PROJECT STRUCTURE & ARTIFACT HIERARCHY:
1. **First-Class Artifacts (The "Final Step")**: These are structured, high-quality documents that represent the conclusion of a research phase (e.g., Roadmaps, Product Visions, One-Pagers, User Stories). Treat these as the primary deliverables.
2. **Research & Log Files (The "Building Blocks")**: All other files (notes, raw data, logs, technical validations) are artifacts of the discovery process. They are used to strengthen validations and provide resources for the final first-class artifacts.
3. **Artifact Awareness**: You will be provided with previews of both. When referencing a file, be aware of whether it is a First-Class Artifact or a Research resource.`;
  }

  static getIntegrationRules() {
    return `### EXTERNAL NOTIFICATIONS & INTEGRATIONS:
You have the ability to send notifications to external channels (e.g., Telegram, WhatsApp) if the user has configured them.
To send a notification, use the following format:
NOTIFY: your notification message here

When you use this format, the message will be sent to all enabled external channels automatically. 
IMPORTANT: Always use the NOTIFY: format for EACH notification, one per line. If you need to send multiple notifications, use multiple NOTIFY: lines.
DO NOT try to use shell commands, XML tool tags like <send_telegram_message>, curl, or any other method to send notifications. Only the NOTIFY: prefix works.`;
  }

  static async buildSystemPrompt(project, mode = PromptMode.General, settings = {}) {
    let prompt = "You are a helpful AI research assistant.\n\n";
    
    prompt += this.getFileModificationRules() + "\n\n";
    prompt += this.getWorkflowRules() + "\n\n";
    prompt += this.getProjectStructureRules() + "\n\n";

    if (settings.channelConfig?.enabled && (settings.channelConfig.telegramEnabled || settings.channelConfig.whatsappEnabled)) {
      prompt += this.getIntegrationRules() + "\n\n";
    }

    switch (mode) {
      case PromptMode.Research:
        prompt += "\n### RESEARCH MODE\nFocus on gathering comprehensive information, citing sources, and documenting findings clearly in research_log.md.\n";
        break;
      case PromptMode.Workflow:
        prompt += "\n### WORKFLOW MODE\nFocus on designing or executing structured, multi-step automation. Ensure all steps have clear inputs/outputs and dependencies.\n";
        break;
      case PromptMode.Coding:
        prompt += "\n### CODING MODE\nFocus on writing clean, efficient, and well-documented code. Always verify file paths before applying changes.\n";
        break;
      case PromptMode.Artifact:
        prompt += "\n### ARTIFACT MODE\nFocus on creating high-quality, structured documents or assets. Follow the project's styling and formatting rules strictly.\n";
        break;
    }

    if (project) {
      prompt += `\n\n--- PROJECT: ${project.name} ---\nGoal: ${project.goal || 'Not specified'}\nProject Directory: ${project.path}\n`;
      
      if (project.settings?.personalization_rules) {
        prompt += "\n=== PROJECT PERSONALIZATION RULES ===\n";
        prompt += project.settings.personalization_rules;
        prompt += "\n=====================================\n";
      }

      // Automatic Context Injection (port of Rust ContextService::get_project_context)
      try {
        const projectContext = await getProjectContext(project.id);
        if (projectContext) {
          prompt += "\n\n---\nAUTOMATIC CONTEXT INJECTION (Project Files & History):\n";
          prompt += projectContext;
        }
      } catch (err) {
        console.warn('[PromptService] Failed to inject project context:', err.message);
      }
    }

    return prompt;
  }
}
