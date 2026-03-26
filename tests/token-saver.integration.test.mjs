import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeMessagesForSend } from '../src/lib/tokenSaver.js';

test('token saver compacts long histories while preserving recent turns', () => {
  const messages = [
    { role: 'system', content: 'You are a product copilot.' },
    { role: 'user', content: 'Context A '.repeat(120) },
    { role: 'assistant', content: 'Ack A' },
    { role: 'user', content: 'Context B '.repeat(120) },
    { role: 'assistant', content: 'Ack B' },
    { role: 'user', content: 'Context C '.repeat(120) },
    { role: 'assistant', content: 'Ack C' },
    { role: 'user', content: 'Final ask: summarize risks and decisions.' }
  ];

  const result = optimizeMessagesForSend(messages, { keepRecentTurns: 4 });

  assert.ok(result.receipt.saved_tokens > 0);
  assert.ok(result.receipt.input_tokens_optimized < result.receipt.input_tokens_raw);
  const summaryMsg = result.messages.find((m) => String(m.content).startsWith('Compressed context summary'));
  assert.ok(summaryMsg);
  assert.equal(summaryMsg.role, 'assistant');
  assert.equal(result.messages.filter((m) => m.role === 'system').length, 1);
  assert.equal(result.messages[result.messages.length - 1].content, 'Final ask: summarize risks and decisions.');
});

test('token saver does not modify short conversation', () => {
  const messages = [
    { role: 'system', content: 'System' },
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello' }
  ];

  const result = optimizeMessagesForSend(messages, { keepRecentTurns: 6 });
  assert.equal(result.receipt.saved_tokens, 0);
  assert.deepEqual(result.messages, messages);
});
