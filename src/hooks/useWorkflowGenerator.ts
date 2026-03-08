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
            const installedContext = installedSkills.map(s => `- "${s.name}" (ID: ${s.id})`).join('\n');

            const systemPrompt = `You are an expert Workflow Architect for an AI agent system. 
Your goal is to interpret a user's natural language request and design a multi-step workflow.

Available capabilities in the Registry (you can prescribe these):
${registryContext}

Currently Installed Skills (use EXACT names in skill_name_ref):
${installedContext}

User Request: "${prompt}"
User Desired Output Filename: "${outputTarget || 'Decide automatically'}"

Instructions:
1. Analyze the request to determine the necessary steps. Prefer MORE steps over fewer to cover the full scope of the request.
2. For each step, check the "Currently Installed Skills" list first. ALWAYS prefer an installed skill over a registry skill.
3. CRITICAL: The value of "skill_name_ref" MUST be the EXACT string from the "Currently Installed Skills" list above (e.g., "${installedSkills[0]?.name || 'My Skill'}"). The system uses exact string matching - any deviation will break the workflow.
4. If NO installed skill is suitable, pick the closest installed skill AND add a note in the step "description". Never leave a step without a valid skill.
5. If a registry skill is needed, or if you know of a valid \`npx\` command for a relevant skill, include its "command" in "skills_to_install".
6. Create a sequential or parallel flow covering ALL phases of the request.
7. CRITICAL: If the request involves repeating a task for multiple items (e.g., "Analyze these 5 competitors", "Summarize each file"), use a "SubAgent" step.
    - Set "step_type": "SubAgent"
    - Set "items_source": A JSON array of items OR a reference to a previous step's output using "{{steps.STEP_ID.output}}".
    - Set "parallel": true for concurrent execution.
8. IMPORTANT: Generate meaningful filenames for "output_file".
9. IMPORTANT: Wire up inputs and outputs. If a step depends on previous steps, add their "output_file"s into this step's "input_files" array.
10. IMPORTANT: If the skill uses parameters (like {{topic}}, {{research_focus}}), fill them out in the "parameters" object based on the User Request. Use {{item}} in parameters if the step is a SubAgent/Iteration to refer to the current item being processed.
11. If "User Desired Output Filename" is provided, ensure the FINAL step writes to that exact file path. Do NOT use subdirectories.

Output strictly valid JSON with this structure:
{
  "workflow_name": "Short Descriptive Name",
  "description": "Brief description of what this workflow does",
  "skills_to_install": [
    { "name": "Skill Name", "command": "npx command..." } 
  ],
  "steps": [
    {
      "id": "step1",
      "name": "Step Name",
      "step_type": "agent", // OR "SubAgent" for parallel tasks sharing the same skill
      "skill_name_ref": "EXACT name from Currently Installed Skills list",
      "parallel": true, // Set to true if this step should run in parallel with siblings or if it's a SubAgent
      "items_source": "{{steps.step0.output}}", // ONLY for SubAgent: source list
      "parameters": {
         "research_focus": "Extracted from request",
         "task_description": "Extracted from request"
      },
      "input_files": ["previous_step_output.md"],
      "output_file": "descriptive_filename.md",
      "depends_on": ["step0"], // Explicitly list dependency IDs
      "description": "What this step does",
      "artifact_type": "one of: insight, evidence, decision, requirement, metric_definition, experiment, poc_brief, initiative (OPTIONAL)",
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
            const idMap: Record<string, string> = {}; // Map AI IDs to our generated IDs

            // Pre-generate IDs to resolve dependencies
            plan.steps.forEach((s: any, i: number) => {
                const aiId = s.id || `step${i + 1}`;
                idMap[aiId] = `step_${Date.now()}_${i}`;
            });

            for (let i = 0; i < plan.steps.length; i++) {
                const planStep = plan.steps[i];
                const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

                let matchedSkill = updatedSkills.find(s => s.name === planStep.skill_name_ref)
                    || updatedSkills.find(s => normalise(s.name) === normalise(planStep.skill_name_ref))
                    || updatedSkills.find(s => normalise(s.name).includes(normalise(planStep.skill_name_ref)))
                    || updatedSkills.find(s => normalise(planStep.skill_name_ref).includes(normalise(s.name)));

                if (!matchedSkill) matchedSkill = updatedSkills[0];
                if (!matchedSkill) throw new Error(`No skills available for step "${planStep.name}".`);

                const stepId = idMap[planStep.id || `step${i + 1}`];

                // Use explicit dependencies from AI if provided, otherwise fallback to sequential
                let dependsOn: string[] = [];
                if (planStep.depends_on && Array.isArray(planStep.depends_on)) {
                    dependsOn = planStep.depends_on.map((d: string) => idMap[d]).filter(Boolean);
                } else if (i > 0) {
                    dependsOn = [newSteps[i - 1].id];
                }

                // Resolve steps references in items_source if any
                let itemsSource = planStep.items_source;
                if (itemsSource && typeof itemsSource === 'string') {
                    Object.entries(idMap).forEach(([aiId, realId]) => {
                        itemsSource = itemsSource.replace(new RegExp(`steps\\.${aiId}\\.output`, 'g'), `steps.${realId}.output`);
                    });
                }

                const safeName = (planStep.name || 'Step').toLowerCase().replace(/[^a-z0-9]/g, '_');
                const outputFile = planStep.output_file || `${safeName}_output.md`;

                // Normalize step_type to match backend's lowercase serde expectation.
                // AI may return "SubAgent" or "api_call"; backend expects "subagent" / "apicall".
                const rawType: string = planStep.step_type || 'agent';
                const normalizedType = rawType === 'SubAgent' ? 'subagent'
                    : rawType === 'api_call' ? 'apicall'
                    : rawType.toLowerCase();

                newSteps.push({
                    id: stepId,
                    name: planStep.name || 'Unnamed Step',
                    step_type: normalizedType as any,
                    config: {
                        skill_id: matchedSkill.id,
                        parameters: planStep.parameters || {},
                        input_files: planStep.input_files || null,
                        output_file: outputFile,
                        artifact_type: planStep.artifact_type,
                        artifact_title: planStep.artifact_title,
                        parallel: planStep.parallel === true,
                        items_source: itemsSource
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
