import { useState } from 'react';
import { tauriApi, Skill, WorkflowStep } from '@/api/tauri';
import { SKILL_REGISTRY } from '@/data/skills_registry';

export interface WorkflowGenerationResult {
    name: string;
    steps: WorkflowStep[];
}

export function useWorkflowGenerator() {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState<string | null>(null);

    const generateWorkflow = async (prompt: string, outputTarget: string, installedSkills: Skill[]): Promise<WorkflowGenerationResult | null> => {
        if (!prompt.trim()) return null;

        setIsLoading(true);
        setError(null);
        setStatus('Analyzing request...');

        try {
            // 1. Construct prompt for the AI Architect
            const registryContext = SKILL_REGISTRY.map(s => `- ${s.name} (Command: ${s.command}): ${s.description}`).join('\n');
            const installedContext = installedSkills.map(s => `- ${s.name} (ID: ${s.id})`).join('\n');

            const systemPrompt = `You are an expert Workflow Architect for an AI agent system. 
Your goal is to interpret a user's natural language request and design a multi-step workflow.

Available capabilities in the Registry (you can prescribe these):
${registryContext}

Currently Installed Skills:
${installedContext}

User Request: "${prompt}"
User Desired Output Filename: "${outputTarget || 'Decide automatically'}"

Instructions:
1. Analyze the request to determine the necessary steps.
2. For each step, identify if an existing installed skill can be used, or if a new skill from the registry is needed.
3. If a registry skill is needed, or if you know of a valid \`npx\` command for a relevant skill (e.g. from val.town or github), you MUST include its "command" in the response so the system can install it.
4. If the request implies a skill not in the registry and you don't know a command, suggest the closest match or a generic "Research" node using an installed skill.
5. If you need a capability not listed, you can suggest installing a new skill by providing a valid \`npx\` command (e.g., from val.town or github).
6. Create a sequential or parallel flow.
7. IMPORTANT: Generate meaningful filenames for "output_file".
8. If "User Desired Output Filename" is provided, ensure the FINAL step writes to that exact file path. Do NOT use subdirectories.

Output strictly valid JSON with this structure:
{
  "workflow_name": "Short Descriptive Name",
  "description": "Brief description of what this workflow does",
  "skills_to_install": [
    { "name": "Skill Name", "command": "npx command..." } 
  ],
  "steps": [
    {
      "name": "Step Name",
      "step_type": "agent", 
      "skill_name_ref": "Exact name of the skill to use",
      "output_file": "descriptive_filename.md",
      "description": "What this step does",
      "artifact_type": "one of: insight, evidence, decision, requirement, metric_definition, experiment, poc_brief, prd, user_story (OPTIONAL)",
      "artifact_title": "Human readable title for the artifact (OPTIONAL)"
    }
  ]
}
Do not output markdown code blocks, just the raw JSON.`;

            // 2. Call AI
            const response = await tauriApi.sendMessage([
                { role: 'user', content: systemPrompt }
            ]);

            let responseContent = response.content.trim();

            // 2.1 More robust JSON extraction (handles markdown blocks and conversational filler)
            const jsonStartIndex = responseContent.indexOf('{');
            const jsonEndIndex = responseContent.lastIndexOf('}');

            if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex <= jsonStartIndex) {
                console.error("AI Response does not contain a valid JSON object:", responseContent);
                throw new Error("AI Agent returned invalid plan format: No JSON object found.");
            }

            responseContent = responseContent.substring(jsonStartIndex, jsonEndIndex + 1);

            let plan;
            try {
                plan = JSON.parse(responseContent);
            } catch (e) {
                console.error("Failed to parse AI response. Content:", responseContent, "Error:", e);
                throw new Error("AI Agent returned invalid plan format: Failed to parse JSON.");
            }

            // 3. Install missing skills
            if (!plan || !Array.isArray(plan.steps)) {
                console.error("AI response is missing steps or invalid:", plan);
                throw new Error("AI Agent returned an incomplete workflow plan (missing steps).");
            }

            if (plan.skills_to_install && plan.skills_to_install.length > 0) {
                for (const skillToInstall of plan.skills_to_install) {
                    setStatus(`Installing skill: ${skillToInstall.name}...`);

                    // Check if already installed to avoid redundant work
                    const isBuiltin = skillToInstall.command === 'builtin:pm-skill';
                    if (!isBuiltin && !installedSkills.some(s => s.name === skillToInstall.name)) {
                        try {
                            await tauriApi.importSkill(skillToInstall.command);
                        } catch (err) {
                            console.warn(`Failed to install ${skillToInstall.name}, seeing if we can proceed...`, err);
                            // We continue, hoping maybe it exists or user can fix it later
                        }
                    }
                }
            }

            setStatus('Finalizing workflow...');

            // Refresh skills list to get IDs of newly installed skills
            const updatedSkills = await tauriApi.getAllSkills();

            // 4. Construct Workflow Steps
            const newSteps: WorkflowStep[] = [];

            for (let i = 0; i < plan.steps.length; i++) {
                const planStep = plan.steps[i];
                let matchedSkill = updatedSkills.find(s => s.name === planStep.skill_name_ref)
                    || updatedSkills.find(s => s.name.includes(planStep.skill_name_ref));

                // Final fallback: try partial match or use the first available skill if any
                if (!matchedSkill) {
                    matchedSkill = updatedSkills[0];
                }

                if (!matchedSkill) {
                    console.error('No skills available in the system.');
                    throw new Error(`Failed to find a valid skill for step "${planStep.name}". Please ensure at least one skill is installed.`);
                }

                const stepId = `step_${Date.now()}_${i}`;

                // Simple sequential dependency
                const dependsOn = i > 0 ? [newSteps[i - 1].id] : [];

                const safeName = planStep.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                const outputFile = planStep.output_file || `${safeName}_output.md`;

                newSteps.push({
                    id: stepId,
                    name: planStep.name || 'Unnamed Step',
                    step_type: 'agent',
                    config: {
                        skill_id: matchedSkill.id,
                        parameters: {},
                        output_file: outputFile,
                        artifact_type: planStep.artifact_type,
                        artifact_title: planStep.artifact_title
                    },
                    depends_on: dependsOn
                });
            }

            return {
                name: plan.workflow_name || 'Generated Workflow',
                steps: newSteps
            };

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to generate workflow');
            return null;
        } finally {
            setIsLoading(false);
            setStatus('');
        }
    };

    return { generateWorkflow, isLoading, status, error };
}
