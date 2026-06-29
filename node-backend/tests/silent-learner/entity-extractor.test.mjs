import { test } from 'node:test';
import assert from 'node:assert';
import { extractEntitiesHeuristic, extractEntitiesAI } from '../../lib/silent-learner/entity-extractor.mjs';

test('Entity Extractor - Heuristics', () => {
  // 3.1 Extract capitalized multi-word terms
  const textCapitalized = 'I launched Product Hunt today and started using Silent Learner.';
  const res1 = extractEntitiesHeuristic(textCapitalized);
  assert.ok(res1.entities.includes('Product Hunt'));
  assert.ok(res1.entities.includes('Silent Learner'));

  // 3.2 Extract @mentions
  const textMentions = 'Please notify @competitor-x and @team-lead of these changes.';
  const res2 = extractEntitiesHeuristic(textMentions);
  assert.ok(res2.entities.includes('@competitor-x'));
  assert.ok(res2.entities.includes('@team-lead'));

  // 3.3 Extract URLs
  const textUrls = 'Read the documentation at https://example.com/docs, and also check out http://google.com.';
  const res3 = extractEntitiesHeuristic(textUrls);
  assert.ok(res3.entities.includes('https://example.com/docs'));
  assert.ok(res3.entities.includes('http://google.com'));

  // 3.4 No entities in simple text
  const textSimple = 'hello, how are you doing today?';
  const res4 = extractEntitiesHeuristic(textSimple);
  assert.strictEqual(res4.entities.length, 0);

  // 3.5 Deduplicate repeated entities
  const textRepeated = 'Product Hunt is great. Product Hunt helps you launch products.';
  const res5 = extractEntitiesHeuristic(textRepeated);
  const phCount = res5.entities.filter(x => x === 'Product Hunt').length;
  assert.strictEqual(phCount, 1);
});

test('Entity Extractor - AI & Fallback', async () => {
  // 3.6 AI fallback when provider unavailable
  const resFallback = await extractEntitiesAI('Product Hunt is great @competitor-x', null);
  assert.ok(resFallback.entities.includes('Product Hunt'));
  assert.ok(resFallback.entities.includes('@competitor-x'));
  assert.strictEqual(resFallback.summary, '');
  assert.deepStrictEqual(resFallback.tags, []);

  // Test with a mock AI provider
  const mockProvider = {
    chat: async (request) => {
      return {
        content: JSON.stringify({
          entities: ['Mock Entity A', 'Mock Entity B'],
          keywords: ['keyword A'],
          summary: 'This is a mock summary.',
          tags: ['mock', 'test']
        })
      };
    }
  };

  const resAI = await extractEntitiesAI('Product Hunt is great', mockProvider);
  assert.deepStrictEqual(resAI.entities, ['Mock Entity A', 'Mock Entity B']);
  assert.deepStrictEqual(resAI.keywords, ['keyword A']);
  assert.strictEqual(resAI.summary, 'This is a mock summary.');
  assert.deepStrictEqual(resAI.tags, ['mock', 'test']);
});
