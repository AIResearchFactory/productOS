import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOverallScore, runArtifactAudit } from '../../lib/critics/index.mjs';

describe('Critic Board Orchestrator Service', () => {
  it('computes overallScore accurately based on penalties', () => {
    const cleanScore = calculateOverallScore([]);
    assert.equal(cleanScore, 100);

    const oneCritOneSugg = calculateOverallScore([
      { severity: 'critical' },
      { severity: 'suggestion' },
    ]);
    assert.equal(oneCritOneSugg, 80); // 100 - 15 - 5 = 80

    const manyCrits = calculateOverallScore([
      { severity: 'critical' },
      { severity: 'critical' },
      { severity: 'critical' },
      { severity: 'critical' },
      { severity: 'critical' },
      { severity: 'critical' },
      { severity: 'critical' },
    ]);
    assert.equal(manyCrits, 0); // Math.max(0, 100 - 105) = 0
  });

  it('runs parallel audit across all 3 critics and aggregates findings', async () => {
    const rawContent = `
# Feature: Notifications
We will build a fast alert system that pushes webhooks immediately.
This will revolutionize workflow speed.
`;
    const result = await runArtifactAudit({
      content: rawContent,
      critics: ['devils_pm', 'telemetry_guardian', 'tone_inspector'],
    });

    assert.ok(typeof result.overallScore === 'number');
    assert.ok(result.overallScore <= 100 && result.overallScore >= 0);
    assert.ok(Array.isArray(result.findings));
    assert.ok(result.findings.length > 0);
    assert.ok(typeof result.summary === 'string');
    assert.ok(typeof result.durationMs === 'number');

    // Check that multiple critic types participated
    const criticTypes = new Set(result.findings.map(f => f.critic));
    assert.ok(criticTypes.size >= 2);
  });

  it('handles custom critic subsets', async () => {
    const rawContent = '# Quick Note\nRevolutionize system.';
    const result = await runArtifactAudit({
      content: rawContent,
      critics: ['tone_inspector'],
    });

    assert.ok(Array.isArray(result.findings));
    for (const f of result.findings) {
      assert.equal(f.critic, 'tone_inspector');
    }
  });

  it('throws when content is empty or invalid', async () => {
    await assert.rejects(
      () => runArtifactAudit({ content: '' }),
      /Content is required/
    );
  });
});
