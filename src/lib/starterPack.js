import { tauriApi } from '@/api/tauri';

export const PERSONAL_STARTER_WORKFLOWS = [
  { name: 'PRD Draft Workflow', description: 'Turn product context into a first-draft PRD with goals, requirements, and success metrics.' },
  { name: 'Competitor Snapshot Workflow', description: 'Review competitors and summarize movement, strengths, weaknesses, and response ideas.' },
  { name: 'Launch Brief Workflow', description: 'Create a launch brief with risks, owners, dependencies, and readiness checks.' },
  { name: 'Activation Review Workflow', description: 'Review onboarding funnel performance and capture activation hypotheses plus next actions.' },
];

export function parseCsvList(raw) {
  return String(raw || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

export function buildPersonalContextDoc(input) {
  return `# Product Context\n\n## Company\n${input.companyName || 'TBD'}\n\n## Product\n${input.productName || 'TBD'}\n\n## Current Goal\n${input.productGoal || 'TBD'}\n\n## Current Status\n- Stage:\n- Current traction / signal:\n- Biggest product risk:\n\n## Notes\n- Update this file when priorities shift.\n- Keep this high-level and stable.\n`;
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

export async function seedPersonalContext(projectId, input) {
  const contextDoc = buildPersonalContextDoc(input);
  const personasDoc = buildPersonasDoc(input);
  const competitorsDoc = buildCompetitorsDoc(input);

  await tauriApi.writeMarkdownFile(projectId, 'context-personal.md', contextDoc);
  await tauriApi.writeMarkdownFile(projectId, 'personas.md', personasDoc);
  await tauriApi.writeMarkdownFile(projectId, 'competitors.md', competitorsDoc);
}

export async function installPersonalStarterPack(projectId) {
  const workflows = PERSONAL_STARTER_WORKFLOWS;

  for (const wf of workflows) {
    await tauriApi.createWorkflow(projectId, wf.name, wf.description);
  }

  await tauriApi.createArtifact(projectId, 'prd', 'PRD Template');
  await tauriApi.createArtifact(projectId, 'roadmap', 'Roadmap Template');
  await tauriApi.createArtifact(projectId, 'one_pager', 'Current Product Status');
  await tauriApi.createArtifact(projectId, 'one_pager', 'Competitor Snapshot');
}
