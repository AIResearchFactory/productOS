import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Zap, Activity, FileText, Settings, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface StepNodeData {
    label: string;
    skillName?: string;
    status?: 'Pending' | 'Running' | 'Completed' | 'Failed';
    onEdit?: () => void;
    stepType?: string;
    [key: string]: unknown;
}

const StepNode = memo(({ data, selected }: NodeProps<any>) => {
    const { label, skillName, status, onEdit, stepType } = data as StepNodeData;

    const getStatusColor = () => {
        switch (status) {
            case 'Running': return 'border-blue-500 shadow-blue-500/20';
            case 'Completed': return 'border-green-500 shadow-green-500/20';
            case 'Failed': return 'border-red-500 shadow-red-500/20';
            default: return selected ? 'border-primary' : 'border-gray-200 dark:border-gray-700';
        }
    };

    const getIcon = () => {
        switch (stepType) {
            case 'input': return FileText;
            case 'iteration': return Activity;
            case 'SubAgent': return Activity;
            case 'conditional': return Type;
            default: return Zap;
        }
    };

    const Icon = getIcon();

    return (
        <div className={`
      relative min-w-[200px] rounded-lg border-2 bg-white dark:bg-gray-900 
      transition-all duration-200 shadow-sm hover:shadow-md
      ${getStatusColor()}
    `}>
            {/* Input Handle */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Input</span>
                <Handle
                    type="target"
                    position={Position.Top}
                    className="!w-3 !h-3 !bg-gray-400 dark:!bg-gray-500 !static !translate-y-0"
                />
            </div>

            <div className="p-3">
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-md ${status === 'Running' ? 'animate-pulse bg-blue-100 text-blue-700' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">{label}</h3>
                        {skillName && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{skillName}</p>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="space-y-1">
                    {status && (
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider">
                            <span className={`w-1.5 h-1.5 rounded-full ${status === 'Running' ? 'bg-blue-500 animate-pulse' :
                                status === 'Completed' ? 'bg-green-500' :
                                    status === 'Failed' ? 'bg-red-500' : 'bg-gray-300'
                                }`} />
                            <span className={
                                status === 'Running' ? 'text-blue-600' :
                                    status === 'Completed' ? 'text-green-600' :
                                        status === 'Failed' ? 'text-red-600' : 'text-gray-500'
                            }>
                                {status}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions (visible on hover/select) */}
            <div className="border-t border-gray-100 dark:border-gray-800 p-1 flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                }}>
                    <Settings className="w-3 h-3 text-gray-500" />
                </Button>
            </div>

            {/* Output Handle */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <Handle
                    type="source"
                    position={Position.Bottom}
                    className="!w-3 !h-3 !bg-gray-400 dark:!bg-gray-500 !static !translate-y-0"
                />
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tighter">Output</span>
            </div>
        </div>
    );
});

export default StepNode;
