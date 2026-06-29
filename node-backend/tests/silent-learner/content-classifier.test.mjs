import { test } from 'node:test';
import assert from 'node:assert';
import { classifyFileType } from '../../lib/silent-learner/content-classifier.mjs';

test('Content Classifier - Path-based heuristics', () => {
  // 2.1 File in prds/ directory
  assert.strictEqual(classifyFileType('prds/feature-x.md'), 'prd');
  assert.strictEqual(classifyFileType('/User/project/prds/spec.md'), 'prd');
  assert.strictEqual(classifyFileType('prd-v2.md'), 'prd');

  // 2.2 File in roadmaps/ directory
  assert.strictEqual(classifyFileType('roadmaps/2026.md'), 'roadmap');
  assert.strictEqual(classifyFileType('roadmap.md'), 'roadmap');

  // Other types
  assert.strictEqual(classifyFileType('initiatives/milestone1.md'), 'initiative');
  assert.strictEqual(classifyFileType('user-stories/story-123.md'), 'user-story');
});

test('Content Classifier - Content-based heuristics', () => {
  // 2.3 File with competitive keywords
  const competitiveContent = 'We should review our competitive landscape. Competitor A has higher pricing than Competitor B.';
  assert.strictEqual(classifyFileType('doc.txt', competitiveContent), 'competitive-analysis');

  // 2.4 File with meeting in name (path priority)
  assert.strictEqual(classifyFileType('meeting-june-18.md'), 'meeting-notes');
  // Content with meeting structure
  const meetingContent = '## Attendees\n- Alice\n- Bob\n## Action Items\n- Fix issue';
  assert.strictEqual(classifyFileType('notes.txt', meetingContent), 'meeting-notes');

  // 2.5 File with interview transcript pattern
  const transcriptContent = 'Speaker 1: Hello!\nInterviewer: Welcome to the session.';
  assert.strictEqual(classifyFileType('interview.txt', transcriptContent), 'transcript');

  // Content for "spec" (e.g. ## User Stories)
  const specContent = '## User Stories\nAs a user I want to...';
  assert.strictEqual(classifyFileType('spec.md', specContent), 'spec');

  // 2.6 Plain text with no patterns
  assert.strictEqual(classifyFileType('plain.txt', 'This is some plain text without keywords.'), 'unknown');

  // 2.7 Non-markdown file (.txt) classified by content
  assert.strictEqual(classifyFileType('raw-data.txt', 'Dataset: 123, 456, 789\nCSV format'), 'data');
});
