import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWorkflowOptimizer } from '../src/components/workflow/optimizerModel.js';

test('calculateWorkflowOptimizer returns low risk for modest plan', () => {
  const result = calculateWorkflowOptimizer({
    itemCount: 4,
    fanoutSteps: 2,
    perTaskRamMb: 200,
    globalMaxParallel: 0,
    cpuCores: 8,
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.projectedWorkers, 8);
  assert.ok(result.recommendedGlobalParallel >= 2);
});

test('calculateWorkflowOptimizer returns high risk when fanout and RAM are extreme', () => {
  const result = calculateWorkflowOptimizer({
    itemCount: 20,
    fanoutSteps: 12,
    perTaskRamMb: 9000,
    globalMaxParallel: 2,
    cpuCores: 4,
  });

  assert.equal(result.risk, 'high');
  assert.ok(result.issues.length >= 2);
  assert.equal(result.effectiveParallel, 2);
});
