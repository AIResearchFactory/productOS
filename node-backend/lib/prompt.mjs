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
3. **Artifact Awareness**: You will be provided with previews of both. When referencing a file, be aware of whether it is a First-Class Artifact or a Research resource.
4. **Workspace Authorization**: The "Project Directory" provided below is your authorized workspace. You are permitted to read and write files within this directory, even if it is outside your initial environment. If you have tools to search or read files, use this directory as your root.`;
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
    let prompt = "You are a specialized AI product assistant, designed to help Product Managers research, create new content (PRDs, Roadmaps, User Stories), analyze data, and accelerate their workflow. Your goal is to be a force multiplier for product development teams.\n\n";
    
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
      
      const pSettings = project.settings || {};
      const hasWritingStyle = Boolean(pSettings.personalization_rules?.trim());
      const hasAvoidedKeywords = Array.isArray(pSettings.avoided_keywords) && pSettings.avoided_keywords.length > 0;
      const hasDomainKeywords = Array.isArray(pSettings.domain_keywords) && pSettings.domain_keywords.length > 0;
      const hasBrandDesign = Boolean(pSettings.brand_settings?.trim());

      prompt += `\n--- AGENT CONTEXT STEERING ---\n`;
      prompt += `Upon initialization, note that project-specific rules, style policies, template hierarchies, and reference keywords are defined in \`.metadata/_context/index.md\`.\n`;
      let stepNum = 1;
      if (hasWritingStyle) {
        prompt += `${stepNum++}. Follow writing style rules from \`.metadata/_context/rules/writing-style.md\` for all copy.\n`;
      }
      prompt += `${stepNum++}. Check file sidecar metadata (\`.metadata/{filename}.json\`) for summaries, tags, and confidence scores when inspecting project files.\n`;
      prompt += `${stepNum++}. Before drafting an artifact (PRD, Roadmap, User Story), check for custom templates in \`.templates/\` and review \`.metadata/_context/templates/guiding-questions.md\` to ask clarifying questions (covering target personas, Jobs-to-be-Done, and Non-Functional Requirements: performance, telemetry, security, accessibility).\n`;
      if (hasAvoidedKeywords) {
        prompt += `${stepNum++}. Strictly avoid forbidden terms specified in \`.metadata/_context/references/avoided-terms.md\`.\n`;
      }
      if (hasDomainKeywords) {
        prompt += `${stepNum++}. Prefer domain terminology specified in \`.metadata/_context/references/keywords.md\`.\n`;
      }
      if (hasBrandDesign) {
        prompt += `${stepNum++}. Apply brand design guidelines specified in \`.metadata/_context/rules/brand-design.md\` for presentations and visual layouts.\n`;
      }
      prompt += `-------------------------------\n`;

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
