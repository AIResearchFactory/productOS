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
            const installedContext = installedSkills.map(s => {
                const paramNames = s.parameters?.map(p => p.name).join(', ');
                return `- "${s.name}" (ID: ${s.id}): ${s.description || ''}${paramNames ? ` [params: ${paramNames}]` : ''}`;
            }).join('\n');

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
2. SKILL MATCHING BY PURPOSE (CRITICAL): For EACH step, read the description of EVERY installed skill and pick the one whose description best matches that step's specific purpose. NEVER default to the first skill in the list. Examples of correct matching:
   - A step analyzing competitors → use a skill with "competitor" or "competitive" in its name/description
   - A step summarizing findings → use a skill with "synthesis" or "summary" in its description
   - A step processing data → use the most domain-specific skill available
3. CRITICAL: The value of "skill_name_ref" MUST be the EXACT string from the "Currently Installed Skills" list above (e.g., "<SkillName>"). The system uses exact string matching - any deviation will break the workflow.
4. If NO installed skill is suitable, pick the closest installed skill AND add a note in the step "description". Never leave a step without a valid skill.
5. If a registry skill is needed, or if you know of a valid \`npx\` command for a relevant skill, include its "command" in "skills_to_install".
6. PARALLEL EXECUTION: Design the dependency graph to maximize parallelism. Steps that are INDEPENDENT of each other (can run at the same time) MUST have the same "depends_on" entries and must NOT depend on each other. The execution engine runs all steps that have their dependencies satisfied at the same time. Example: if steps B, C, D all depend on A but not on each other, set depends_on: ["A"] for B, C, and D — they will run in parallel automatically.
7. INPUT STEPS: If a step only needs to read a file (no AI processing needed), use "step_type": "input" with "source_type": "ProjectFile" and "source_value": "<path>". Do NOT assign a skill to input steps — omit "skill_name_ref" entirely.
8. CRITICAL: If a step processes multiple items (e.g., "analyze each competitor", "summarize each file"), use a SINGLE "SubAgent" step instead of creating one step per item.
    - Set "step_type": "SubAgent"
    - Set "items_source": A JSON array of known items OR "{{steps.PREV_STEP_ID.output}}" to iterate over a previous step's output list dynamically.
    - Set "parallel": true for concurrent execution.
    - Use {{item}} inside parameters to reference the current item being processed.
9. IMPORTANT: Generate meaningful filenames for "output_file".
10. IMPORTANT: Wire up inputs and outputs. Every step that has entries in "depends_on" MUST list those steps' "output_file" paths in its own "input_files" array.
11. PARAMETERS: Each skill shows its accepted parameters in the "[params: ...]" section of the installed skills list above.
    - ONLY use parameter keys that appear in that list for the chosen skill.
    - If the skill shows no "[params: ...]", use an empty object: "parameters": {}
    - NEVER invent parameter names — any key not in the skill's template is silently ignored, meaning the task description will never be injected and the skill will fail.
12. If "User Desired Output Filename" is provided, ensure the FINAL step writes to that exact file path. Do NOT use subdirectories.

Output strictly valid JSON with this structure:
{
  "workflow_name": "Short Descriptive Name",
  "description": "Brief description of what this workflow does",
  "skills_to_install": [
    { "name": "Skill Name", "command": "npx command..." } 
  ],
  "steps": [
    {
      "id": "step0",
      "name": "Read Input File",
      "step_type": "input",
      "source_type": "ProjectFile",
      "source_value": "{{input_file}}",
      "output_file": "data/parsed_input.md",
      "depends_on": []
    },
    {
      "id": "step1",
      "name": "Step Name",
      "step_type": "agent",
      "skill_name_ref": "EXACT name from Currently Installed Skills list",
      "parallel": false,
      "items_source": "{{steps.step0.output}}",
      "parameters": {},
      "input_files": ["data/parsed_input.md"],
      "output_file": "descriptive_filename.md",
      "depends_on": ["step0"],
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

            const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

            for (let i = 0; i < plan.steps.length; i++) {
                const planStep = plan.steps[i];
                const isInputStep = (planStep.step_type || '').toLowerCase() === 'input';

                let matchedSkill = isInputStep ? null
                    : updatedSkills.find(s => s.name === planStep.skill_name_ref)
                    || updatedSkills.find(s => normalise(s.name) === normalise(planStep.skill_name_ref))
                    || updatedSkills.find(s => normalise(s.name).includes(normalise(planStep.skill_name_ref)))
                    || updatedSkills.find(s => normalise(planStep.skill_name_ref).includes(normalise(s.name)));

                if (!isInputStep && !matchedSkill) matchedSkill = updatedSkills[0];
                if (!isInputStep && !matchedSkill) throw new Error(`No skills available for step "${planStep.name}".`);

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
                        ...(matchedSkill ? { skill_id: matchedSkill.id } : {}),
                        parameters: planStep.parameters || {},
                        input_files: planStep.input_files || null,
                        output_file: outputFile,
                        source_type: planStep.source_type || null,
                        source_value: planStep.source_value || null,
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
