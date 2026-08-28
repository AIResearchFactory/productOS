import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject, deleteProject } from '../../lib/projects.mjs';
import * as Store from '../../lib/silent-learner/learning-store.mjs';

describe('LearningStore Critic Feedback & Socratic Decision Recording', () => {
  let tmpDir;
  let project;
  let origEnv;

  beforeEach(async () => {
    origEnv = process.env.PROJECTS_DIR;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-feedback-'));
    process.env.PROJECTS_DIR = tmpDir;
    process.env.APP_DATA_DIR = path.join(tmpDir, 'app-data');
    await fs.mkdir(process.env.APP_DATA_DIR, { recursive: true });
    await fs.writeFile(
      path.join(process.env.APP_DATA_DIR, 'settings.json'),
      JSON.stringify({ activeProvider: 'none' }),
      'utf8'
    );
    project = await createProject('Feedback Test Project', tmpDir);
    await Store.getDatabase(project.id);
  });

  afterEach(async () => {
    if (project) {
      await Store.destroyAll(project.id).catch(() => {});
      await deleteProject(project.id).catch(() => {});
    }
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    delete process.env.APP_DATA_DIR;
    if (origEnv !== undefined) {
      process.env.PROJECTS_DIR = origEnv;
    } else {
      delete process.env.PROJECTS_DIR;
    }
  });

  describe('recordCriticFeedback', () => {
    it('records applied feedback in SQLite and updates learned-preferences.md', async () => {
      const feedback = {
        findingId: 'crit-devils-1234',
        action: 'applied',
        critic: 'devils_pm',
        finding: {
          title: 'Missing Rate Limit',
          suggestedFix: 'Implement exponential backoff retry with 3 attempts',
        },
      };

      const res = await Store.recordCriticFeedback(project.id, feedback);
      assert.equal(res.success, true);
      assert.equal(res.updatedRulesCount, 1);

      // Verify SQLite event
      const events = await Store.getEvents(project.id, { source: 'critic_feedback' });
      assert.equal(events.length, 1);
      assert.equal(events[0].accepted_changes, true);
      assert.equal(events[0].metadata.findingId, 'crit-devils-1234');
      assert.equal(events[0].metadata.critic, 'devils_pm');

      // Verify learned-preferences.md file
      const prefPath = path.join(project.path, '.metadata', '_context', 'learned-preferences.md');
      const content = await fs.readFile(prefPath, 'utf8');
      assert.ok(content.includes('devils_pm'));
      assert.ok(content.includes('Missing Rate Limit'));
      assert.ok(content.includes('Implement exponential backoff'));
    });

    it('records dismissed feedback in SQLite without modifying preferences if no rule', async () => {
      const feedback = {
        findingId: 'crit-tone-5678',
        action: 'dismissed',
        critic: 'tone_inspector',
      };

      const res = await Store.recordCriticFeedback(project.id, feedback);
      assert.equal(res.success, true);
      assert.equal(res.updatedRulesCount, 0);

      const events = await Store.getEvents(project.id, { source: 'critic_feedback' });
      assert.equal(events.length, 1);
      assert.equal(events[0].accepted_changes, false);
    });

    it('prevents duplicate rule lines in learned-preferences.md', async () => {
      const feedback = {
        findingId: 'crit-devils-1',
        action: 'applied',
        critic: 'devils_pm',
        learnedRule: 'Always specify HTTP timeout SLAs',
      };

      const first = await Store.recordCriticFeedback(project.id, feedback);
      assert.equal(first.updatedRulesCount, 1);

      const second = await Store.recordCriticFeedback(project.id, feedback);
      assert.equal(second.updatedRulesCount, 0);

      const prefPath = path.join(project.path, '.metadata', '_context', 'learned-preferences.md');
      const content = await fs.readFile(prefPath, 'utf8');
      const matches = content.split('Always specify HTTP timeout SLAs').length - 1;
      assert.equal(matches, 1);
    });
  });

  describe('recordSocraticDecision', () => {
    it('records decisions and allows multiple distinct questions with the same answer', async () => {
      const decision1 = {
        artifactType: 'prd',
        questionId: 'q-storage',
        question: 'Which database engine should be used for persistence?',
        answer: 'PostgreSQL',
        mode: 'adversarial',
      };

      const decision2 = {
        artifactType: 'prd',
        questionId: 'q-queue',
        question: 'Which backend should back the task queue?',
        answer: 'PostgreSQL',
        mode: 'adversarial',
      };

      await Store.recordSocraticDecision(project.id, decision1);
      await Store.recordSocraticDecision(project.id, decision2);

      // Verify SQLite events
      const events = await Store.getEvents(project.id, { source: 'socratic_interrogator' });
      assert.equal(events.length, 2);

      // Verify learned-preferences.md contains BOTH distinct questions despite same answer
      const prefPath = path.join(project.path, '.metadata', '_context', 'learned-preferences.md');
      const content = await fs.readFile(prefPath, 'utf8');
      assert.ok(content.includes('Which database engine should be used for persistence?'));
      assert.ok(content.includes('Which backend should back the task queue?'));
      assert.ok(content.includes('**PostgreSQL**'));
    });

    it('ignores "decide for me" default answers for preference updates', async () => {
      const decision = {
        artifactType: 'prd',
        questionId: 'q-auth',
        question: 'What auth mechanism to use?',
        answer: 'Decide for me based on best practices',
        mode: 'collaborative',
      };

      await Store.recordSocraticDecision(project.id, decision);

      const prefPath = path.join(project.path, '.metadata', '_context', 'learned-preferences.md');
      const exists = await fs.access(prefPath).then(() => true).catch(() => false);
      assert.equal(exists, false);
    });
  });
});
