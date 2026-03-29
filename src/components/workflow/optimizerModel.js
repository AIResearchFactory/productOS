export function calculateWorkflowOptimizer({
  itemCount = 10,
  fanoutSteps = 5,
  perTaskRamMb = 220,
  globalMaxParallel = 0,
  cpuCores = 8,
}) {
  const projectedWorkers = itemCount * fanoutSteps;
  const recommendedGlobalParallel = Math.max(2, Math.min(8, Math.ceil(cpuCores * 0.75)));
  const effectiveParallel = globalMaxParallel > 0 ? globalMaxParallel : recommendedGlobalParallel;
  const projectedPeakRamMb = effectiveParallel * perTaskRamMb;

  const issues = [];
  if (projectedWorkers > effectiveParallel * 3) {
    issues.push(`High fanout (${projectedWorkers} work units). Add batching or step caps.`);
  }
  if (projectedPeakRamMb > 16000) {
    issues.push(`Projected RAM ${projectedPeakRamMb}MB may be too high for many machines.`);
  }

  const risk = issues.length >= 2 ? 'high' : issues.length === 1 ? 'medium' : 'low';

  return {
    projectedWorkers,
    recommendedGlobalParallel,
    effectiveParallel,
    projectedPeakRamMb,
    risk,
    issues,
  };
}
