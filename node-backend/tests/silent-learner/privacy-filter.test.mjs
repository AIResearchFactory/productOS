import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DataClass,
  scanForSecrets,
  redactSecrets,
  classifyInteraction,
} from '../../lib/silent-learner/privacy-filter.mjs';

test('Privacy Filter ignores news/announcement/blog URLs and hyphenated URL slugs', () => {
  const urls = [
    'https://newsroom.ibm.com/new/announcements/manage-ai-data-risk-and-govern-agents-with-new-capabilities-from-ibm',
    'https://example.com/blog/sk-how-to-manage-ai-agents-and-enterprise-governance-2026',
    'https://blog.vendor.io/posts/123-45-6789-security?ref=sk-2026-annual-enterprise-security-guide',
    'https://docs.example.com/guides/sk-ant-getting-started-with-enterprise-agents-2026',
  ];

  for (const url of urls) {
    const text = `Check this article: (${url}) — Reference 2026`;
    const scan = scanForSecrets(text);
    assert.strictEqual(scan.isSafe, true, `Expected URL to be safe: ${url}, got findings: ${JSON.stringify(scan.findings)}`);
    assert.strictEqual(scan.highestClass, DataClass.SAFE);
    assert.deepStrictEqual(scan.findings, []);

    const { redacted, redactions } = redactSecrets(text);
    assert.strictEqual(redacted, text);
    assert.deepStrictEqual(redactions, []);
  }
});

test('Privacy Filter ignores GUIDs/UUIDs in URLs and standalone text, and ignores Unix timestamps', () => {
  const samples = [
    'Source: [IVC Online](https://www.ivc-online.com/Google-Card?id=af123456-7890-f111-b81c-00505695cd29)',
    'Another GUID in URL: https://portal.example.com/item?uuid=12345678-1234-4111-881c-005056951234',
    'Standalone GUID: af123456-7890-f111-b81c-00505695cd29 and 12345678-1234-4111-881c-005056951234',
    'Completed at timestamp 1795220793752 with request ID 1234567890123',
  ];

  for (const text of samples) {
    const scan = scanForSecrets(text);
    assert.strictEqual(scan.isSafe, true, `Expected sample to be safe: ${text}, got findings: ${JSON.stringify(scan.findings)}`);
    assert.deepStrictEqual(scan.findings, []);
    const { redacted } = redactSecrets(text);
    assert.strictEqual(redacted, text);
  }
});

test('Privacy Filter ignores mid-word/prefixed tokens, non-Luhn 16-digit IDs, and URL-valued assignments', () => {
  const samples = [
    'risk-1234567890abcdef1234567890abcdef',
    'foo_AKIA1234567890ABCDEF',
    'prefix_ghp_1234567890abcdefghijklmnopqrstuvwxyz1234',
    'Non-Luhn tracking ID 4000000000000001',
    'api_key=https://example.com/docs/overview',
    'api_key=[REDACTED:openai_key_v2]',
    'https://example.com/blog/AKIA1234567890ABCDEF',
  ];

  for (const text of samples) {
    const scan = scanForSecrets(text);
    assert.strictEqual(scan.isSafe, true, `Expected sample to be safe: ${text}, got findings: ${JSON.stringify(scan.findings)}`);
    assert.deepStrictEqual(scan.findings, []);
  }
});

test('Privacy Filter still detects and redacts real secrets, non-blog query credentials, and valid PII', () => {
  const realOpenAi = 'sk-proj-1234567890abcdef1234567890abcdef';
  const realAnthropic = 'sk-ant-api03-1234567890abcdef1234567890abcdef1234';
  const realAws = 'AKIA1234567890ABCDEF';
  const realGithub = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz1234';
  const realGoogle = 'AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGQ61I';

  const secretText = [
    `OpenAI: ${realOpenAi}`,
    `Anthropic: ${realAnthropic}`,
    `AWS: ${realAws}`,
    `GitHub: ${realGithub}`,
    `Google: ${realGoogle}`,
    `API URL query: https://api.example.com/v1?key=${realOpenAi}`,
    'Custom secret: api_key=my_secret_value_1234567890',
  ].join('\n');

  const scan = scanForSecrets(secretText);
  assert.strictEqual(scan.isSafe, false);
  assert.strictEqual(scan.highestClass, DataClass.SECRET);

  const findingNames = scan.findings.map((f) => f.name);
  assert.ok(findingNames.includes('openai_key_v2'));
  assert.ok(findingNames.includes('anthropic_key'));
  assert.ok(findingNames.includes('aws_access_key'));
  assert.ok(findingNames.includes('github_token'));
  assert.ok(findingNames.includes('google_api_key'));
  assert.ok(findingNames.includes('generic_secret'));

  // Anthropic key should only match anthropic_key, not double-match openai_key_v2
  const openaiFinding = scan.findings.find((f) => f.name === 'openai_key_v2');
  assert.strictEqual(openaiFinding.matchCount, 2);

  const { redacted } = redactSecrets(secretText);
  assert.ok(!redacted.includes(realOpenAi));
  assert.ok(!redacted.includes(realAnthropic));
  assert.ok(!redacted.includes(realAws));
  assert.ok(!redacted.includes(realGithub));
  assert.ok(!redacted.includes(realGoogle));
  assert.ok(!redacted.includes('my_secret_value_1234567890'));
  assert.ok(redacted.includes('[REDACTED:anthropic_key]'));
  assert.ok(redacted.includes('[REDACTED:openai_key_v2]'));

  // Valid phone numbers, SSN, and Luhn-valid credit card
  const phoneAndSsn = 'Call (555) 123-4567 or 555-123-4567 or +1-555-123-4567, SSN 123-45-6789, Card 4532015112830366';
  const piiScan = scanForSecrets(phoneAndSsn);
  assert.strictEqual(piiScan.highestClass, DataClass.SECRET);
  assert.strictEqual(piiScan.findings.find((f) => f.name === 'phone_number')?.matchCount, 3);
  assert.strictEqual(piiScan.findings.find((f) => f.name === 'ssn')?.matchCount, 1);
  assert.strictEqual(piiScan.findings.find((f) => f.name === 'credit_card')?.matchCount, 1);

  const interaction = classifyInteraction({
    promptText: 'Read https://newsroom.ibm.com/new/announcements/manage-ai-data-risk-and-govern-agents and https://www.ivc-online.com/Google-Card?id=af123456-7890-f111-b81c-00505695cd29',
    responseText: 'Summary of the IBM announcement and IVC Online report.',
  });
  assert.strictEqual(interaction.shouldStore, true);
  assert.strictEqual(interaction.dataClass, DataClass.SAFE);
  assert.deepStrictEqual(interaction.findings, []);
});
