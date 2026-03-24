export interface WorkflowOptimizerInput {
  competitorCount?: number;
  fanoutSteps?: number;
  perTaskRamMb?: number;
  globalMaxParallel?: number;
  cpuCores?: number;
}

export interface WorkflowOptimizerResult {
  projectedWorkers: number;
  recommendedGlobalParallel: number;
  effectiveParallel: number;
  projectedPeakRamMb: number;
  risk: 'low' | 'medium' | 'high';
  issues: string[];
}

export function calculateWorkflowOptimizer(input: WorkflowOptimizerInput): WorkflowOptimizerResult;
