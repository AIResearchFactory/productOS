import { useState } from 'react';
import { Lightbulb, Scale, FileCheck, FlaskConical, BarChart3, Beaker, Target, Plus, ChevronRight, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { type Artifact, type ArtifactType } from '@/api/tauri';

interface ArtifactListProps {
    artifacts: Artifact[];
    activeArtifactId?: string;
    filterType?: ArtifactType;
    onArtifactSelect: (artifact: Artifact) => void;
    onCreateArtifact: (type: ArtifactType) => void;
    onImportArtifact?: (type: ArtifactType) => void;
    onDeleteArtifact?: (artifact: Artifact) => void;
    isLoading?: boolean;
}

const ARTIFACT_TYPE_CONFIG: Record<ArtifactType, { icon: typeof Lightbulb; label: string; color: string }> = {
    insight: { icon: Lightbulb, label: 'Insights', color: 'text-amber-500 bg-amber-500/10 border-amber-500/10' },
    evidence: { icon: FileCheck, label: 'Evidence', color: 'text-blue-500 bg-blue-500/10 border-blue-500/10' },
    decision: { icon: Scale, label: 'Decisions', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/10' },
    requirement: { icon: Target, label: 'Requirements', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/10' },
    metric_definition: { icon: BarChart3, label: 'Metrics', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/10' },
    experiment: { icon: FlaskConical, label: 'Experiments', color: 'text-orange-500 bg-orange-500/10 border-orange-500/10' },
    poc_brief: { icon: Beaker, label: 'POC Briefs', color: 'text-rose-500 bg-rose-500/10 border-rose-500/10' },
    initiative: { icon: Rocket, label: 'Initiatives', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/10' },
};

const ALL_ARTIFACT_TYPES: ArtifactType[] = [
    'insight', 'evidence', 'decision', 'requirement',
    'metric_definition', 'experiment', 'poc_brief', 'initiative'
];

export default function ArtifactList({
    artifacts,
    activeArtifactId,
    filterType,
    onArtifactSelect,
    onCreateArtifact,
    onImportArtifact,
    onDeleteArtifact: _onDeleteArtifact,
    isLoading = false,
}: ArtifactListProps) {
    const [selectedType, setSelectedType] = useState<ArtifactType | undefined>(filterType);

    const filteredArtifacts = selectedType
        ? artifacts.filter(a => a.artifactType === selectedType)
        : artifacts;

    const groupedArtifacts = filteredArtifacts.reduce((acc, artifact) => {
        const type = artifact.artifactType;
        if (!acc[type]) acc[type] = [];
        acc[type].push(artifact);
        return acc;
    }, {} as Record<string, Artifact[]>);

    return (
        <div className="flex flex-col h-full">
            {/* Type filter pills */}
            <div className="px-3 pt-3 pb-2 shrink-0">
                <div className="flex flex-wrap gap-1.5">
                    <button
                        className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md transition-all ${!selectedType
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                            }`}
                        onClick={() => setSelectedType(undefined)}
                    >
                        All
                    </button>
                    {ALL_ARTIFACT_TYPES.map(type => {
                        const config = ARTIFACT_TYPE_CONFIG[type];
                        const count = artifacts.filter(a => a.artifactType === type).length;
                        return (
                            <button
                                key={type}
                                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${selectedType === type
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                    }`}
                                onClick={() => setSelectedType(type === selectedType ? undefined : type)}
                            >
                                <config.icon className="w-3 h-3" />
                                {config.label}
                                {count > 0 && (
                                    <span className="text-[9px] opacity-60">({count})</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Create button */}
            <div className="px-3 pb-2 shrink-0 space-y-1.5">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs font-semibold gap-1.5 hover:bg-primary/10 hover:text-primary"
                    onClick={() => onCreateArtifact(selectedType || 'insight')}
                >
                    <Plus className="w-3 h-3" />
                    New {selectedType ? ARTIFACT_TYPE_CONFIG[selectedType].label.slice(0, -1) : 'Artifact'}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs font-semibold gap-1.5 hover:bg-emerald-500/10 hover:text-emerald-400"
                    onClick={() => onImportArtifact?.(selectedType || 'insight')}
                >
                    <Plus className="w-3 h-3" />
                    Import Markdown
                </Button>
            </div>

            {/* Artifact list */}
            <ScrollArea className="flex-1">
                <div className="px-2 py-1 space-y-1">
                    {isLoading ? (
                        <div className="text-[10px] text-muted-foreground/40 py-4 text-center italic">
                            Loading artifacts…
                        </div>
                    ) : filteredArtifacts.length === 0 ? (
                        <div className="text-[10px] text-muted-foreground/40 py-4 text-center italic">
                            No artifacts yet
                        </div>
                    ) : (
                        <AnimatePresence>
                            {(selectedType ? [[selectedType, filteredArtifacts]] as [string, Artifact[]][]
                                : Object.entries(groupedArtifacts)
                            ).map(([type, items]) => {
                                const config = ARTIFACT_TYPE_CONFIG[type as ArtifactType];
                                if (!config) return null;
                                return (
                                    <div key={type}>
                                        {!selectedType && (
                                            <div className="px-2 pt-3 pb-1">
                                                <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                                                    <config.icon className="w-3 h-3" />
                                                    {config.label}
                                                    <span className="text-[8px] opacity-50">({items.length})</span>
                                                </h4>
                                            </div>
                                        )}
                                        {items.map((artifact) => (
                                            <motion.div
                                                key={artifact.id}
                                                layout
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                            >
                                                <button
                                                    className={`w-full flex items-center gap-2.5 text-xs py-2 px-2.5 rounded-lg transition-all group ${activeArtifactId === artifact.id
                                                        ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(var(--primary),0.2)]'
                                                        : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
                                                        }`}
                                                    onClick={() => onArtifactSelect(artifact)}
                                                >
                                                    <div className={`p-1 rounded-md border ${config.color} shrink-0`}>
                                                        <config.icon className="w-3 h-3" />
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-left">
                                                        <div className="text-[11px] font-semibold truncate">{artifact.title}</div>
                                                        <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                                                            {new Date(artifact.updated).toLocaleDateString()}
                                                            {artifact.confidence !== undefined && (
                                                                <span className="ml-1.5">
                                                                    · {Math.round(artifact.confidence * 100)}% conf
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                                                </button>
                                            </motion.div>
                                        ))}
                                    </div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
