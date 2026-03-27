import { tauriApi } from '@/api/tauri';

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

export async function seedPersonalContext(projectId, input) {
  const contextDoc = buildPersonalContextDoc(input);
  await tauriApi.writeMarkdownFile(projectId, 'context-personal.md', contextDoc);
}

export async function installPersonalStarterPack(projectId) {
  const workflows = PERSONAL_STARTER_WORKFLOWS;

  for (const wf of workflows) {
    await tauriApi.createWorkflow(projectId, wf.name, wf.description);
  }

  await tauriApi.createArtifact(projectId, 'prd', 'PRD Template');
  await tauriApi.createArtifact(projectId, 'roadmap', 'Roadmap Template');
}
