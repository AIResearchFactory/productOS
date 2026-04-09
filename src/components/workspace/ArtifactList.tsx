import { useState, useEffect } from 'react';
import { Lightbulb, FileText, Rocket, Target, Users, Plus, ChevronRight, Layout, ClipboardList, MonitorPlay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfidenceBars } from './ConfidenceBars';
import { appApi } from '@/api/app';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { type Artifact, type ArtifactType } from '@/api/tauri';

interface ArtifactListProps {
    artifacts: Artifact[];
    activeArtifactId?: string;
    filterType?: ArtifactType;
    onArtifactSelect: (artifact: Artifact) => void;
    onCreateArtifact: (type: ArtifactType) => void;
    onImportArtifact?: (type: ArtifactType) => void;
    onDeleteArtifact?: (artifact: Artifact) => void;
    onArtifactUpdate?: () => void;
    onExportDocument?: (projectId: string, document: { id: string; name: string; type: string; content: string }) => void;
    onCreatePresentationFromFile?: (projectId: string, document: { id: string; name: string; type: string; content: string }) => void;
    isLoading?: boolean;
}

const ARTIFACT_TYPE_CONFIG: Record<ArtifactType, { icon: any; label: string; color: string }> = {
    roadmap: { icon: Layout, label: 'Roadmaps', color: 'text-amber-500 bg-amber-500/10 border-amber-500/10' },
    product_vision: { icon: Lightbulb, label: 'Vision', color: 'text-blue-500 bg-blue-500/10 border-blue-500/10' },
    one_pager: { icon: FileText, label: 'One Pagers', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/10' },
    prd: { icon: ClipboardList, label: 'PRDs', color: 'text-purple-500 bg-purple-500/10 border-purple-500/10' },
    initiative: { icon: Rocket, label: 'Initiatives', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/10' },
    competitive_research: { icon: Target, label: 'Competitive Research', color: 'text-rose-500 bg-rose-500/10 border-rose-500/10' },
    user_story: { icon: Users, label: 'User Stories', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/10' },
    insight: { icon: Lightbulb, label: 'Insights', color: 'text-amber-500 bg-amber-500/10 border-amber-500/10' },
    presentation: { icon: MonitorPlay, label: 'Presentations', color: 'text-purple-500 bg-purple-500/10 border-purple-500/10' },
    pr_faq: { icon: ClipboardList, label: 'PR-FAQs', color: 'text-orange-500 bg-orange-500/10 border-orange-500/10' },
};

const ALL_ARTIFACT_TYPES: ArtifactType[] = [
    'roadmap', 'product_vision', 'one_pager', 'prd', 'initiative', 'competitive_research', 'user_story', 'insight', 'presentation', 'pr_faq'
];

export default function ArtifactList({
    artifacts,
    activeArtifactId,
    filterType,
    onArtifactSelect,
    onCreateArtifact,
    onImportArtifact,
    onDeleteArtifact,
    onArtifactUpdate,
    onExportDocument,
    onCreatePresentationFromFile,
    isLoading = false,
}: ArtifactListProps) {
    const [selectedType, setSelectedType] = useState<ArtifactType | undefined>(filterType);

    useEffect(() => {
        if (filterType !== undefined) {
            setSelectedType(filterType);
        }
    }, [filterType]);

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
                        data-testid="artifact-filter-all"
                        className={`text-2xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md transition-all ${!selectedType
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
                                data-testid={`artifact-filter-${type}`}
                                className={`text-2xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${selectedType === type
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                    }`}
                                onClick={() => setSelectedType(type === selectedType ? undefined : type)}
                            >
                                <config.icon className="w-3 h-3" />
                                {config.label}
                                {count > 0 && (
                                    <span className="text-2xs opacity-60">({count})</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Create button */}
            <div className="px-3 pb-2 shrink-0 space-y-1.5">
                <Button
                    data-testid="artifact-create-button"
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs font-semibold gap-1.5 hover:bg-primary/10 hover:text-primary"
                    onClick={() => onCreateArtifact(selectedType || 'roadmap')}
                >
                    <Plus className="w-3 h-3" />
                    New {selectedType && ARTIFACT_TYPE_CONFIG[selectedType] ? ARTIFACT_TYPE_CONFIG[selectedType].label : 'Artifact'}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs font-semibold gap-1.5 hover:bg-emerald-500/10 hover:text-emerald-400"
                    onClick={() => onImportArtifact?.(selectedType || 'roadmap')}
                >
                    <Plus className="w-3 h-3" />
                    Import Markdown
                </Button>
            </div>

            {/* Artifact list */}
            <ScrollArea className="flex-1">
                <div className="px-2 py-1 space-y-1">
                    {isLoading ? (
                        <div className="text-2xs text-muted-foreground/40 py-4 text-center italic">
                            Loading artifacts…
                        </div>
                    ) : filteredArtifacts.length === 0 ? (
                        <div className="text-2xs text-muted-foreground/40 py-4 text-center italic">
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
                                                <h4 className="text-2xs font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-1.5">
                                                    <config.icon className="w-3 h-3" />
                                                    {config.label}
                                                    <span className="text-3xs opacity-50">({items.length})</span>
                                                </h4>
                                            </div>
                                        )}
                                        {items.map((artifact) => {
                                            const getArtifactDirectory = (t: string): string => {
                                                switch (t) {
                                                    case 'roadmap': return 'roadmaps';
                                                    case 'product_vision': return 'product-visions';
                                                    case 'one_pager': return 'one-pagers';
                                                    case 'prd': return 'prds';
                                                    case 'initiative': return 'initiatives';
                                                    case 'competitive_research': return 'competitive-research';
                                                    case 'user_story': return 'user-stories';
                                                    case 'presentation': return 'presentations';
                                                    case 'insight': return 'insights';
                                                    case 'pr_faq': return 'pr-faqs';
                                                    default: return 'artifacts';
                                                }
                                            };
                                            const fileName = `${getArtifactDirectory(artifact.artifactType)}/${artifact.id}.md`;
                                            const artifactDoc = {
                                                id: fileName,
                                                name: fileName,
                                                type: 'document',
                                                content: artifact.content,
                                            };

                                            return (
                                            <motion.div
                                                key={artifact.id}
                                                layout
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                            >
                                                <ContextMenu>
                                                    <ContextMenuTrigger asChild>
                                                        <button
                                                            data-testid={`artifact-item-${artifact.id}`}
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
                                                    </ContextMenuTrigger>
                                                    <ContextMenuContent>
                                                        <ContextMenuItem onClick={async () => {
                                                            const newTitle = window.prompt('Enter new title for this artifact:', artifact.title);
                                                            if (newTitle && newTitle !== artifact.title) {
                                                                await appApi.updateArtifactMetadata(
                                                                    artifact.projectId,
                                                                    artifact.artifactType,
                                                                    artifact.id,
                                                                    newTitle
                                                                );
                                                                if (onArtifactUpdate) onArtifactUpdate();
                                                            }
                                                        }}>
                                                            Rename
                                                        </ContextMenuItem>
                                                        <ContextMenuSub>
                                                            <ContextMenuSubTrigger>
                                                                Export as...
                                                            </ContextMenuSubTrigger>
                                                            <ContextMenuSubContent className="w-48">
                                                                <ContextMenuItem data-testid="export-as-pdf" onClick={() => onExportDocument && onExportDocument(artifact.projectId, { ...artifactDoc, name: artifactDoc.name + '.pdf' })}>
                                                                    As PDF (.pdf)
                                                                </ContextMenuItem>
                                                                <ContextMenuItem data-testid="export-as-word" onClick={() => onExportDocument && onExportDocument(artifact.projectId, { ...artifactDoc, name: artifactDoc.name + '.docx' })}>
                                                                    As Word (.docx)
                                                                </ContextMenuItem>
                                                            </ContextMenuSubContent>
                                                        </ContextMenuSub>
                                                        <ContextMenuSeparator />
                                                        <ContextMenuItem data-testid="create-presentation-from-file" onClick={() => onCreatePresentationFromFile && onCreatePresentationFromFile(artifact.projectId, artifactDoc)}>
                                                            Create Presentation from this File
                                                        </ContextMenuItem>
                                                        <ContextMenuSeparator />
                                                        <ContextMenuItem data-testid="delete-file"
                                                            onClick={() => onDeleteArtifact && onDeleteArtifact(artifact)}
                                                            className="text-red-500 focus:text-red-500"
                                                        >
                                                            Delete File
                                                        </ContextMenuItem>
                                                    </ContextMenuContent>
                                                </ContextMenu>
                                            </motion.div>
                                        )})}
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
