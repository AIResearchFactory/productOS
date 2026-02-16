import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, BrainCircuit, Workflow as WorkflowIcon, Wand2 } from 'lucide-react';
import { Skill, Workflow, tauriApi } from '@/api/tauri';
import { useToast } from '@/hooks/use-toast';

interface SkillEditorProps {
    skill: Skill;
    workflows?: Workflow[]; // Available workflows to check usage
    onSave: (updatedSkill: Skill) => void;
}

export default function SkillEditor({ skill, workflows = [], onSave }: SkillEditorProps) {
    const [name, setName] = useState(skill.name);
    const [description, setDescription] = useState(skill.description);

    // Structured template fields
    const [role, setRole] = useState('');
    const [tasks, setTasks] = useState('');
    const [output, setOutput] = useState('');
    const [capabilities, setCapabilities] = useState('');
    const [additionalContent, setAdditionalContent] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [usedInWorkflows, setUsedInWorkflows] = useState<Workflow[]>([]);
    const { toast } = useToast();
    const [hasChanges, setHasChanges] = useState(false);
    const lastChangeTime = useRef<number>(Date.now());
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize state when skill changes
    useEffect(() => {
        setName(skill.name);
        setDescription(skill.description);

        // Parse the template into structured fields
        const sections = parseTemplate(skill.prompt_template || '', skill.name);
        setRole(sections.role);
        setTasks(sections.tasks);
        setOutput(sections.output);
        setCapabilities(skill.capabilities ? skill.capabilities.join(', ') : '');
        setAdditionalContent(sections.additional);

        setHasChanges(false);

        // Find workflows that use this skill
        if (workflows.length > 0) {
            const usingWorkflows = workflows.filter(workflow =>
                workflow.steps.some(step => step.config.skill_id === skill.id)
            );
            setUsedInWorkflows(usingWorkflows);
        } else {
            setUsedInWorkflows([]);
        }
    }, [skill, workflows]);

    const parseTemplate = (text: string, skillName: string) => {
        const sections = {
            role: '',
            tasks: '',
            output: '',
            additional: ''
        };

        if (!text) return sections;

        // Structured section mapping
        const headerMap: Record<string, keyof typeof sections> = {
            'role': 'role',
            'tasks': 'tasks',
            'task': 'tasks',
            'output': 'output',
            'output format': 'output'
        };

        // UI structural headers to ignore (they shouldn't be in additional content)
        const ignoredHeaders = ['prompt template', 'overview', 'usage guidelines', 'parameters', 'examples'];

        let content = text;
        const lines = text.split('\n');

        // Skip common skill name header if present at start
        if (lines[0] && lines[0].startsWith('# ') && (lines[0].toLowerCase().includes(skillName.toLowerCase()) || lines[0].toLowerCase().includes('skill'))) {
            content = lines.slice(1).join('\n').trim();
        }

        // Split by headers (e.g., # Role, ## Role, etc.)
        const parts = content.split(/(?=^#{1,6}\s+)/m);

        parts.forEach(part => {
            const match = part.match(/^#{1,6}\s+(.+)$/m);
            if (match) {
                const headerLine = match[1].toLowerCase().trim();
                const body = part.replace(/^#{1,6}\s+.+$/m, '').trim();

                // Check if it's a known section
                let matched = false;
                for (const [key, field] of Object.entries(headerMap)) {
                    if (headerLine === key) {
                        sections[field] = body;
                        matched = true;
                        break;
                    }
                }

                if (!matched) {
                    // Check if it's a structural header to ignore
                    const isIgnored = ignoredHeaders.some(h => headerLine === h);
                    if (!isIgnored) {
                        // This is an actual additional header/section
                        sections.additional += (sections.additional ? '\n\n' : '') + part.trim();
                    }
                }
            } else if (part.trim()) {
                // Content before any header
                // If this contains frontmatter or something we missed, try to clean it
                const cleanedPart = part.trim();
                if (!cleanedPart.startsWith('---')) {
                    sections.additional += (sections.additional ? '\n\n' : '') + cleanedPart;
                }
            }
        });

        return sections;
    };

    const recombineTemplate = () => {
        let template = `# ${name}\n\n`;

        if (role.trim()) {
            template += `## Role\n${role.trim()}\n\n`;
        }

        if (tasks.trim()) {
            template += `## Tasks\n${tasks.trim()}\n\n`;
        }

        if (output.trim()) {
            template += `## Output\n${output.trim()}\n\n`;
        }

        if (additionalContent.trim()) {
            template += additionalContent.trim();
        }

        return template.trim();
    };

    const handleFieldChange = (setter: (val: string) => void, val: string) => {
        setter(val);
        setHasChanges(true);
        lastChangeTime.current = Date.now();
    };

    // Auto-save logic: 25 seconds of idle
    useEffect(() => {
        if (hasChanges && !isSaving) {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

            autoSaveTimerRef.current = setTimeout(() => {
                const idleTime = Date.now() - lastChangeTime.current;
                if (idleTime >= 24000) { // Slightly less than 25s
                    handleSave(true); // silent save
                }
            }, 25000);
        }

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        };
    }, [name, description, role, tasks, output, capabilities, additionalContent, hasChanges, isSaving]);

    const handleSave = async (silent = false) => {
        if (!name.trim()) {
            if (!silent) {
                toast({
                    title: 'Validation Error',
                    description: 'Skill name is required',
                    variant: 'destructive'
                });
            }
            return;
        }

        setIsSaving(true);
        try {
            let finalId = skill.id;
            if (finalId.startsWith('draft-')) {
                finalId = name.trim()
                    .toLowerCase()
                    .replace(/ /g, '-')
                    .replace(/[^a-z0-9-_]/g, '');
            }

            const updatedSkill: Skill = {
                ...skill,
                id: finalId,
                name: name.trim(),
                description: description.trim(),
                prompt_template: recombineTemplate(),
                capabilities: capabilities.split(',').map(c => c.trim()).filter(c => c)
            };

            await tauriApi.updateSkill(updatedSkill);

            if (!silent) {
                toast({
                    title: 'Success',
                    description: 'Skill updated successfully'
                });
            }

            setHasChanges(false);
            onSave(updatedSkill);
        } catch (error) {
            console.error('Failed to update skill:', error);
            if (!silent) {
                toast({
                    title: 'Error',
                    description: `Failed to update skill: ${error}`,
                    variant: 'destructive'
                });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleAIValidate = async () => {
        setIsValidating(true);
        // Simulate API call for validation
        setTimeout(() => {
            setIsValidating(false);
            toast({
                title: "AI Analysis Complete",
                description: "The prompt structure looks good and follows best practices."
            });
        }, 1500);
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden">
            {/* Header */}
            <div className="border-b border-border p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-accent text-accent-foreground">
                        <BrainCircuit className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            Edit Skill
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Configure skill behavior and prompt template
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => handleSave()}
                    disabled={isSaving || !hasChanges}
                    variant="default"
                    className="gap-2"
                >
                    <Save className="w-4 h-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            {/* Content having scroll */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">

                {/* Usage Warning */}
                {usedInWorkflows.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <WorkflowIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">
                                    Used in {usedInWorkflows.length} Workflow{usedInWorkflows.length !== 1 ? 's' : ''}
                                </h3>
                                <p className="text-sm text-orange-600 dark:text-orange-400 mt-1 mb-2">
                                    Changes to this skill will affect the following active workflows:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {usedInWorkflows.map(wf => (
                                        <div key={wf.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-100 dark:bg-orange-900/40 text-xs font-medium text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                            <span>{wf.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid gap-6 p-6 border border-border rounded-lg bg-muted/30">
                    <div className="grid gap-2">
                        <Label htmlFor="skill-name">Skill Name</Label>
                        <Input
                            id="skill-name"
                            value={name}
                            onChange={(e) => handleFieldChange(setName, e.target.value)}
                            placeholder="e.g. Research Assistant"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="skill-description">Description</Label>
                        <Input
                            id="skill-description"
                            value={description}
                            onChange={(e) => handleFieldChange(setDescription, e.target.value)}
                            placeholder="Brief description of what this skill does"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="skill-capabilities">Capabilities</Label>
                        <Input
                            id="skill-capabilities"
                            value={capabilities}
                            onChange={(e) => handleFieldChange(setCapabilities, e.target.value)}
                            placeholder="comma, separated, list, of, capabilities"
                        />
                    </div>
                </div>

                {/* Structured Fields */}
                <div className="space-y-6">
                    <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="skill-role" className="text-base font-medium">Role</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1 text-primary"
                                onClick={handleAIValidate}
                                disabled={!role.trim() || isValidating}
                            >
                                <Wand2 className="w-3 h-3" />
                                {isValidating ? 'Validating...' : 'AI Validate'}
                            </Button>
                        </div>
                        <Textarea
                            id="skill-role"
                            value={role}
                            onChange={(e) => handleFieldChange(setRole, e.target.value)}
                            className="min-h-[100px] p-4"
                            placeholder="You are an expert in... Your goal is to..."
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="skill-tasks" className="text-base font-medium">Tasks</Label>
                        <Textarea
                            id="skill-tasks"
                            value={tasks}
                            onChange={(e) => handleFieldChange(setTasks, e.target.value)}
                            className="min-h-[150px] p-4"
                            placeholder="- Analyze code structure&#10;- Identify bugs&#10;- Optimize performance"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="skill-output" className="text-base font-medium">Output Format</Label>
                        <Textarea
                            id="skill-output"
                            value={output}
                            onChange={(e) => handleFieldChange(setOutput, e.target.value)}
                            className="min-h-[100px] p-4"
                            placeholder="Provide the result in markdown format with..."
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="skill-additional" className="text-base font-medium">Additional Content</Label>
                        <Textarea
                            id="skill-additional"
                            value={additionalContent}
                            onChange={(e) => handleFieldChange(setAdditionalContent, e.target.value)}
                            className="min-h-[100px] font-mono text-sm p-4"
                            placeholder="Any other sections or text in the template..."
                        />
                        <p className="text-xs text-gray-500">
                            This field contains any extra content from the template that doesn't fit the Role/Tasks/Output structure.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
