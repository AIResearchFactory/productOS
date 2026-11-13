import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runToneInspectorHeuristics, runToneInspectorCritic } from '../../lib/critics/tone-inspector.mjs';

describe('Tone Inspector Critic Mini-Agent', () => {
  it('flags project-level avoided keywords as critical', () => {
    const content = '# Specification\nThis provides a seamless integration with our core platform.';
    const context = {
      avoidedKeywords: ['seamless integration', 'game-changer'],
    };
    const findings = runToneInspectorHeuristics(content, context);
    const forbidden = findings.find(f => f.title.includes('Forbidden Term'));
    assert.ok(forbidden);
    assert.equal(forbidden.severity, 'critical');
    assert.equal(forbidden.critic, 'tone_inspector');
  });

  it('flags common AI marketing buzzwords as suggestions', () => {
    const content = '# Roadmap\nThis initiative will revolutionize how users interact and supercharge team velocity.';
    const findings = runToneInspectorHeuristics(content, {});
    const buzzwords = findings.filter(f => f.title.includes('AI Cliché'));
    assert.ok(buzzwords.length >= 2);
    assert.ok(buzzwords.some(b => b.quote.toLowerCase().includes('revolutionize')));
    assert.ok(buzzwords.some(b => b.quote.toLowerCase().includes('supercharge')));
  });

  it('passes cleanly when document has crisp, professional engineering prose', () => {
    const content = '# Architecture Specification\nDirect HTTP API connection with TLS 1.3 encryption and exponential retry backoff.';
    const findings = runToneInspectorHeuristics(content, { avoidedKeywords: ['magic', 'effortless'] });
    assert.equal(findings.length, 0);
  });
});
