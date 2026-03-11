import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Save, BrainCircuit, Type, FileText, ChevronDown, Activity, Zap, Plus } from 'lucide-react';
import { Skill, WorkflowStep, StepConfig } from '@/api/tauri';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StepEditPanelProps {
    step: WorkflowStep;
    skills: Skill[];
    onSave: (updatedStep: WorkflowStep) => void;
    onClose: () => void;
    onNewSkill?: () => void;
}

const STEP_TYPES = [
    { id: 'input', name: 'Input', icon: FileText, description: 'Read data from files or manual input' },
    { id: 'agent', name: 'Agent', icon: Zap, description: 'Single AI agent task using a skill' },
    { id: 'iteration', name: 'Iteration', icon: Activity, description: 'Run a task for multiple items' },
    { id: 'synthesis', name: 'Synthesis', icon: BrainCircuit, description: 'Combine results from previous steps' },
    { id: 'conditional', name: 'Conditional', icon: Type, description: 'Branch logic based on conditions' },
    { id: 'SubAgent', name: 'Sub-Agent', icon: Activity, description: 'Parallel execution of sub-agents' },
];

export default function StepEditPanel({ step, skills, onSave, onClose, onNewSkill }: StepEditPanelProps) {
    const [name, setName] = useState(step.name);
    const [stepType, setStepType] = useState(step.step_type);
    const [config, setConfig] = useState<StepConfig>({ ...step.config });
    const [outputFile, setOutputFile] = useState(step.config.output_file || '');
    const [selectedSkill, setSelectedSkill] = useState<Skill | null>(
        skills.find(s => s.id === step.config.skill_id) || null
    );

    useEffect(() => {
        setName(step.name);
        setStepType(step.step_type);
        setConfig({ ...step.config });
        setOutputFile(step.config.output_file || '');
        setSelectedSkill(skills.find(s => s.id === step.config.skill_id) || null);
    }, [step, skills]);

    const handleSkillSelect = (skillId: string) => {
        const skill = skills.find(s => s.id === skillId);
        if (skill) {
            setSelectedSkill(skill);
            const newParameters = { ...(config.parameters || {}) };

            // Initialize with default values for missing parameters
            skill.parameters.forEach(p => {
                if (p.default_value !== undefined && !newParameters[p.name]) {
                    newParameters[p.name] = p.default_value;
                }
            });

            setConfig(prev => ({
                ...prev,
                skill_id: skill.id,
                parameters: newParameters
            }));
        }
    };

    const handleParamChange = (name: string, value: any) => {
        setConfig(prev => ({
            ...prev,
            parameters: {
                ...(prev.parameters || {}),
                [name]: value
            }
        }));
    };

    const handleSave = () => {
        onSave({
            ...step,
            name,
            step_type: stepType as any,
            config: {
                ...config,
                output_file: outputFile
            }
        });
    };

    const currentType = STEP_TYPES.find(t => t.id === stepType) || STEP_TYPES[1];

    return (
        <div className="absolute top-0 right-0 w-80 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <currentType.icon className="w-4 h-4" />
                    </div>
                    <h2 className="font-bold text-sm text-gray-900 dark:text-white">Edit Step</h2>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="step-name" className="text-gray-700 dark:text-gray-300">Step Name</Label>
                        <Input
                            id="step-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter step name..."
                            className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800"
                        />
                    </div>

                    {/* Output File */}
                    <div className="space-y-2">
                        <Label htmlFor="output-file" className="text-gray-700 dark:text-gray-300">Output Filename</Label>
                        <Input
                            id="output-file"
                            value={outputFile}
                            onChange={(e) => setOutputFile(e.target.value)}
                            placeholder="e.g. results.md"
                            className="bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 font-mono text-xs"
                        />
                    </div>

                    {/* Step Type */}
                    <div className="space-y-2">
                        <Label className="text-gray-700 dark:text-gray-300">Step Type</Label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between gap-2 px-3 h-9 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <currentType.icon className="w-4 h-4 text-gray-500 shrink-0" />
                                        <span className="truncate text-sm">{currentType.name}</span>
                                    </div>
                                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[calc(20rem-2rem)]">
                                {STEP_TYPES.map((type) => (
                                    <DropdownMenuItem
                                        key={type.id}
                                        onSelect={() => setStepType(type.id as any)}
                                        className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 font-medium">
                                            <type.icon className="w-3.5 h-3.5 text-blue-500" />
                                            {type.name}
                                        </div>
                                        <span className="text-[10px] text-gray-500">{type.description}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Input Step Config */}
                    {stepType === 'input' && (
                        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <Label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Source Configuration</Label>
                            <div className="space-y-2">
                                <Label htmlFor="source-type" className="text-gray-700 dark:text-gray-300">Source Type</Label>
                                <select
                                    id="source-type"
                                    value={config.source_type || 'ProjectFile'}
                                    onChange={(e) => setConfig(prev => ({ ...prev, source_type: e.target.value }))}
                                    className="w-full h-9 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 text-sm text-gray-900 dark:text-white"
                                >
                                    <option value="ProjectFile">Project File</option>
                                    <option value="TextInput">Text Input</option>
                                    <option value="FileUpload">File Upload</option>
                                    <option value="ExternalUrl">External URL</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="source-value" className="text-gray-700 dark:text-gray-300">File Path</Label>
                                <Input
                                    id="source-value"
                                    value={config.source_value || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, source_value: e.target.value }))}
                                    placeholder="e.g. data/competitors.md"
                                    className="h-8 text-xs font-mono bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800"
                                />
                                <p className="text-[10px] text-gray-400">Path to the file within the project.</p>
                            </div>
                        </div>
                    )}

                    {/* Skill Selection (for agent/iteration/subagent steps) */}
                    {(stepType === 'agent' || stepType === 'iteration' || stepType === 'skill' || stepType === 'SubAgent') && (
                        <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between">
                                <Label className="text-gray-700 dark:text-gray-300">Skill</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                    onClick={onNewSkill}
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    New Skill
                                </Button>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between gap-2 px-3 h-9 bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <BrainCircuit className="w-4 h-4 text-cyan-500 shrink-0" />
                                            <span className="truncate font-medium">{selectedSkill?.name || 'Select a skill...'}</span>
                                        </div>
                                        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[calc(20rem-2rem)] max-h-60 overflow-y-auto">
                                    {skills.length === 0 ? (
                                        <div className="p-4 text-center">
                                            <p className="text-xs text-gray-500 mb-2">No skills available</p>
                                            <Button size="sm" variant="outline" className="w-full" onClick={onNewSkill}>
                                                Create First Skill
                                            </Button>
                                        </div>
                                    ) : (
                                        skills.map((skill) => (
                                            <DropdownMenuItem
                                                key={skill.id}
                                                onSelect={() => handleSkillSelect(skill.id)}
                                                className="flex flex-col items-start gap-1 py-2 cursor-pointer"
                                            >
                                                <span className="font-medium text-xs">{skill.name}</span>
                                                <span className="text-[10px] text-gray-500 truncate w-full">{skill.description}</span>
                                            </DropdownMenuItem>
                                        ))
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}

                    {/* Iteration / Sub-Agent Config */}
                    {(stepType === 'iteration' || (stepType as string) === 'SubAgent') && (
                        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <div className="space-y-2">
                                <Label htmlFor="items-source" className="text-gray-700 dark:text-gray-300">Items Source</Label>
                                <Input
                                    id="items-source"
                                    value={config.items_source || ''}
                                    onChange={(e) => setConfig(prev => ({ ...prev, items_source: e.target.value }))}
                                    placeholder="e.g. ['a', 'b'] or {{steps.step_id.output}}"
                                    className="h-8 text-xs font-mono"
                                />
                                <p className="text-[10px] text-gray-400">JSON array or reference to previous step output.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is-parallel"
                                    checked={!!config.parallel}
                                    onChange={(e) => setConfig(prev => ({ ...prev, parallel: e.target.checked }))}
                                    className="rounded border-gray-300 dark:border-gray-700 h-3.5 w-3.5"
                                />
                                <Label htmlFor="is-parallel" className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                                    Run in Parallel
                                </Label>
                            </div>
                        </div>
                    )}

                    {/* Skill Parameters */}
                    {selectedSkill && (
                        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Parameters</Label>
                                <span className="text-[10px] text-gray-400">{selectedSkill.parameters.length} total</span>
                            </div>

                            {selectedSkill.parameters.length === 0 ? (
                                <p className="text-[10px] text-gray-400 italic">No parameters defined for this skill.</p>
                            ) : (
                                selectedSkill.parameters.map(param => (
                                    <div key={param.name} className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor={`param-${param.name}`} className="text-xs text-gray-700 dark:text-gray-300">
                                                {param.name}
                                                {param.required && <span className="text-red-500 ml-0.5">*</span>}
                                            </Label>
                                            <span className="text-[10px] text-gray-400">{param.type}</span>
                                        </div>
                                        {param.type === 'string' ? (
                                            <Input
                                                id={`param-${param.name}`}
                                                value={config.parameters?.[param.name] || ''}
                                                onChange={(e) => handleParamChange(param.name, e.target.value)}
                                                className="h-8 text-xs bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800"
                                            />
                                        ) : param.type === 'boolean' ? (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`param-${param.name}`}
                                                    checked={!!config.parameters?.[param.name]}
                                                    onChange={(e) => handleParamChange(param.name, e.target.checked)}
                                                    className="rounded border-gray-300 dark:border-gray-700 h-3.5 w-3.5"
                                                />
                                                <span className="text-[10px] text-gray-500 cursor-pointer" onClick={() => handleParamChange(param.name, !config.parameters?.[param.name])}>
                                                    Enabled
                                                </span>
                                            </div>
                                        ) : (
                                            <Input
                                                id={`param-${param.name}`}
                                                value={config.parameters?.[param.name] || ''}
                                                onChange={(e) => handleParamChange(param.name, e.target.value)}
                                                className="h-8 text-xs bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800"
                                            />
                                        )}
                                        {param.description && (
                                            <p className="text-[10px] text-gray-400 leading-tight">{param.description}</p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex gap-2">
                <Button variant="outline" className="flex-1 h-9 bg-white dark:bg-gray-950" onClick={onClose}>
                    Cancel
                </Button>
                <Button className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSave}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Step
                </Button>
            </div>
        </div>
    );
}

