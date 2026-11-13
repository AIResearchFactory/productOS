import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runDevilsPMHeuristics, runDevilsPMCritic, parseFindingsJson } from '../../lib/critics/devils-pm.mjs';

describe('Devils PM Critic Mini-Agent', () => {
  it('detects vague non-functional adjectives in specification without silent truncation', () => {
    const content = '# Feature Spec\nThe dashboard must be fast, scalable, and intuitive for users.';
    const findings = runDevilsPMHeuristics(content);
    const vagueTerms = findings.filter(f => f.title.includes('Vague Non-Functional Term'));
    assert.equal(vagueTerms.length, 3);
    const fastFinding = vagueTerms.find(f => f.quote === 'fast');
    const scalableFinding = vagueTerms.find(f => f.quote === 'scalable');
    const intuitiveFinding = vagueTerms.find(f => f.quote === 'intuitive');
    assert.ok(fastFinding);
    assert.ok(scalableFinding);
    assert.ok(intuitiveFinding);
    assert.equal(fastFinding.severity, 'suggestion');
    assert.ok(fastFinding.suggestedFix.includes('200ms'));
  });

  it('detects missing rate limit and dead-letter queue in webhook specs', () => {
    const content = '# Webhook Architecture\nSlack webhook alerts are pushed immediately upon event occurrence.';
    const findings = runDevilsPMHeuristics(content);
    const missingDlq = findings.find(f => f.title.includes('Missing Rate Limit'));
    assert.ok(missingDlq);
    assert.equal(missingDlq.severity, 'critical');
    assert.ok(missingDlq.suggestedFix.includes('exponential backoff'));
  });

  it('detects missing database migration rollback plans', () => {
    const content = '# Data Layer\nWe will run a database migration to alter the users table.';
    const findings = runDevilsPMHeuristics(content);
    const rollbackFinding = findings.find(f => f.title.includes('Rollback Plan'));
    assert.ok(rollbackFinding);
    assert.equal(rollbackFinding.severity, 'critical');
  });

  it('parses structured JSON findings correctly', () => {
    const jsonStr = `Here are the findings:
\`\`\`json
[
  {
    "severity": "critical",
    "title": "Missing Auth Scope",
    "description": "API does not check scopes.",
    "quote": "GET /users",
    "suggestedFix": "Require read:users scope",
    "targetSection": "Security"
  }
]
\`\`\``;
    const parsed = parseFindingsJson(jsonStr, 'devils_pm');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].title, 'Missing Auth Scope');
    assert.equal(parsed[0].severity, 'critical');
    assert.equal(parsed[0].critic, 'devils_pm');
  });

  it('uses mock AI provider when available', async () => {
    const mockProvider = {
      async chat() {
        return {
          content: JSON.stringify([
            {
              severity: 'critical',
              title: 'AI Detected Flaw',
              description: 'High risk flaw',
              quote: 'flawed line',
              suggestedFix: 'fixed line',
              targetSection: 'Architecture',
            },
          ]),
        };
      },
    };

    const findings = await runDevilsPMCritic('# Spec\nContent', {}, mockProvider);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].title, 'AI Detected Flaw');
  });
});
