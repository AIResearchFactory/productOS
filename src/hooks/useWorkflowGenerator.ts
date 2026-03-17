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

    const generateWorkflow = async (prompt: string, _outputTarget: string, installedSkills: Skill[]): Promise<WorkflowGenerationResult | null> => {
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
5. DECOUPLE TASKS: Break large tasks into smaller, focused steps (e.g. separate "Pricing Analysis" from "Feature Analysis").
6. PARALLELISM: Use "parallel": true for steps that can run concurrently. If multiple steps depend on the same parent, they should be parallel.
7. SUB-AGENTS (ITERATION): If the request involves repeating a task for multiple items (e.g., "Analyze EACH competitor"), you MUST use a "SubAgent" step.
   - Set "items_source": "{{steps.STEP_ID.output}}"
   - Set "output_pattern": "results/{item}-analysis.md"
   - SubAgents MUST always use "parallel": true.
   - Set "context": "fork" to provide history from the chat to the sub-agent.
8. PARAMETERS: ONLY use parameter keys that appear in the "[params: ...]" section for the chosen skill.
9. CONCURRENT BRANCHING: Create separate steps for different analysis dimensions (Pricing, Features, Support) to run them concurrently if they depend on the same input.
10. GENERIC DESIGN: Use generic parameter names (like {{input_file}}) unless the user specifies a particular variable.

Example Workflow Structure (8 Steps):
{
  "workflow_name": "High-Concurrency Market Research",
  "description": "Deep dive into competitors with parallel dimensions",
  "steps": [
    { "id": "read_list", "name": "Read Competitors", "step_type": "input", "source_type": "ProjectFile", "source_value": "{{input_file}}", "depends_on": [] },
    { "id": "pricing", "name": "Pricing Analysis", "step_type": "SubAgent", "skill_name_ref": "Researcher", "parallel": true, "items_source": "{{steps.read_list.output}}", "output_pattern": "analysis/{item}/pricing.md", "parameters": { "focus": "pricing" }, "depends_on": ["read_list"] },
    { "id": "features", "name": "Feature Analysis", "step_type": "SubAgent", "skill_name_ref": "Researcher", "parallel": true, "items_source": "{{steps.read_list.output}}", "output_pattern": "analysis/{item}/features.md", "parameters": { "focus": "features" }, "depends_on": ["read_list"] },
    { "id": "support", "name": "Support Matrix", "step_type": "SubAgent", "skill_name_ref": "Researcher", "parallel": true, "items_source": "{{steps.read_list.output}}", "output_pattern": "analysis/{item}/support.md", "parameters": { "focus": "support" }, "depends_on": ["read_list"] },
    { "id": "sentiment", "name": "User Sentiment", "step_type": "SubAgent", "skill_name_ref": "Researcher", "parallel": true, "items_source": "{{steps.read_list.output}}", "output_pattern": "analysis/{item}/sentiment.md", "parameters": { "focus": "reviews" }, "depends_on": ["read_list"] },
    { "id": "swot", "name": "Per-Competitor SWOT", "step_type": "SubAgent", "skill_name_ref": "Researcher", "parallel": true, "items_source": "{{steps.read_list.output}}", "output_pattern": "analysis/{item}/swot.md", "parameters": { "focus": "swot" }, "depends_on": ["pricing", "features", "support"] },
    { "id": "summarize", "name": "Executive Summary", "step_type": "synthesis", "skill_name_ref": "Data Analyst", "input_files": ["analysis/*/swot.md"], "output_file": "market_summary.md", "depends_on": ["swot"] }
  ]
}

JSON VALIDITY RULES:
1. You MUST return ONLY the JSON object. Do not include any preamble, introduction, thinking blocks, or closing remarks.
2. Use EXCLUSIVELY double-quotes (") for all property names and string values.
3. NEVER use backticks (\`) or single-quotes (') for string values.
4. DO NOT include trailing commas in objects or arrays.
5. Your total response MUST start with '{' and end with '}'.

User Request: "${prompt}"`;

            // 2. Call AI
            const response = await tauriApi.sendMessage([
                { role: 'user', content: systemPrompt }
            ]);

            let responseContent = response.content.trim();

            // 2.1 More robust JSON extraction: Strip known noise tags (thinking blocks, CLI artifacts)
            // and markdown code fences that might contain braces and confuse the parser.
            const cleanedContent = responseContent
                .replace(/<(thought|thinking|reasoning|reflection|scratchpad|planning)>[\s\S]*?<\/\1>/gi, '')
                .replace(/---output---/g, '')
                .replace(/```(?:json)?/gi, '') // Strip markdown code fences
                .replace(/```/g, '')
                .trim();

            // 2.1 Robust JSON Extraction: Find the start and end of the JSON block.
            // We search for the first '{' and the last '}' across the response.
            // If the response is wrapped in tags or text, we isolate the JSON safely.
            const findJsonBoundaries = (text: string) => {
                const start = text.indexOf('{');
                const end = text.lastIndexOf('}');
                if (start === -1 || end === -1 || end < start) return null;
                return { start, end };
            };

            const boundaries = findJsonBoundaries(cleanedContent);
            if (!boundaries) {
                console.error("No JSON braces found in response:", responseContent);
                throw new Error("The AI failed to produce a valid workflow plan. Please ensure your prompt is descriptive.");
            }

            const jsonString = cleanedContent.substring(boundaries.start, boundaries.end + 1);
            
            // 2.2 JSON Sanitization: Fix common LLM formatting issues while being extremely careful
            // not to corrupt data like URLs or comma-heavy strings.
            const sanitize = (str: string) => {
                return str
                    // Fix common trailing comma issues ONLY at the very end of objects/arrays before closing braces
                    // We use a more specific check to avoid matching commas inside strings
                    .replace(/,(\s*[}\]])/g, '$1');
            };

            const sanitizedJson = sanitize(jsonString);
            
            let plan;
            try {
                // Try parsing the isolated and sanitized string
                plan = JSON.parse(sanitizedJson);
            } catch (parseErr) {
                // FALLBACK: If the isolated part fails, the AI might have included multiple blocks
                // or text that confused the indices. We try a more aggressive search.
                console.warn("Primary JSON parse failed, trying aggressive extraction...", parseErr);
                
                try {
                    // Try to find the outermost valid JSON object structure
                    // This handles cases where the AI might have included braces in the surrounding text
                    let bestPlan = null;
                    const starts = [];
                    for(let i=0; i<cleanedContent.length; i++) if(cleanedContent[i] === '{') starts.push(i);
                    
                    for (const s of starts) {
                        const sub = cleanedContent.substring(s);
                        const lastBrace = sub.lastIndexOf('}');
                        if (lastBrace === -1) continue;
                        
                        const candidate = sub.substring(0, lastBrace + 1);
                        try {
                            bestPlan = JSON.parse(sanitize(candidate));
                            break; // Found it!
                        } catch(e) { /* continue */ }
                    }
                    
                    if (bestPlan) {
                        plan = bestPlan;
                    } else {
                        throw parseErr; // Rethrow original error if fallback fails
                    }
                } catch (fallbackErr) {
                    console.error("All JSON extraction attempts failed.");
                    console.error("Cleaned Content:", cleanedContent);
                    console.error("Sanitized JSON Attempt:", sanitizedJson);
                    throw new Error(`Failed to parse workflow plan: ${parseErr instanceof Error ? parseErr.message : 'Invalid JSON format'}`);
                }
            }

            // 3. Construct Workflow Steps
            const newSteps: WorkflowStep[] = [];
            const idMap: Record<string, string> = {};
            const now = Date.now();

            plan.steps.forEach((s: any, i: number) => { idMap[s.id || `ai_${i}`] = `step_${now}_${i}`; });

            // Sibling Detection
            const parentMap: Record<string, string[]> = {};
            plan.steps.forEach((step: any) => {
                const deps = (step.depends_on || []).sort().join(',');
                if (deps) {
                    if (!parentMap[deps]) parentMap[deps] = [];
                    parentMap[deps].push(step.id);
                }
            });

            const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

            for (let i = 0; i < plan.steps.length; i++) {
                const planStep = plan.steps[i];
                const rawType: string = (planStep.step_type || 'agent').toLowerCase();
                let normalizedType = (rawType === 'subagent' || rawType === 'iteration') ? 'SubAgent' : rawType;

                // Generic Heuristic for Input Step
                const hasFileParam = planStep.parameters && Object.keys(planStep.parameters).some(key => 
                    key.toLowerCase().endsWith('_file') || (typeof planStep.parameters[key] === 'string' && planStep.parameters[key].includes('{{'))
                );
                if (normalizedType === 'agent' && (planStep.source_type || planStep.source_value || hasFileParam || planStep.name.toLowerCase().includes('read'))) {
                    normalizedType = 'input';
                }

                // Skill Matching
                let matchedSkill: Skill | null = null;
                if (normalizedType !== 'input' && preferredInstalledSkills.length > 0) {
                    const ref = normalise(planStep.skill_name_ref || planStep.name || '');
                    matchedSkill = (preferredInstalledSkills.find(s => normalise(s.name) === ref) ||
                                   preferredInstalledSkills.find(s => ref.includes(normalise(s.name))) ||
                                   preferredInstalledSkills.find(s => normalise(s.name).includes(ref))) || null;
                    
                    if (!matchedSkill) {
                        // Keyword based fallback
                        if (ref.includes('research') || ref.includes('web')) matchedSkill = preferredInstalledSkills.find(s => s.name.toLowerCase().includes('research')) || null;
                        if (!matchedSkill && (ref.includes('analy') || ref.includes('data'))) matchedSkill = preferredInstalledSkills.find(s => s.name.toLowerCase().includes('analyst')) || null;
                    }
                }

                const stepId = idMap[planStep.id || `ai_${i}`];
                const depsKey = (planStep.depends_on || []).sort().join(',');
                const isSibling = depsKey && parentMap[depsKey] && parentMap[depsKey].length > 1;
                const isParallel = planStep.parallel === true || normalizedType === 'SubAgent' || (isSibling && planStep.parallel !== false);

                // Preserve task/goal in parameters
                const parameters = { ...(planStep.parameters || {}) };
                if (planStep.task && !parameters.task) parameters.task = planStep.task;
                if (planStep.goal && !parameters.goal) parameters.goal = planStep.goal;

                newSteps.push({
                    id: stepId,
                    name: planStep.name || 'Untitled Step',
                    step_type: normalizedType as any,
                    config: {
                        skill_id: matchedSkill?.id,
                        parameters,
                        input_files: planStep.input_files || null,
                        output_file: planStep.output_file || (normalizedType === 'SubAgent' ? null : `${stepId}_output.md`),
                        source_type: planStep.source_type || (normalizedType === 'input' ? 'ProjectFile' : null),
                        source_value: planStep.source_value || (() => {
                            if (normalizedType !== 'input') return null;
                            const fileParam = Object.keys(parameters).find(k => k.toLowerCase().endsWith('_file') || (typeof parameters[k] === 'string' && parameters[k].includes('{{')));
                            return fileParam ? (parameters[fileParam].includes('{{') ? parameters[fileParam] : `{{${fileParam}}}`) : null;
                        })(),
                        parallel: isParallel,
                        items_source: planStep.items_source 
                            ? planStep.items_source.replace(/steps\.([^.]+)\.output/g, (_: string, id: string) => `steps.${idMap[id] || id}.output`) 
                            : (normalizedType === 'SubAgent' && planStep.depends_on && planStep.depends_on.length > 0)
                                ? `{{steps.${idMap[planStep.depends_on[0]] || planStep.depends_on[0]}.output}}`
                                : null,
                        output_pattern: planStep.output_pattern || (normalizedType === 'SubAgent' ? 'results/{item}.md' : null),
                        context: planStep.context || (normalizedType === 'SubAgent' ? 'fork' : null)
                    },
                    depends_on: (planStep.depends_on || []).map((d: string) => idMap[d]).filter(Boolean)
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
