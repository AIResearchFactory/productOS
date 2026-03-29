export const PERSONAL_STARTER_WORKFLOWS = [
  { name: 'PRD Draft Workflow', description: 'Generate a PRD draft from goals and context.' },
  { name: 'Competitor Snapshot Workflow', description: 'Create a weekly competitor movement snapshot.' },
  { name: 'Launch Brief Workflow', description: 'Generate launch brief and risk checklist.' },
];

export function parseCsvList(raw) {
  return String(raw || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

export function buildPersonalContextDoc(input) {
  return `# Product Context\n\n## Company\n${input.companyName || 'TBD'}\n\n## Product\n${input.productName || 'TBD'}\n\n## Current Goal\n${input.productGoal || 'TBD'}\n\n## Notes\n- Update this file when priorities shift.\n- Keep this high-level and stable.\n`;
}

export function buildPersonasDoc(input) {
  const primary = input.primaryPersona || 'Primary persona TBD';
  return `# Personas\n\n## Persona 1\n- Name: ${primary}\n- Jobs to be done:\n- Pain points:\n- Success criteria:\n\n## Persona 2\n- Name:\n- Jobs to be done:\n- Pain points:\n- Success criteria:\n\n## Persona 3\n- Name:\n- Jobs to be done:\n- Pain points:\n- Success criteria:\n`;
}

export function buildCompetitorsDoc(input) {
  const competitors = parseCsvList(input.topCompetitors);
  const seededRows = competitors.length
    ? competitors.map((c) => `| ${c} |  |  |  |`).join('\n')
    : '| TBD |  |  |  |';

  return `# Competitors\n\n| Competitor | Positioning | Strengths | Weaknesses |\n| --- | --- | --- | --- |\n${seededRows}\n\n## Tracking Notes\n- Update monthly or after major launches.\n- Capture evidence links for claims.\n`;
}
