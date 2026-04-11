import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

const c = {
  bg: '#0b1020',
  panel: '#111728',
  panel2: '#182038',
  border: '#26314f',
  text: '#f6f7fb',
  muted: '#98a5c6',
  accent: '#6d5ef9',
  green: '#22c55e',
  blue: '#38bdf8',
  orange: '#f59e0b',
  red: '#ef4444',
};

const sceneRanges = [
  [0, 170],
  [170, 340],
  [340, 560],
  [560, 740],
  [740, 980],
] as const;

const useVisibility = (start: number, end: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = Math.max(0, frame - start);
  const pop = spring({fps, frame: local, config: {damping: 200}});
  const fade = interpolate(frame, [start, start + 10, end - 10, end], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return pop * fade;
};

const AppShell: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{backgroundColor: '#070b16', fontFamily: 'Inter, Arial, sans-serif', color: c.text}}>
    <div style={{padding: 22, height: '100%', boxSizing: 'border-box'}}>
      <div style={{height: '100%', borderRadius: 26, overflow: 'hidden', border: `1px solid ${c.border}`, display: 'grid', gridTemplateColumns: '260px 1fr', backgroundColor: c.bg}}>
        <aside style={{backgroundColor: '#0d1324', borderRight: `1px solid ${c.border}`, padding: 20, boxSizing: 'border-box'}}>
          <div style={{fontSize: 22, fontWeight: 800, marginBottom: 24}}>product<span style={{color: c.accent}}>OS</span></div>
          <div style={{display: 'grid', gap: 8}}>
            {['Home', 'Projects', 'Research', 'Workflows', 'Docs', 'Settings'].map((item, i) => (
              <div key={item} style={{padding: '12px 14px', borderRadius: 14, backgroundColor: i === 1 ? 'rgba(109,94,249,0.16)' : 'transparent', color: i === 1 ? c.text : c.muted, border: i === 1 ? '1px solid rgba(109,94,249,0.35)' : '1px solid transparent', fontWeight: 600}}>{item}</div>
            ))}
          </div>
          <div style={{marginTop: 28, padding: 14, borderRadius: 18, backgroundColor: c.panel, border: `1px solid ${c.border}`}}>
            <div style={{fontSize: 13, color: c.muted, marginBottom: 8}}>Connected CLIs</div>
            <div style={{display: 'grid', gap: 10}}>
              <StatusRow label="Ollama" status="Ready" color={c.green} />
              <StatusRow label="Codex" status="Ready" color={c.green} />
              <StatusRow label="Claude" status="Optional" color={c.blue} />
            </div>
          </div>
        </aside>
        <main style={{padding: 22, boxSizing: 'border-box', position: 'relative'}}>{children}</main>
      </div>
    </div>
  </AbsoluteFill>
);

const StatusRow: React.FC<{label: string; status: string; color: string}> = ({label, status, color}) => (
  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
    <div style={{fontSize: 16}}>{label}</div>
    <div style={{fontSize: 13, fontWeight: 700, color}}>{status}</div>
  </div>
);

const TopBar: React.FC<{title: string; subtitle?: string}> = ({title, subtitle}) => (
  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18}}>
    <div>
      <div style={{fontSize: 32, fontWeight: 800}}>{title}</div>
      {subtitle ? <div style={{fontSize: 16, color: c.muted, marginTop: 6}}>{subtitle}</div> : null}
    </div>
    <div style={{display: 'flex', gap: 10}}>
      <div style={{padding: '10px 14px', borderRadius: 12, backgroundColor: c.panel, border: `1px solid ${c.border}`, color: c.muted}}>Search</div>
      <div style={{padding: '10px 14px', borderRadius: 12, backgroundColor: c.accent, color: 'white', fontWeight: 700}}>New</div>
    </div>
  </div>
);

