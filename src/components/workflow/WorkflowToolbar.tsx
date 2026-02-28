import { Button } from '@/components/ui/button';
import { Save, Play, Plus, ZoomIn, ZoomOut, Layout, ChevronDown, Wand2 } from 'lucide-react';
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
    onMagic
}: WorkflowToolbarProps) {
    return (
        <div className="absolute top-4 left-4 right-4 h-14 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm flex items-center justify-between px-4 z-10">
            <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex flex-col min-w-0 flex-1 max-w-[300px]">
                    {isDraft ? (
                        <Input
                            value={workflowName}
                            onChange={(e) => onNameChange?.(e.target.value)}
                            placeholder="Enter workflow name..."
                            className="h-8 text-sm font-bold bg-transparent border-none focus-visible:ring-1 focus-visible:ring-blue-500 px-0"
                            autoFocus
                        />
                    ) : (
                        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                            {workflowName || 'Untitled Workflow'}
                        </h2>
                    )}
                    <div className="flex items-center gap-2">
                        {isDraft ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                        {projectName || 'Select Project'}
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56">
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
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                {projectName}
                            </span>
                        )}
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">•</span>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            Drag nodes to connect
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 border-r border-gray-200 dark:border-gray-700 pr-2 mr-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomOut}>
                        <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFitView}>
                        <Layout className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomIn}>
                        <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </Button>
                </div>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMagic?.()}
                    className="gap-2 text-xs border-primary/20 dark:border-primary/30 text-primary hover:bg-primary/10"
                >
                    <Wand2 className="w-3.5 h-3.5" />
                    Magic
                </Button>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={onAddStep}
                    className="gap-2 text-xs"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Step
                </Button>

                <Button
                    size="sm"
                    variant="outline"
                    onClick={onSave}
                    disabled={isSaving}
                    className="gap-2 text-xs"
                >
                    <Save className="w-3.5 h-3.5" />
                    {isSaving ? 'Saving...' : (isDraft ? 'Create Workflow' : 'Save')}
                </Button>

                <Button
                    size="sm"
                    onClick={onRun}
                    disabled={isRunning}
                    className="gap-2 text-xs bg-green-600 hover:bg-green-700 text-white"
                >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {isRunning ? 'Running...' : 'Run Workflow'}
                </Button>

            </div>
        </div>
    );
}
