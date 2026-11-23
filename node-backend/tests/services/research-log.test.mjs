import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChatFileTimestamp,
  parseResearchLog,
} from '../../lib/research-log.mjs';

test('parseChatFileTimestamp extracts correct timestamp from chat filename', () => {
  const fileName = 'chat_2026-10-08T01-23-10-109Z.md';
  const timestamp = parseChatFileTimestamp(fileName);
  assert.ok(timestamp !== null);
  const date = new Date(timestamp);
  assert.equal(date.toISOString(), '2026-10-08T01:23:10.109Z');
});

test('parseResearchLog correctly parses entries with and without Chat File', () => {
  const logContent = `# Research Log: Test Project

This file tracks automatic agent interactions and observations.

---
### Interaction: 2026-10-08T01:23:10.109Z
**Provider**: E4541C84-CEF1-4AE1-B848-8C233AA51788
**Chat File**: chat_2026-10-08T01-23-10-109Z.md
**Command**: \`analyze storyline\`
#### Agent Output:
Let me read the storyline file.

---
### Interaction: 2026-10-07T21:16:16.203Z
**Provider**: claudeCode
#### Agent Output:
This is excellent signal.
`;

  const entries = parseResearchLog(logContent);
  assert.equal(entries.length, 2);

  assert.equal(entries[0].timestamp, '2026-10-08T01:23:10.109Z');
  assert.equal(entries[0].provider, 'E4541C84-CEF1-4AE1-B848-8C233AA51788');
  assert.equal(entries[0].chatFile, 'chat_2026-10-08T01-23-10-109Z.md');
  assert.equal(entries[0].command, 'analyze storyline');
  assert.equal(entries[0].content, 'Let me read the storyline file.');

  assert.equal(entries[1].timestamp, '2026-10-07T21:16:16.203Z');
  assert.equal(entries[1].provider, 'claudeCode');
  assert.equal(entries[1].chatFile, null);
  assert.equal(entries[1].command, null);
  assert.equal(entries[1].content, 'This is excellent signal.');
});

test('parseResearchLog parses **Attachments** metadata line while preserving legacy entries', () => {
  const logContent = `# Research Log: Test Project

---
### Interaction: 2026-11-22T12:00:00.000Z
**Provider**: hostedApi
**Chat File**: chat_2026-11-22T12-00-00-000Z.md
**Attachments**: 2 attachments: slide-1.png, chart.jpg
#### Agent Output:
Here is the visual summary.
`;
  const entries = parseResearchLog(logContent);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].attachmentSummary, '2 attachments: slide-1.png, chart.jpg');
  assert.deepEqual(entries[0].attachments, ['slide-1.png', 'chart.jpg']);
  assert.equal(entries[0].content, 'Here is the visual summary.');
});
