export const PERSONAL_STARTER_WORKFLOWS = [
  { name: 'PRD Draft Workflow', description: 'Generate a PRD draft from goals and context.' },
  { name: 'Competitor Snapshot Workflow', description: 'Create a weekly competitor movement snapshot.' },
  { name: 'Launch Brief Workflow', description: 'Generate launch brief and risk checklist.' },
];

export function buildPersonalContextDoc(input) {
  const competitors = String(input.topCompetitors || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  return `# Personal PM Context\n\n## Company\n${input.companyName || 'TBD'}\n\n## Product\n${input.productName || 'TBD'}\n\n## Primary Persona\n${input.primaryPersona || 'TBD'}\n\n## Top Competitors\n${competitors.length ? competitors.map(c => `- ${c}`).join('\n') : '- TBD'}\n`;
}
