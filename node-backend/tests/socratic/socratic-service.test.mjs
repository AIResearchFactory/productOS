import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSocraticArtifactIntent,
  getSocraticQuestionsForArtifact,
  formatAssumptionsSection,
} from '../../lib/socratic/index.mjs';

describe('Socratic Interrogator Service', () => {
  it('detects slash command /grill-me triggers', () => {
    const res = detectSocraticArtifactIntent('/grill-me Create a PRD for Slack alerts');
    assert.equal(res.isHighStakesArtifact, true);
    assert.equal(res.artifactType, 'prd');
    assert.equal(res.triggerMode, 'slash_command');
    assert.ok(res.topic.includes('Slack alerts'));
  });

  it('detects high-stakes PRD intent from natural language', () => {
    const res = detectSocraticArtifactIntent('Create a PRD for Slack notifications');
    assert.equal(res.isHighStakesArtifact, true);
    assert.equal(res.artifactType, 'prd');
    assert.equal(res.triggerMode, 'intent_detected');
  });

  it('detects Roadmap intent from natural language', () => {
    const res = detectSocraticArtifactIntent('Draft a product roadmap for Q3 and Q4');
    assert.equal(res.isHighStakesArtifact, true);
    assert.equal(res.artifactType, 'roadmap');
    assert.equal(res.triggerMode, 'intent_detected');
  });

  it('detects User Story intent from natural language', () => {
    const res = detectSocraticArtifactIntent('Write a user story for authentication flow');
    assert.equal(res.isHighStakesArtifact, true);
    assert.equal(res.artifactType, 'user_story');
    assert.equal(res.triggerMode, 'intent_detected');
  });

  it('ignores conversational casual prompts', () => {
    const res = detectSocraticArtifactIntent('What is the weather today?');
    assert.equal(res.isHighStakesArtifact, false);
    assert.equal(res.artifactType, null);
  });

  it('returns structured questions with quick-select options for each artifact type', () => {
    const prdQuestions = getSocraticQuestionsForArtifact('prd');
    assert.ok(prdQuestions.length >= 3);
    for (const q of prdQuestions) {
      assert.ok(q.id);
      assert.ok(q.question);
      assert.ok(Array.isArray(q.quickOptions));
      assert.ok(q.quickOptions.some(opt => opt.includes('Decide for me')));
    }
  });

  it('synthesizes assumptions block correctly with user and default choices', () => {
    const answeredTurns = [
      {
        questionId: 'q_rate_limits',
        question: 'What scale and rate limits should we design for at launch?',
        answer: '100 req/min (Standard)',
      },
      {
        questionId: 'q_failure_mode',
        question: 'How should the system behave if downstream services or webhooks fail?',
        answer: 'Decide for me',
        defaultAssumption: 'Retry failed dispatches up to 3 times with exponential backoff.',
      },
    ];

    const block = formatAssumptionsSection(answeredTurns, 'prd');
    assert.ok(block.includes('## Assumptions & Technical Defaults'));
    assert.ok(block.includes('100 req/min (Standard)** (User Confirmed)'));
    assert.ok(block.includes('Defaulted'));
    assert.ok(block.includes('Retry failed dispatches up to 3 times with exponential backoff'));
  });
});
