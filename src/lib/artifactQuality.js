const RULES = {
  prd: [
    { key: 'problem', heading: '## Problem' },
    { key: 'goals', heading: '## Goals' },
    { key: 'requirements', heading: '## Requirements' },
    { key: 'metrics', heading: '## Success Metrics' },
  ],
  roadmap: [
    { key: 'vision', heading: '## Vision' },
    { key: 'themes', heading: '## Strategic Themes' },
    { key: 'timeline', heading: '## Timeline' },
  ],
  one_pager: [
    { key: 'summary', heading: '## Summary' },
    { key: 'audience', heading: '## Audience' },
    { key: 'cta', heading: '## Call to Action' },
  ],
};

export function detectArtifactKind(fileNameOrPath) {
  const v = String(fileNameOrPath || '').toLowerCase();
  if (v.includes('prd')) return 'prd';
  if (v.includes('roadmap')) return 'roadmap';
  if (v.includes('one-pager') || v.includes('one_pager')) return 'one_pager';
  return null;
}

export function validateArtifactQuality(content, kind) {
  if (!kind) return [];
  const checks = RULES[kind] || [];
  const normalized = String(content || '');

  const issues = [];
  for (const check of checks) {
    if (!normalized.includes(check.heading)) {
      issues.push({ key: check.key, message: `Missing required section: ${check.heading}` });
    }
  }
  return issues;
}
