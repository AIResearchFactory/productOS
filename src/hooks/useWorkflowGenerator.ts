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
            const registrySkills = SKILL_REGISTRY;
            
            // Prefer project-created skills over imported/downloaded skills.
            const isImportedSkill = (s: Skill) => (s.capabilities || []).some(c => c.toLowerCase() === 'imported');
            const preferredInstalledSkills = [
                ...installedSkills.filter(s => !isImportedSkill(s)),
                ...installedSkills.filter(s => isImportedSkill(s)),
            ];

            const installedContext = preferredInstalledSkills.map(s => {
                const desc = (s as any).description ? ` — ${(s as any).description}` : '';
                const params = s.parameters && s.parameters.length > 0 
                    ? ` [params: ${s.parameters.map(p => p.name).join(', ')}]` 
                    : '';
                return `- "${s.name}" (ID: ${s.id})${desc}${params}`;
            }).join('\n');

            const registryContext = registrySkills.map(s => `- "${s.name}" (Import: ${s.command})${s.description ? ` — ${s.description}` : ''}`).join('\n');

            const systemPrompt = `You are an expert AI Solution Architect specializing in agentic workflows.
Your goal is to decompose a user request into a robust, multi-step workflow.

Currently Installed Skills:
${installedContext}

Available Skills to Import (Registry):
${registryContext}

ARCHITECTURE RULES:
1. Every workflow SHOULD start with an "input" step if it needs to read a file or take initial user input.
2. For each step, check the "Currently Installed Skills" list first. ALWAYS prefer an installed skill over a registry skill.
3. If no installed skill matches, you can suggest a registry skill by its EXACT name.
4. SKILL SELECTION PRIORITY: 
   - (a) "researcher" or "web-researcher" for any research, analysis, or data gathering tasks.
   - (b) "data-analyst" or "csv-analysis" for data processing.
   - (c) "format-data" ONLY for structural formatting (e.g. converting to Jira/Aha JSON), NEVER for research or general analysis.
5. DECOUPLE TASKS: Ensure each step has a clear, single responsibility. 
6. PARALLELISM: Use "parallel": true for steps that can run concurrently (no data dependency on siblings). If multiple steps depend on the same parent, they should usually be parallel.
7. SUB-AGENTS (ITERATION): If the request involves repeating a task for multiple items (e.g., "Analyze EACH competitor", "Summarize ALL files"), you MUST use a "SubAgent" step.
   - Set "items_source": "path/to/items.json" or "{{steps.STEP_ID.output}}"
   - Set "output_pattern": "results/{item}-analysis.md"
   - SubAgents always use "parallel": true for maximum efficiency.
8. PARAMETERS: ONLY use parameter keys that appear in the "[params: ...]" section for the chosen skill.
   - NEVER invent parameter names. If a skill has "input_content", use it; never use "task" or "text" instead.
   - If a skill shows no "[params: ...]", use an empty object.
9. CONCURRENT BRANCHING: If multiple analysis dimensions are requested (e.g. "Analyze pricing AND features AND support"), create separate SubAgent steps that all depend on the same parent step to run them concurrently. These steps MUST have "parallel": true.

Output strictly valid JSON with this structure:
{
  "workflow_name": "Descriptive Workflow Name",
  "description": "Brief description",
  "skills_to_install": [],
  "steps": [
    {
      "id": "input0",
      "name": "Read Input File",
      "step_type": "input",
      "source_type": "ProjectFile",
      "source_value": "{{input_file}}",
      "output_file": "inputs/data.json",
      "depends_on": []
    },
    {
      "id": "analysis",
      "name": "Parallel Analysis",
      "step_type": "SubAgent",
      "skill_name_ref": "Researcher",
      "parallel": true,
      "items_source": "{{steps.input0.output}}",
      "output_pattern": "analysis/{item}.md",
      "parameters": {
        "focus_area": "Strategy"
      },
      "depends_on": ["input0"]
    },
    {
      "id": "synthesis",
      "name": "Final Summary",
      "step_type": "synthesis",
      "skill_name_ref": "Data Analyst",
      "parallel": false,
      "input_files": ["analysis/*.md"],
      "output_file": "${outputTarget || 'final_report.md'}",
      "depends_on": ["analysis"]
    }
  ]
}

User Request: "${prompt}"`;

            // 2. Call AI
            const response = await tauriApi.sendMessage([
                { role: 'user', content: systemPrompt }
            ]);

            let responseContent = response.content.trim();

            // 2.1 More robust JSON extraction
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
                throw new Error("AI Agent returned an incomplete workflow plan.");
            }

            if (plan.skills_to_install && plan.skills_to_install.length > 0) {
                for (const skillToInstall of plan.skills_to_install) {
                    setStatus(`Installing skill: ${skillToInstall.name}...`);
                    if (!installedSkills.some(s => s.name === skillToInstall.name)) {
                        try {
                            await tauriApi.importSkill(skillToInstall.command);
                        } catch (err) {
                            console.warn(`Failed to install ${skillToInstall.name}`, err);
                        }
                    }
                }
            }

            setStatus('Finalizing workflow...');
            const updatedSkills = await tauriApi.getAllSkills();
            const preferredUpdatedSkills = [
                ...updatedSkills.filter(s => !isImportedSkill(s)),
                ...updatedSkills.filter(s => isImportedSkill(s)),
            ];

            // 4. Construct Workflow Steps
            const newSteps: WorkflowStep[] = [];
            const idMap: Record<string, string> = {};

            // Pre-generate IDs to resolve dependencies
            plan.steps.forEach((s: any, i: number) => {
                const aiId = s.id || `step${i}`;
                idMap[aiId] = `step_${Date.now()}_${i}`;
            });

            const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

            // First pass: build depends_on map to detect siblings
            const parentMap: Record<string, string[]> = {};
            plan.steps.forEach((step: any) => {
                const deps = (step.depends_on || []).sort().join(',');
                if (deps) {
                    if (!parentMap[deps]) parentMap[deps] = [];
                    parentMap[deps].push(step.id);
                }
            });

            for (let i = 0; i < plan.steps.length; i++) {
                const planStep = plan.steps[i];
                const rawType: string = planStep.step_type || 'agent';
                let normalizedType = rawType.toLowerCase() === 'subagent' || rawType.toLowerCase() === 'iteration' ? 'SubAgent'
                    : rawType.toLowerCase() === 'api_call' ? 'api_call'
                        : rawType.toLowerCase() === 'input' ? 'input'
                            : rawType.toLowerCase();

                // Heuristic: If step name contains "Read", "Load", "Input" and has relevant params, force to "input"
                const hasFileParam = planStep.parameters && Object.keys(planStep.parameters).some(key => 
                    key.toLowerCase().endsWith('_file') || 
                    (typeof planStep.parameters[key] === 'string' && (planStep.parameters[key] as string).includes('{{'))
                );

                if (normalizedType === 'agent' && (planStep.source_type || planStep.source_value || hasFileParam)) {
                    const name = (planStep.name || '').toLowerCase();
                    if (name.includes('read') || name.includes('load') || name.includes('input')) {
                        normalizedType = 'input';
                    }
                }

                const isInputStep = normalizedType === 'input';

                let matchedSkill = isInputStep ? null
                    : preferredUpdatedSkills.find(s => s.name === planStep.skill_name_ref)
                    || preferredUpdatedSkills.find(s => planStep.skill_name_ref && normalise(s.name) === normalise(planStep.skill_name_ref))
                    || preferredUpdatedSkills.find(s => planStep.skill_name_ref && normalise(s.name).includes(normalise(planStep.skill_name_ref)))
                    || preferredUpdatedSkills.find(s => planStep.skill_name_ref && normalise(planStep.skill_name_ref).includes(normalise(s.name)));

                if (!matchedSkill && !isInputStep && preferredUpdatedSkills.length > 0) {
                    // Score each skill
                    const stepText = normalise(`${planStep.name} ${planStep.description || ''}`);
                    let bestScore = -1;
                    for (const s of preferredUpdatedSkills) {
                        const skillText = normalise(`${s.name} ${(s as any).description || ''}`);
                        const words = stepText.split(/\s+/).filter((w: string) => w.length > 2);
                        const score = words.filter((w: string) => skillText.includes(w)).length;
                        if (score > bestScore) {
                            bestScore = score;
                            matchedSkill = s;
                        }
                    }
                    if (!matchedSkill) matchedSkill = preferredUpdatedSkills[0];
                }

                const stepId = idMap[planStep.id || `step${i}`];
                let dependsOn: string[] = [];
                if (planStep.depends_on && Array.isArray(planStep.depends_on)) {
                    dependsOn = planStep.depends_on.map((d: string) => idMap[d]).filter(Boolean);
                } else if (i > 0) {
                    dependsOn = [newSteps[i - 1].id];
                }

                let itemsSource = planStep.items_source;
                if (itemsSource && typeof itemsSource === 'string') {
                    Object.entries(idMap).forEach(([aiId, realId]) => {
                        itemsSource = itemsSource.replace(new RegExp(`steps\\.${aiId}\\.output`, 'g'), `steps.${realId}.output`);
                    });
                }

                // Sibling Detection logic
                const depsKey = (planStep.depends_on || []).sort().join(',');
                const isSibling = depsKey && parentMap[depsKey] && parentMap[depsKey].length > 1;

                const isParallel = planStep.parallel === true || normalizedType === 'SubAgent' || (isSibling && planStep.parallel !== false);

                newSteps.push({
                    id: stepId,
                    name: planStep.name || 'Unnamed Step',
                    step_type: normalizedType as any,
                    config: {
                        ...(matchedSkill ? { skill_id: matchedSkill.id } : {}),
                        parameters: planStep.parameters || {},
                        input_files: planStep.input_files || null,
                        output_file: planStep.output_file || `${stepId}_output.md`,
                        source_type: planStep.source_type || 'ProjectFile',
                        source_value: planStep.source_value || (() => {
                            const fileParam = planStep.parameters && Object.keys(planStep.parameters).find(key => 
                                key.toLowerCase().endsWith('_file') || 
                                (typeof planStep.parameters[key] === 'string' && (planStep.parameters[key] as string).includes('{{'))
                            );
                            return fileParam ? (planStep.parameters[fileParam].includes('{{') ? planStep.parameters[fileParam] : `{{${fileParam}}}`) : null;
                        })(),
                        artifact_type: planStep.artifact_type,
                        artifact_title: planStep.artifact_title,
                        parallel: isParallel,
                        items_source: itemsSource,
                        output_pattern: planStep.output_pattern || null
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
