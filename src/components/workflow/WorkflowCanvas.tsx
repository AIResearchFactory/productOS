import { useCallback, useEffect, useState } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    ReactFlowProvider,
    useReactFlow,
    ConnectionMode
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { tauriApi, Workflow, WorkflowStep, Skill, WorkflowProgress, WorkflowSchedule } from '@/api/tauri';
import StepNode, { StepNodeData } from './nodes/StepNode';
import WorkflowToolbar from './WorkflowToolbar';
import StepEditPanel from './StepEditPanel';
import MagicWorkflowDialog from './MagicWorkflowDialog';
import WorkflowScheduleDialog from './WorkflowScheduleDialog';
import { useToast } from '@/hooks/use-toast';

// Define StepNode type outside to avoid re-creation
const nodeTypes = {
    step: StepNode as any,
};

interface WorkflowCanvasProps {
    workflow: Workflow;
    projectName: string;
    projects: { id: string; name: string }[];
    skills: Skill[];
    onSave: (workflow: Workflow) => void;
    onRun: () => void;
    onNewSkill?: () => void;
    isRunning?: boolean;
    theme?: string;
    onEditDetails?: (workflow: Workflow) => void;
    openScheduleNonce?: number;
}

function WorkflowCanvasContent({ workflow, projectName, projects, skills, onSave, onRun, onNewSkill, isRunning, theme = 'dark', onEditDetails, openScheduleNonce }: WorkflowCanvasProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [draftName, setDraftName] = useState(workflow.name);
    const [draftProjectId, setDraftProjectId] = useState(workflow.project_id);
    const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
    const [showMagicDialog, setShowMagicDialog] = useState(false);
    const [showScheduleDialog, setShowScheduleDialog] = useState(false);
    const { toast } = useToast();
    const { fitView, zoomIn, zoomOut, getNode, getEdges } = useReactFlow();

    // Update draft state when workflow changes
    useEffect(() => {
        setDraftName(workflow.name);
        setDraftProjectId(workflow.project_id);
    }, [workflow.id]);

    const handleEditStep = useCallback((nodeId: string) => {
        const node = getNode(nodeId);
        if (!node) return;
        const data = node.data as StepNodeData;
        const eds = getEdges();

        setEditingStep({
            id: node.id,
            name: data.label,
            step_type: data.stepType as any || 'agent',
            config: data.config as any || { parameters: {} },
            depends_on: eds.filter(e => e.target === node.id).map(e => e.source)
        });
    }, [getNode, getEdges]);

    // Listen for workflow progress
    useEffect(() => {
        const setupListener = async () => {
            const unlisten = await tauriApi.onWorkflowProgress((progress: WorkflowProgress) => {
                console.log('Workflow Progress:', progress);
                setNodes((nds) => nds.map((node) => {
                    const data = node.data as StepNodeData;
                    // Reset all other running nodes if this one is running? No, parallel is possible.

                    if (data.label === progress.step_name) {
                        let status: 'Pending' | 'Running' | 'Completed' | 'Failed' = 'Pending';
                        if (progress.status.toLowerCase() === 'running') status = 'Running';
                        else if (progress.status.toLowerCase() === 'completed') status = 'Completed';
                        else if (progress.status.toLowerCase() === 'failed') status = 'Failed';

                        return {
                            ...node,
                            data: {
                                ...data,
                                status: status
                            }
                        };
                    }
                    return node;
                }));
            });
            return unlisten;
        };

        const cleanup = setupListener();
        return () => { cleanup.then(unlisten => unlisten && unlisten()); };
    }, [setNodes]);

    // Initialize graph from workflow steps
    useEffect(() => {
        if (!workflow.steps) return;

        const newNodes: Node[] = workflow.steps.map((step, index) => ({
            id: step.id,
            type: 'step',
            position: { x: index * 300 + 100, y: 150 }, // Initial position if not saved
            data: {
                label: step.name,
                skillName: step.config?.skill_id ? skills.find(s => s.id === step.config.skill_id)?.name : 'No Skill',
                status: 'Pending',
                stepType: step.step_type,
                config: step.config,
                onEdit: () => handleEditStep(step.id)
            }
        }));

        const newEdges: Edge[] = [];
        workflow.steps.forEach(step => {
            step.depends_on?.forEach(depId => {
                newEdges.push({
                    id: `e${depId}-${step.id}`,
                    source: depId,
                    target: step.id,
                    animated: false,
                    label: 'Sequential',
                    style: { stroke: '#94a3b8', strokeWidth: 2 },
                    type: 'default'
                });
            });
        });

        setNodes(newNodes);
        setEdges(newEdges);
        setTimeout(() => fitView(), 100);
    }, [workflow.id, handleEditStep, skills]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({
            ...params,
            animated: false,
            label: 'Sequential',
            style: { stroke: '#94a3b8', strokeWidth: 2 }
        }, eds)),
        [setEdges],
    );

    const handleUpdateStep = (updatedStep: WorkflowStep) => {
        setNodes((nds) => nds.map((node) => {
            if (node.id === updatedStep.id) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        label: updatedStep.name,
                        stepType: updatedStep.step_type,
                        config: updatedStep.config,
                        skillName: updatedStep.config?.skill_id ? skills.find(s => s.id === updatedStep.config.skill_id)?.name : 'No Skill',
                    }
                };
            }
            return node;
        }));
        setEditingStep(null);
    };

    const handleAddStep = () => {
        const id = `step_${Date.now()}`;
        const newNode: Node = {
            id,
            type: 'step',
            position: { x: nodes.length * 300 + 100, y: 150 },
            data: {
                label: `New Step ${nodes.length + 1}`,
                status: 'Pending',
                stepType: 'agent',
                config: { parameters: {} },
                onEdit: () => handleEditStep(id)
            }
        };
        setNodes((nds) => nds.concat(newNode));

        // Automatically zoom out to see all steps
        setTimeout(() => {
            fitView({ duration: 400, padding: 0.2 });
        }, 50);
    };

    const handleMagicGenerated = async (name: string, steps: WorkflowStep[], suggestedSchedule?: WorkflowSchedule) => {
        setDraftName(name);

        const newNodes: Node[] = steps.map((step, index) => ({
            id: step.id,
            type: 'step',
            position: { x: index * 300 + 100, y: 150 },
            data: {
                label: step.name,
                skillName: step.config?.skill_id ? skills.find(s => s.id === step.config.skill_id)?.name : 'No Skill',
                status: 'Pending',
                stepType: step.step_type,
                config: step.config,
                onEdit: () => handleEditStep(step.id)
            }
        }));

        const newEdges: Edge[] = [];
        steps.forEach(step => {
            step.depends_on?.forEach(depId => {
                newEdges.push({
                    id: `e${depId}-${step.id}`,
                    source: depId,
                    target: step.id,
                    animated: false,
                    label: 'Sequential',
                    style: { stroke: '#94a3b8', strokeWidth: 2 },
                    type: 'default'
                });
            });
        });

        setNodes(newNodes);
        setEdges(newEdges);

        setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 100);

        // Auto-save the generated workflow so it's ready to run
        onSave({
            ...workflow,
            name: name,
            project_id: draftProjectId,
            steps: steps,
            schedule: suggestedSchedule ?? workflow.schedule,
            updated: new Date().toISOString()
        });
    };

    const handleSave = () => {
        // Serialize nodes and edges back to WorkflowStep[]
        const serializedSteps: WorkflowStep[] = nodes.map(node => {
            const data = node.data as StepNodeData;
            const incomingEdges = edges.filter(e => e.target === node.id);
            const depends_on = incomingEdges.map(e => e.source);

            return {
                id: node.id,
                name: data.label,
                step_type: data.stepType as any || 'agent',
                config: data.config as any || { parameters: {} },
                depends_on
            };
        });

        onSave({
            ...workflow,
            name: draftName,
            project_id: draftProjectId,
            steps: serializedSteps,
            updated: new Date().toISOString()
        });
    };

    const onEdgeClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
        // Toggle edge style between solid (Sequential) and dashed (Parallel)
        setEdges((eds) => eds.map((e) => {
            if (e.id === edge.id) {
                const isParallel = !e.animated;
                return {
                    ...e,
                    animated: isParallel,
                    label: isParallel ? 'Parallel' : 'Sequential',
                    style: {
                        ...e.style,
                        strokeDasharray: isParallel ? '5,5' : 'none',
                        stroke: isParallel ? '#3b82f6' : '#94a3b8' // Change color slightly for parallel
                    }
                };
            }
            return e;
        }));
    }, [setEdges]);

    const isDraft = workflow.id.startsWith('draft-');

    useEffect(() => {
        if (openScheduleNonce && !isDraft) {
            setShowScheduleDialog(true);
        }
    }, [openScheduleNonce, isDraft]);

    const handleScheduleSave = async (schedule: WorkflowSchedule) => {
        if (isDraft) {
            toast({ title: 'Save required', description: 'Create the workflow first before scheduling.', variant: 'destructive' });
            return;
        }

        try {
            const updated = await tauriApi.setWorkflowSchedule(workflow.project_id, workflow.id, schedule);
            onSave(updated);
            toast({
                title: 'Schedule saved ✅',
                description: `${schedule.cron} • ${schedule.timezone || 'UTC'}`
            });
        } catch (error) {
            toast({
                title: 'Schedule error',
                description: error instanceof Error ? error.message : String(error),
                variant: 'destructive'
            });
        }
    };

    const handleScheduleClear = async () => {
        if (isDraft) return;

        try {
            const updated = await tauriApi.clearWorkflowSchedule(workflow.project_id, workflow.id);
            onSave(updated);
            toast({ title: 'Schedule removed', description: 'Workflow will no longer run automatically.' });
        } catch (error) {
            toast({
                title: 'Schedule error',
                description: error instanceof Error ? error.message : String(error),
                variant: 'destructive'
            });
        }
    };

    const handleToggleSchedule = async () => {
        if (isDraft || !workflow.schedule) return;

        try {
            const updated = await tauriApi.setWorkflowSchedule(workflow.project_id, workflow.id, {
                ...workflow.schedule,
                enabled: !workflow.schedule.enabled,
            });
            onSave(updated);
            toast({ title: updated.schedule?.enabled ? 'Schedule resumed' : 'Schedule paused', description: workflow.name });
        } catch (error) {
            toast({
                title: 'Schedule error',
                description: error instanceof Error ? error.message : String(error),
                variant: 'destructive'
            });
        }
    };

    return (
        <div className="h-full w-full relative bg-gray-50 dark:bg-gray-950 overflow-hidden">
            <WorkflowToolbar
                workflowName={draftName}
                projectName={projects.find(p => p.id === draftProjectId)?.name || projectName}
                projects={projects}
                isDraft={isDraft}
                onNameChange={setDraftName}
                onProjectSelect={setDraftProjectId}
                onSave={handleSave}
                onRun={onRun}
                onAddStep={handleAddStep}
                onZoomIn={() => zoomIn()}
                onZoomOut={() => zoomOut()}
                onFitView={() => fitView()}
                isRunning={isRunning}
                onMagic={() => setShowMagicDialog(true)}
                onSchedule={() => setShowScheduleDialog(true)}
                onEditDetails={() => onEditDetails?.(workflow)}
                scheduleLabel={workflow.schedule?.enabled ? 'Scheduled' : 'Schedule'}
                isScheduleEnabled={!!workflow.schedule?.enabled}
                onToggleSchedule={workflow.schedule ? handleToggleSchedule : undefined}
            />

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                connectionMode={ConnectionMode.Loose}
                colorMode={theme as 'light' | 'dark' | 'system'}
                fitView
            >
                <Background
                    gap={20}
                    size={1}
                    color={theme === 'dark' ? '#1e293b' : '#e2e8f0'}
                />
                <Controls
                    showInteractive={false}
                    className="!bottom-4 !right-4"
                />
            </ReactFlow>

            {editingStep && (
                <StepEditPanel
                    step={editingStep}
                    skills={skills}
                    onSave={handleUpdateStep}
                    onClose={() => setEditingStep(null)}
                    onNewSkill={onNewSkill}
                />
            )}

            <MagicWorkflowDialog
                open={showMagicDialog}
                onOpenChange={setShowMagicDialog}
                onWorkflowGenerated={handleMagicGenerated}
                installedSkills={skills}
            />

            <WorkflowScheduleDialog
                open={showScheduleDialog}
                onOpenChange={setShowScheduleDialog}
                value={workflow.schedule}
                isDraft={isDraft}
                onSave={handleScheduleSave}
                onClear={handleScheduleClear}
            />
        </div>
    );
}

const WorkflowCanvas = (props: WorkflowCanvasProps) => {
    return (
        <ReactFlowProvider>
            <WorkflowCanvasContent {...props} />
        </ReactFlowProvider>
    );
};

export default WorkflowCanvas;
