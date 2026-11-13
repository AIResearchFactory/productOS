import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runTelemetryGuardianHeuristics, runTelemetryCritic } from '../../lib/critics/telemetry-guardian.mjs';

describe('Telemetry Guardian Critic Mini-Agent', () => {
  it('flags missing Primary KPIs and success metrics', () => {
    const content = '# Feature Spec\nWe are building a new button that opens a modal.';
    const findings = runTelemetryGuardianHeuristics(content);
    const kpiFinding = findings.find(f => f.title.includes('Missing Measurable Success Metrics'));
    assert.ok(kpiFinding);
    assert.equal(kpiFinding.critic, 'telemetry_guardian');
    assert.equal(kpiFinding.severity, 'critical');
    assert.ok(kpiFinding.suggestedFix.includes('Primary KPI'));
  });

  it('flags missing event tracking schema when analytics are absent', () => {
    const content = '# PRD: User Settings\nKPI: Increase profile completeness by 20%.';
    const findings = runTelemetryGuardianHeuristics(content);
    const eventFinding = findings.find(f => f.title.includes('Missing Event Tracking Schema'));
    assert.ok(eventFinding);
    assert.equal(eventFinding.severity, 'critical');
  });

  it('suggests guardrail metrics when telemetry is present without circuit breakers', () => {
    const content = '# PRD: Payment Flow\nSuccess Metric: 90% completion.\nTelemetry: Track payment_completed event with PostHog.';
    const findings = runTelemetryGuardianHeuristics(content);
    const guardrailFinding = findings.find(f => f.title.includes('Missing Guardrail Metrics'));
    assert.ok(guardrailFinding);
    assert.equal(guardrailFinding.severity, 'suggestion');
    assert.ok(guardrailFinding.suggestedFix.includes('Error Budget'));
  });

  it('executes AI provider successfully when provided', async () => {
    const mockProvider = {
      async chat() {
        return {
          content: JSON.stringify([
            {
              severity: 'suggestion',
              title: 'Missing Segment Event Property',
              description: 'Needs user_tier property',
              quote: 'track event',
              suggestedFix: 'Add user_tier property',
              targetSection: 'Telemetry',
            },
          ]),
        };
      },
    };

    const findings = await runTelemetryCritic('# Spec\nContent', {}, mockProvider);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].title, 'Missing Segment Event Property');
  });
});
