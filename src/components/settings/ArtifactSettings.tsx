import React, { useState } from 'react';
import { ChevronDown, FileText, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlobalSettings } from '@/api/tauri';
import { DEFAULT_TEMPLATES } from '@/lib/artifact-templates';

interface ArtifactSettingsProps {
    settings: GlobalSettings;
    setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
}

interface ArtifactTypeConfig {
    id: string;
    label: string;
    description: string;
    icon: string;
    color: string;
}

const ARTIFACT_TYPES: ArtifactTypeConfig[] = [
    { id: 'prd', label: 'PRD', description: 'Product Requirements Document', icon: '📋', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' },
    { id: 'roadmap', label: 'Roadmap', description: 'Strategic product roadmap', icon: '🗓', color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800' },
    { id: 'product_vision', label: 'Product Vision', description: 'Product vision and direction', icon: '🔭', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800' },
    { id: 'user_story', label: 'User Story', description: 'Agile user story template', icon: '👤', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' },
    { id: 'insight', label: 'Product Insight', description: 'Research & data insights', icon: '💡', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' },
    { id: 'one_pager', label: 'One Pager', description: 'Executive summary / brief', icon: '📄', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-100 dark:border-cyan-800' },
    { id: 'presentation', label: 'Presentation', description: 'Presentation outline template', icon: '🎯', color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800' },
    { id: 'initiative', label: 'Initiative', description: 'Strategic initiative template', icon: '🚀', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
    { id: 'competitive_research', label: 'Competitive Research', description: 'Competitive analysis', icon: '🔍', color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800' },
];

export const ArtifactSettings: React.FC<ArtifactSettingsProps> = ({ settings, setSettings }) => {
    const [expandedType, setExpandedType] = useState<string | null>(null);
    const [highlightedRow, setHighlightedRow] = useState<string | null>(null);

    const getTemplate = (type: string) => {
        return settings.artifactTemplates?.[type] ?? DEFAULT_TEMPLATES[type] ?? '';
    };

    const setTemplate = (type: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            artifactTemplates: {
                ...prev.artifactTemplates,
                [type]: value
            }
        }));
    };

    const resetToDefault = (type: string) => {
        const defaultTemplate = DEFAULT_TEMPLATES[type] || '';
        setTemplate(type, defaultTemplate);
        setHighlightedRow(type);
        setTimeout(() => setHighlightedRow(null), 1500);
    };

    const hasCustomTemplate = (type: string) => {
        const current = settings.artifactTemplates?.[type];
        const def = DEFAULT_TEMPLATES[type] ?? '';
        return current !== undefined && current !== def;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid gap-2">
                {ARTIFACT_TYPES.map((artifactType) => {
                    const isExpanded = expandedType === artifactType.id;
                    const isCustom = hasCustomTemplate(artifactType.id);
                    const isHighlighted = highlightedRow === artifactType.id;

                    return (
                        <div
                            key={artifactType.id}
                            className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                                isExpanded
                                    ? 'border-primary/30 shadow-sm dark:border-primary/20'
                                    : isHighlighted
                                    ? 'border-emerald-300 dark:border-emerald-700'
                                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                            } bg-white dark:bg-gray-900`}
                        >
                            {/* Header row */}
                            <button
                                onClick={() => setExpandedType(isExpanded ? null : artifactType.id)}
                                className="w-full flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors text-left"
                            >
                                {/* Icon block */}
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base border shrink-0 ${artifactType.color}`}>
                                    <FileText className="w-4 h-4" />
                                </div>

                                {/* Title & description */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{artifactType.label}</span>
                                        {isCustom && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold uppercase tracking-wider">
                                                Customized
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{artifactType.description}</p>
                                </div>

                                {/* Preview snippet */}
                                {!isExpanded && (
                                    <span className="hidden md:block text-xs text-gray-400 font-mono truncate max-w-[200px] italic">
                                        {getTemplate(artifactType.id).split('\n')[0] || 'No template'}
                                    </span>
                                )}

                                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Editor */}
                            {isExpanded && (
                                <div className="border-t border-gray-100 dark:border-gray-800">
                                    {/* Toolbar */}
                                    <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50/70 dark:bg-gray-900/70 border-b border-gray-100 dark:border-gray-800">
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 font-mono">Markdown Template</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                                            onClick={() => resetToDefault(artifactType.id)}
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            Reset to Default
                                        </Button>
                                    </div>

                                    {/* Textarea */}
                                    <textarea
                                        value={getTemplate(artifactType.id)}
                                        onChange={(e) => setTemplate(artifactType.id, e.target.value)}
                                        className="w-full min-h-[320px] p-5 text-sm font-mono bg-gray-950/[0.02] dark:bg-black/20 border-none outline-none resize-y leading-relaxed text-gray-800 dark:text-gray-200 placeholder:text-gray-400"
                                        placeholder={`Enter markdown template for ${artifactType.label}...\n\nUse {{title}} to insert the artifact title.`}
                                        spellCheck={false}
                                    />

                                    {/* Footer hint */}
                                    <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                                        <p className="text-[11px] text-gray-400 italic">
                                            Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-primary font-mono">{'{{title}}'}</code> as a placeholder for the artifact title. Global templates can be overridden per-project in Project Settings.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
