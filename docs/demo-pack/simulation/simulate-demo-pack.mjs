import fs from 'fs';
import path from 'path';

const base = path.resolve(process.cwd(), 'docs/demo-pack');
const captionsPath = path.join(base, 'captions/captions.json');
const outDir = path.join(base, 'simulation/out');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const data = JSON.parse(fs.readFileSync(captionsPath, 'utf8'));

const now = new Date().toISOString();
const report = {
  generatedAt: now,
  simulatedRuns: data.cases.map((c, idx) => ({
    caseId: c.id,
    title: c.title,
    status: 'Completed',
    durationSec: 30 + idx * 12,
    outputs: [
      `${c.id}-artifact-1.md`,
      `${c.id}-artifact-2.md`
    ],
    caption: c.caption
  }))
};

fs.writeFileSync(path.join(outDir, 'simulation-report.json'), JSON.stringify(report, null, 2));

for (const item of report.simulatedRuns) {
  const md = `# Demo Simulation — Case ${item.caseId}\n\n- Title: ${item.title}\n- Status: ${item.status}\n- Duration: ${item.durationSec}s\n- Caption: ${item.caption}\n\n## Simulated Outputs\n${item.outputs.map(o => `- ${o}`).join('\n')}\n`;
  fs.writeFileSync(path.join(outDir, `case-${item.caseId}.md`), md);
}

console.log(`Simulation complete. Report: ${path.join(outDir, 'simulation-report.json')}`);