const Panel: React.FC<{title?: string; children: React.ReactNode; style?: React.CSSProperties}> = ({title, children, style}) => (
  <div style={{backgroundColor: c.panel, border: `1px solid ${c.border}`, borderRadius: 20, padding: 18, boxSizing: 'border-box', ...style}}>
    {title ? <div style={{fontSize: 13, color: c.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em'}}>{title}</div> : null}
    {children}
  </div>
);

const Field: React.FC<{label: string; value: string}> = ({label, value}) => (
  <div style={{marginBottom: 14}}>
    <div style={{fontSize: 13, color: c.muted, marginBottom: 6}}>{label}</div>
    <div style={{padding: '12px 14px', borderRadius: 12, backgroundColor: c.panel2, border: `1px solid ${c.border}`, fontSize: 16}}>{value}</div>
  </div>
);

const Scene1: React.FC = () => {
  const v = useVisibility(...sceneRanges[0]);
  const frame = useCurrentFrame();
  const typing = interpolate(frame, [20, 90], [0, 27], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const name = 'monday.com LLM strategy'.slice(0, Math.floor(typing));

  return (
    <AbsoluteFill style={{opacity: v, transform: `translateY(${(1 - v) * 14}px)`}}>
      <AppShell>
        <TopBar title="Onboarding" subtitle="Connect external tools, then create your first strategy project." />
        <div style={{display: 'grid', gridTemplateColumns: '1fr 0.95fr', gap: 18, height: 920}}>
          <Panel title="Setup">
            <Field label="Primary local model" value="Ollama · connected" />
            <Field label="Cloud reasoning" value="Codex · connected" />
            <Field label="Project name" value={name || ' '} />
            <Field label="Workspace" value="monday.com" />
            <div style={{marginTop: 22, padding: 16, borderRadius: 14, backgroundColor: c.panel2, border: `1px solid ${c.border}`}}>
              <div style={{fontSize: 14, color: c.muted, marginBottom: 8}}>Onboarding note</div>
              <div style={{fontSize: 17, lineHeight: 1.45}}>Install and sign in to CLI tools in your own terminal first. Then use Retry detection here.</div>
            </div>
          </Panel>
          <Panel title="Detected providers">
            <div style={{display: 'grid', gap: 12}}>
              {[
                ['Ollama', 'Installed', c.green],
                ['Codex', 'Installed', c.green],
                ['Gemini', 'Not connected', c.orange],
                ['Claude Code', 'Optional', c.blue],
              ].map(([label, status, color]) => (
                <div key={String(label)} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 14, backgroundColor: c.panel2, border: `1px solid ${c.border}`}}>
                  <div style={{fontSize: 18, fontWeight: 600}}>{label}</div>
                  <div style={{fontSize: 14, fontWeight: 700, color: color as string}}>{status}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </AppShell>
    </AbsoluteFill>
  );
};

const Scene2: React.FC = () => {
  const v = useVisibility(...sceneRanges[1]);
  return (
    <AbsoluteFill style={{opacity: v, transform: `translateY(${(1 - v) * 14}px)`}}>
      <AppShell>
        <TopBar title="New project" subtitle="monday.com LLM strategy" />
        <div style={{display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 18, height: 920}}>
          <Panel title="Project brief">
            <Field label="Objective" value="Research LLM integrations monday.com should add" />
            <Field label="Secondary goal" value="Identify gaps versus the competition" />
            <Field label="Outputs" value="Research brief · daily workflow · PRD" />
            <Field label="Execution mode" value="Codex primary · Ollama fallback" />
          </Panel>
          <Panel title="Workspace">
            <div style={{display: 'grid', gap: 12}}>
              {['Research brief', 'Competitor matrix', 'Daily monitor workflow', 'PRD draft'].map((item, i) => (
                <div key={item} style={{padding: '16px', borderRadius: 14, backgroundColor: i === 0 ? 'rgba(109,94,249,0.15)' : c.panel2, border: `1px solid ${i === 0 ? 'rgba(109,94,249,0.35)' : c.border}`}}>
                  <div style={{fontSize: 18, fontWeight: 600}}>{item}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </AppShell>
    </AbsoluteFill>
  );
};

const Scene3: React.FC = () => {
  const v = useVisibility(...sceneRanges[2]);
  return (
    <AbsoluteFill style={{opacity: v}}>
      <AppShell>
        <TopBar title="Research run" subtitle="Scanning Monday, Notion, ClickUp, Asana, Airtable, Atlassian." />
        <div style={{display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 18, height: 920}}>
          <Panel title="Research notes">
            {[
              'Monday should add AI workflow generation across boards, docs, and automations.',
              'The strongest gap is cross-workspace reasoning, not just in-task writing help.',
              'Competitors are ahead on AI summaries tied to knowledge bases and planning context.',
              'A Monday AI ops copilot could win on execution orchestration and status synthesis.',
            ].map((line) => (
              <div key={line} style={{display: 'flex', gap: 10, marginBottom: 14}}>
                <div style={{width: 7, height: 7, borderRadius: 999, backgroundColor: c.accent, marginTop: 10}} />
                <div style={{fontSize: 18, lineHeight: 1.5}}>{line}</div>
              </div>
            ))}
          </Panel>
          <Panel title="Competition gaps">
            {[
              ['Notion', 'Knowledge + AI recall is stronger'],
              ['ClickUp', 'Better AI summaries in docs/tasks'],
              ['Asana', 'More polished AI status views'],
              ['Monday', 'Strong OS base, weaker AI orchestration'],
            ].map(([name, note]) => (
              <div key={String(name)} style={{padding: '14px 16px', borderRadius: 14, backgroundColor: c.panel2, border: `1px solid ${c.border}`, marginBottom: 12}}>
                <div style={{fontSize: 18, fontWeight: 700}}>{name}</div>
                <div style={{fontSize: 15, color: c.muted, marginTop: 4}}>{note}</div>
              </div>
            ))}
          </Panel>
        </div>
      </AppShell>
    </AbsoluteFill>
  );
};

const Scene4: React.FC = () => {
  const v = useVisibility(...sceneRanges[3]);
  return (
    <AbsoluteFill style={{opacity: v}}>
      <AppShell>
        <TopBar title="Automation workflow" subtitle="Create a daily market update pipeline for monday.com AI research." />
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, height: 920}}>
          <Panel title="Workflow steps">
            {[
              'Every day at 08:00',
              'Collect competitor release notes and product updates',
              'Refresh competitor matrix',
              'Append daily delta summary to research project',
            ].map((step, i) => (
              <div key={step} style={{display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-start'}}>
                <div style={{width: 28, height: 28, borderRadius: 999, backgroundColor: i === 0 ? c.accent : c.panel2, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800}}>{i + 1}</div>
                <div style={{fontSize: 18, lineHeight: 1.45}}>{step}</div>
              </div>
            ))}
          </Panel>
          <Panel title="Execution settings">
            <Field label="Schedule" value="Daily · 08:00" />
            <Field label="Primary model" value="Codex" />
            <Field label="Fallback" value="Ollama" />
            <Field label="Destination" value="Research board + daily note" />
          </Panel>
        </div>
      </AppShell>
    </AbsoluteFill>
  );
};

const Scene5: React.FC = () => {
  const v = useVisibility(...sceneRanges[4]);
  return (
    <AbsoluteFill style={{opacity: v}}>
      <AppShell>
        <TopBar title="PRD draft" subtitle="Switch drafting to Ollama for local-first writing and iteration." />
        <div style={{display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 18, height: 920}}>
          <Panel title="Draft">
            <div style={{fontSize: 24, fontWeight: 800, marginBottom: 14}}>AI Operations Copilot for monday.com</div>
            {[
              'Problem: Monday has strong workflow infrastructure but weaker cross-workspace AI intelligence.',
              'Proposal: Launch an AI copilot that reasons across boards, docs, owners, and automation state.',
              'Core features: workflow builder, project status copilot, AI integration suggestions, AI market watcher.',
              'Success metric: higher automation adoption and faster planning/reporting loops.',
            ].map((line) => (
              <div key={line} style={{display: 'flex', gap: 10, marginBottom: 14}}>
                <div style={{width: 7, height: 7, borderRadius: 999, backgroundColor: c.accent, marginTop: 10}} />
                <div style={{fontSize: 18, lineHeight: 1.5}}>{line}</div>
              </div>
            ))}
          </Panel>
          <Panel title="Model switch">
            <Field label="Drafting model" value="Ollama" />
            <Field label="Reason" value="Local-first iteration, privacy, lower cost" />
            <div style={{padding: '16px', borderRadius: 14, backgroundColor: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.35)', marginTop: 10}}>
              <div style={{fontSize: 18, fontWeight: 700, color: c.green}}>PRD ready for internal review</div>
            </div>
          </Panel>
        </div>
      </AppShell>
    </AbsoluteFill>
  );
};

export const ProductOSMondayDemo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Scene1 />
      <Scene2 />
      <Scene3 />
      <Scene4 />
      <Scene5 />
    </AbsoluteFill>
  );
};
