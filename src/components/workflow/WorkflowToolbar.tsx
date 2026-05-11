import { Button } from '@/components/ui/button';
import { Save, Play, Plus, ZoomIn, ZoomOut, Layout, ChevronDown, Wand2, Clock3, Settings2, Pause, PlayCircle, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WorkflowToolbarProps {
    workflowName: string;
    projectName: string;
    projects?: { id: string; name: string }[];
    isDraft?: boolean;
    onNameChange?: (name: string) => void;
    onProjectSelect?: (projectId: string) => void;
    onSave: () => void;
    onRun: () => void;
    onAddStep: () => void;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitView: () => void;
    isSaving?: boolean;
    isRunning?: boolean;
    onMagic?: () => void;
    scheduleLabel?: string;
    onSchedule?: () => void;
    onEditDetails?: () => void;
    isScheduleEnabled?: boolean;
    onToggleSchedule?: () => void;
    onToggleHistory?: () => void;
    showHistory?: boolean;
}

export default function WorkflowToolbar({
    workflowName,
    projectName,
    projects = [],
    isDraft = false,
    onNameChange,
    onProjectSelect,
    onSave,
    onRun,
    onAddStep,
    onZoomIn,
    onZoomOut,
    onFitView,
    isSaving = false,
    isRunning = false,
    onMagic,
    scheduleLabel,
    onSchedule,
    onEditDetails,
    isScheduleEnabled,
    onToggleSchedule,
    onToggleHistory,
    showHistory = false
}: WorkflowToolbarProps) {
    return (
        <div data-testid="workflow-toolbar" className="absolute left-4 right-4 top-4 z-10 rounded-3xl border border-white/10 bg-background/70 p-3 shadow-[0_20px_48px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex min-w-0 flex-1 flex-col max-w-[340px]">
                    {isDraft ? (
                        <Input
                            value={workflowName}
                            onChange={(e) => onNameChange?.(e.target.value)}
                            placeholder="Enter workflow name..."
                            className="h-8 border-none bg-transparent px-0 text-sm font-bold focus-visible:ring-1 focus-visible:ring-blue-500"
                            autoFocus
                        />
                    ) : (
                        <h2 className="truncate text-sm font-bold text-foreground">
                            {workflowName || 'Untitled Workflow'}
                        </h2>
                    )}
                    <div className="flex items-center gap-2">
                        {isDraft ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                                        {projectName || 'Select Project'}
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 rounded-xl border-white/10 bg-background/95 backdrop-blur-xl">
                                    {projects.map((project) => (
                                        <DropdownMenuItem
                                            key={project.id}
                                            onClick={() => onProjectSelect?.(project.id)}
                                        >
                                            {project.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <span className="text-[10px] text-muted-foreground">
                                {projectName}
                            </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/60">•</span>
                        <p className="text-[10px] text-muted-foreground">
                            Drag nodes to connect
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="mr-1 flex items-center gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onZoomOut}>
                        <ZoomOut className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onFitView}>
                        <Layout className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onZoomIn}>
                        <ZoomIn className="w-4 h-4 text-muted-foreground" />
                    </Button>
                </div>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditDetails?.()}
                    className="h-8 gap-2 rounded-xl border-white/10 bg-white/5 text-xs"
                >
                    <Settings2 className="w-3.5 h-3.5" />
                    Details
                </Button>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSchedule?.()}
                    className="h-8 gap-2 rounded-xl border-white/10 bg-white/5 text-xs"
                >
                    <Clock3 className="w-3.5 h-3.5" />
                    {scheduleLabel || 'Schedule'}
                </Button>

                {onToggleSchedule && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onToggleSchedule()}
                        className="h-8 gap-2 rounded-xl border-white/10 bg-white/5 text-xs"
                    >
                        {isScheduleEnabled ? <Pause className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                        {isScheduleEnabled ? 'Pause Schedule' : 'Resume Schedule'}
                    </Button>
                )}

                {onToggleHistory && (
                    <Button
                        data-testid="btn-workflow-history"
                        size="sm"
                        variant={showHistory ? "default" : "outline"}
                        onClick={onToggleHistory}
                        className={`h-8 gap-2 rounded-xl text-xs ${showHistory ? '' : 'border-white/10 bg-white/5'}`}
                    >
                        <History className="w-3.5 h-3.5" />
                        History
                    </Button>
                )}

                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMagic?.()}
                    className="h-8 gap-2 rounded-xl border-primary/20 text-xs text-primary hover:bg-primary/10"
                >
                    <Wand2 className="w-3.5 h-3.5" />
                    Magic
                </Button>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={onAddStep}
                    className="h-8 gap-2 rounded-xl border-white/10 bg-white/5 text-xs"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Step
                </Button>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={onSave}
                    disabled={isSaving}
                    className="h-8 gap-2 rounded-xl border-white/10 bg-white/5 text-xs"
                >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? 'Saving...' : (isDraft ? 'Create Workflow' : 'Save')}
                </Button>

                <Button
                    data-testid="btn-run-workflow"
                    size="sm"
                    onClick={onRun}
                    disabled={isRunning}
                    className="h-8 gap-2 rounded-xl bg-green-600 text-xs text-white hover:bg-green-700"
                >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {isRunning ? 'Running...' : 'Run Workflow'}
                </Button>

            </div>
            </div>
        </div>
    );
}
