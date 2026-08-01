/**
 * scripts/silent-learner-demo.mjs
 * End-to-end scenario runner for Silent Learner.
 * Simulates a full product development cycle:
 *   1. Initializing a new project.
 *   2. Stage 1-3 progressive enrichment on workspace artifacts.
 *   3. Capturing AI interactions (successful PM chats).
 *   4. Detecting and handling privacy violations (secrets).
 *   5. Memory distillation & memory pack generation.
 *   6. Context retrieval and prompt injection.
 *   7. Educated answer mock based on context.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject, deleteProject } from '../node-backend/lib/projects.mjs';
import * as SilentLearner from '../node-backend/lib/silent-learner/index.mjs';
import * as Store from '../node-backend/lib/silent-learner/learning-store.mjs';
import { getSidecarPath } from '../node-backend/lib/paths.mjs';
import { enrichImmediate, queueEnrichment, drainEnrichmentQueue } from '../node-backend/lib/silent-learner/enrichment.mjs';

function banner(title) {
  console.log('\n' + '='.repeat(80));
  console.log(`🚀 ${title.toUpperCase()}`);
  console.log('='.repeat(80));
}

async function runScenario() {
  // 1. Isolate environment to a temporary test folder
  const tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productos-silent-learner-demo-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  process.env.APP_DATA_DIR = path.join(tempProjectsDir, 'app-data');
  process.env.ALLOW_UNENCRYPTED_SECRETS_FOR_TESTS = 'true';

  await fs.mkdir(process.env.APP_DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(process.env.APP_DATA_DIR, 'settings.json'),
    JSON.stringify({ activeProvider: 'none' }),
    'utf8'
  );

  console.log(`Sandbox projects directory initialized at: ${tempProjectsDir}`);

  try {
    // 2. Create the demo project
    banner('Step 1: Create a New Project');
    const project = await createProject(
      'Cloud Analytics SaaS', 
      'Build a cloud analytics SaaS dashboard targeting enterprise clients'
    );
    console.log(`Project Created: "${project.name}" (ID: ${project.id})`);
    console.log(`Project Path: ${project.path}`);

    // Enable Silent Learner on this project
    await SilentLearner.enable(project.id);
    console.log(`Silent Learner state for project: ${await SilentLearner.getState(project.id)}`);

    // 3. Create initial workspace files (Artifacts)
    banner('Step 2: Initialize Artifacts & Build Metadata/Relations (Enrichment Stages)');

    // Artifact A: Roadmap
    const roadmapRel = 'roadmaps/product-roadmap.md';
    const roadmapPath = path.join(project.path, roadmapRel);
    await fs.mkdir(path.dirname(roadmapPath), { recursive: true });
    await fs.writeFile(
      roadmapPath,
      `# Cloud Analytics SaaS Roadmap\n\n## Vision\nDeliver lightning-fast analytics querying for cloud data warehouses.\n\n## Core Themes\n- **Theme A (Telemetry)**: Enable real-time telemetry pipelines and alerts.\n- **Theme B (Billing)**: Implement subscription plans and stripe payment gateway.`,
      'utf8'
    );

    // Artifact B: PRD (Telemetry alerts related to roadmap)
    const prdRel = 'prds/telemetry-alerts.md';
    const prdPath = path.join(project.path, prdRel);
    await fs.mkdir(path.dirname(prdPath), { recursive: true });
    await fs.writeFile(
      prdPath,
      `# Telemetry Alerts Specification\n\n## Overview\nThis PRD covers the specification for alerts based on real-time telemetry.\n\n## Requirements\n- Must ingest 100k events/sec.\n- Send push notifications on telemetry threshold alerts.\n- Must link with our core telemetry roadmap.`,
      'utf8'
    );

    // Artifact C: Competitor Strategy (Unaligned file)
    const competitorRel = 'competitive-research/competitors.md';
    const competitorPath = path.join(project.path, competitorRel);
    await fs.mkdir(path.dirname(competitorPath), { recursive: true });
    await fs.writeFile(
      competitorPath,
      `# Competitive Analysis\n\n## Summary\nReview of industry giants Datadog and Dynatrace metrics offering.\n\n## Pricing\nBoth competitors price based on host count.`,
      'utf8'
    );

    console.log('Created markdown files:');
    console.log(`  - [Roadmap] ${roadmapRel}`);
    console.log(`  - [PRD] ${prdRel}`);
    console.log(`  - [Competitive] ${competitorRel}`);

    // Trigger progressive enrichment pipeline
    console.log('\nRunning Stage 1 (Immediate Enrichment) and queuing background stages...');
    for (const rel of [roadmapRel, prdRel, competitorRel]) {
      await enrichImmediate(project.id, rel);
      queueEnrichment(project.id, rel);
    }

    // Wait for the background queue to drain (Stage 2: Deep, Stage 3: Relational)
    await drainEnrichmentQueue();
    console.log('progressive enrichment queue drained. Checking generated sidecar JSONs...');

    // View metadata sidecar for PRD
    const prdSidecarPath = path.join(project.path, getSidecarPath(prdRel));
    const prdSidecar = JSON.parse(await fs.readFile(prdSidecarPath, 'utf8'));
    console.log('\n📄 Generated Sidecar for telemetry-alerts.md:');
    console.log(JSON.stringify(prdSidecar, null, 2));

    // Notice that:
    // - relatedConcepts (entities like Telemetry, Alerts, etc.) were extracted.
    // - sourceRefs contains the linked files (it should link to the roadmap since both mention 'telemetry' concepts).
    // - compositeScore was calculated based on metadata.

    // 4. File Observations during work
    banner('Step 3: Simulate User Navigating/Editing Files (observeFile)');
    console.log(`User opens and views the roadmap file: ${roadmapRel}`);
    await SilentLearner.observeFile(project.id, roadmapRel);

    console.log(`User views the PRD spec: ${prdRel}`);
    await SilentLearner.observeFile(project.id, prdRel);
    await SilentLearner.observeFile(project.id, prdRel); // Observed twice!

    // Flush the usage cache to SQLite immediately
    await SilentLearner.flushAll();

    // Verify database scores updated
    const fileScores = await Store.getTopScoredFiles(project.id, 10);
    console.log('\n📊 SQLite File Scores (tracking usage count & last modified):');
    console.table(fileScores.map(f => ({
      file: f.file_path,
      usage: f.usage_count,
      score: f.computed_score.toFixed(3)
    })));

    // 5. Simulate AI Interactions & Privacy Filter
    banner('Step 4: Simulate AI Chats (captureEvent & Privacy scan)');

    console.log('Capturing interactive events to build learning memory...');

    // Event A: Success (PM creates user stories)
    const eventParamsA = {
      projectId: project.id,
      sessionId: 'chat-session-001',
      provider: 'claudeCode',
      messages: [
        { role: 'user', content: 'Help me draft user stories for telemetry thresholds alert features' }
      ],
      result: {
        content: 'I have created user stories for the telemetry alerts system.\nFILE: user-stories/telemetry-alerts.md\n```md\n# User Stories\nAs a dev, I want threshold notifications...\n```',
        metadata: { model_used: 'claude-3.5-sonnet', tokens_in: 250, tokens_out: 400 }
      },
      fileChanges: ['user-stories/telemetry-alerts.md'],
      artifactChanges: []
    };
    
    // Physically create the file so background enrichment succeeds
    const userStoriesPath = path.join(project.path, 'user-stories/telemetry-alerts.md');
    await fs.mkdir(path.dirname(userStoriesPath), { recursive: true });
    await fs.writeFile(userStoriesPath, '# User Stories\nAs a dev, I want threshold notifications...', 'utf8');

    const captureResultA = await SilentLearner.captureEvent(eventParamsA);
    console.log(`Capture Event A (Success): ${JSON.stringify(captureResultA)}`);

    // Event B: Success (Roadmap edit)
    const eventParamsB = {
      projectId: project.id,
      sessionId: 'chat-session-001',
      provider: 'claudeCode',
      messages: [
        { role: 'user', content: 'Add Telemetry Phase 2 timeline in roadmaps/product-roadmap.md' }
      ],
      result: {
        content: 'Updated roadmap.\nUPDATE: roadmaps/product-roadmap.md\n```md\n# Cloud Analytics SaaS Roadmap\nPhase 2 added...\n```',
        metadata: { model_used: 'claude-3.5-sonnet', tokens_in: 300, tokens_out: 500 }
      },
      fileChanges: ['roadmaps/product-roadmap.md'],
      artifactChanges: []
    };
    await SilentLearner.captureEvent(eventParamsB);

    // Event C: Success (Another PM task to meet the minimum threshold of 3 for distillation)
    const eventParamsC = {
      projectId: project.id,
      sessionId: 'chat-session-001',
      provider: 'claudeCode',
      messages: [
        { role: 'user', content: 'Draft a PRD outline for telemetry' }
      ],
      result: {
        content: 'Outline for telemetry created: \nFILE: prds/telemetry-outline.md\n```md\n# Telemetry Outline\n...\n```',
        metadata: { model_used: 'claude-3.5-sonnet' }
      },
      fileChanges: ['prds/telemetry-outline.md'],
      artifactChanges: []
    };
    
    // Physically create the file so background enrichment succeeds
    const outlinePath = path.join(project.path, 'prds/telemetry-outline.md');
    await fs.mkdir(path.dirname(outlinePath), { recursive: true });
    await fs.writeFile(outlinePath, '# Telemetry Outline\n- Ingestion\n- Processing', 'utf8');

    await SilentLearner.captureEvent(eventParamsC);

    // Event D: Privacy Failure (User accidentally inputs API Key)
    const eventParamsD = {
      projectId: project.id,
      sessionId: 'chat-session-002',
      provider: 'claudeCode',
      messages: [
        { role: 'user', content: 'Please configure our service with API KEY: sk-proj-1234567890abcdef1234567890abcdef' }
      ],
      result: {
        content: 'This request cannot be completed because API keys should never be shared or pasted into the chat prompt. Please verify security guidelines.',
        metadata: { model_used: 'claude-3.5-sonnet', responseLength: 140 }
      },
      fileChanges: [],
      artifactChanges: []
    };
    const captureResultD = await SilentLearner.captureEvent(eventParamsD);
    console.log(`\nCapture Event D (API Key Leak): ${JSON.stringify(captureResultD)}`);
    console.log(`Silent Learner state after leak: ${await SilentLearner.getState(project.id)}`);

    // Resume Silent Learner to complete the scenario
    console.log('Resuming Silent Learner for the remaining demo steps...');
    await SilentLearner.enable(project.id);

    // 6. Memory Distillation (buildMemory)
    banner('Step 5: Memory Distillation (distill logs into memory packs)');
    console.log('Building memory packs from qualifying safe events...');
    const buildResult = await SilentLearner.buildMemory(project.id);
    console.log(`Memory Packs Built: ${JSON.stringify(buildResult)}`);

    const status = await SilentLearner.getStatus(project.id);
    console.log('\n📈 Silent Learner Status & Memory Packs Summary:');
    console.log(JSON.stringify(status, null, 2));

    // 7. Context Retrieval & Prompt Augmentation
    banner('Step 6: Context Retrieval & Prompt Injection (retrieveContext)');
    console.log('Simulating a new task: "Write API endpoints to emit alerts for our telemetry analytics dashboard"');

    const context = await SilentLearner.retrieveContext(project.id, {
      taskDescription: 'Write API endpoints to emit alerts for our telemetry analytics dashboard',
      maxTokens: 1000
    });

    console.log('\n🎯 Retrieved Context Block for AI Prompt Injection:');
    console.log(context.contextBlock);
    console.log('Stats:');
    console.log(JSON.stringify(context.stats, null, 2));

    // 8. Educated Answer (Mock AI Output)
    banner('Step 7: Educated Answer Generation (Mock AI response using Context)');
    console.log(`Based on the injected context, the AI knows:
- High-relevance workspace file: ${context.filesUsed.join(', ')}
- The telemetry roadmap and alerts specifications exist.
- Past successful tasks involved: telemetry alerts, roadmaps, outline.
- Avoiding dangerous file exposures.

Answer:
"I noticed that you are working on telemetry dashboard alerts. 
Based on the existing spec in 'prds/telemetry-alerts.md' and the 'roadmaps/product-roadmap.md', 
we need our API endpoint to support ingestion of up to 100k events/sec and push notification triggers on telemetry threshold events. 
I will design the API router matching these specifications..."`);

  } finally {
    // 9. Cleanup sandbox
    banner('Cleanup');
    console.log('Draining background enrichment queue and shutting down services...');
    await drainEnrichmentQueue();
    await SilentLearner.shutdown();
    
    console.log(`Deleting temporary sandbox: ${tempProjectsDir}`);
    await fs.rm(tempProjectsDir, { recursive: true, force: true });
    console.log('Sandbox removed successfully.');
  }
}

runScenario().catch(err => {
  console.error('Scenario failed with error:', err);
});
