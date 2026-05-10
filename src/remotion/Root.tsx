import React from 'react';
import {
  AbsoluteFill,
  Composition,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  Bot,
  Check,
  ClipboardList,
  FileText,
  GitBranch,
  Github,
  GitPullRequest,
  LineChart,
  Lock,
  Play,
  Search,
  Sparkles,
  Workflow,
} from 'lucide-react';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

const fade = (frame: number, start: number, duration = 18) =>
  interpolate(frame, [start, start + duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const slide = (frame: number, start: number, from = 28) =>
  interpolate(frame, [start, start + 24], [from, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const typeText = (text: string, frame: number, start: number, charsPerFrame = 1.1) => text.slice(0, Math.max(0, Math.floor((frame - start) * charsPerFrame)));

const pop = (frame: number, start: number) => {
  const { fps } = useVideoConfig();
  return spring({ fps, frame: frame - start, config: { damping: 16, stiffness: 140, mass: 0.8 } });
};

const Logo = () => (
  <div className="logo-marketing">
    <div className="logo-orb"><Sparkles size={28} /></div>
    <div>
      <div className="logo-title">ProductOS</div>
      <div className="logo-subtitle">command center</div>
    </div>
  </div>
);

const Grain = () => (
  <>
    <div className="aurora aurora-one" />
    <div className="aurora aurora-two" />
    <div className="grid-glow" />
    <div className="noise" />
  </>
);

const TopBar = ({ label }: { label: string }) => (
  <div className="topbar">
    <Logo />
    <div className="topbar-pill"><span className="live-dot" />{label}</div>
  </div>
);

const TitleCard = ({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) => {
  const frame = useCurrentFrame();
  return (
    <div className="title-card" style={{ opacity: fade(frame, 0), transform: `translateY(${slide(frame, 0, 34)}px)` }}>
      <div className="kicker">{kicker}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
};

const ProductShell = ({ children, active, project = 'Acme Insight Cloud' }: { children: React.ReactNode; active: string; project?: string }) => (
  <div className="app-shell">
    <aside className="sidebar-demo">
      <Logo />
      <div className="project-pill"><span />{project}</div>
      {['Product Home', 'Files', 'Artifacts', 'Workflows', 'Team GitHub'].map((item) => (
        <div key={item} className={cx('side-item', item === active && 'side-item-active')}>
          {item === 'Team GitHub' ? <Github size={20} /> : item === 'Workflows' ? <Workflow size={20} /> : item === 'Artifacts' ? <FileText size={20} /> : item === 'Files' ? <ClipboardList size={20} /> : <Sparkles size={20} />}
          {item}
        </div>
      ))}
      <div className="side-bottom"><Lock size={18} /> Local-first · GitHub managed</div>
    </aside>
    <main className="main-demo">{children}</main>
  </div>
);

const ScreenTitle = ({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) => (
  <div className="screen-title">
    <div className="screen-label">{eyebrow}</div>
    <h2>{title}</h2>
    {copy && <p>{copy}</p>}
  </div>
);

const FileTree = ({ start }: { start: number }) => {
  const frame = useCurrentFrame();
  const files = [
    ['products/acme-insight-cloud/README.md', 'Product goal + ICP'],
    ['products/acme-insight-cloud/research/interviews.md', 'Customer pain quotes'],
    ['products/acme-insight-cloud/competitors/pricing.md', 'Competitor pricing notes'],
    ['workflows/competitive-intel.yml', 'Reusable analysis workflow'],
  ];
  return (
    <div className="file-tree">
      {files.map(([path, note], index) => (
        <div className="tree-row" key={path} style={{ opacity: fade(frame, start + index * 8), transform: `translateY(${slide(frame, start + index * 8, 18)}px)` }}>
          <FileText size={18} /><strong>{path}</strong><span>{note}</span>
        </div>
      ))}
    </div>
  );
};

const ConnectDemo = () => {
  const frame = useCurrentFrame();
  const repo = typeText('github.com/AIResearchFactory/customer-insights', frame, 104, 1.4);
  const progress = interpolate(frame, [142, 210], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill className="scene">
      <Grain />
      <TopBar label="Demo 01 · Connect team context" />
      <Sequence from={0} durationInFrames={72}>
        <TitleCard kicker="REAL SETUP FLOW" title="Connect ProductOS to the team’s GitHub workspace" subtitle="Start from a repository your PM, design, and GTM team already reviews — then let ProductOS index it as live product context." />
      </Sequence>
      <Sequence from={62}>
        <ProductShell active="Team GitHub">
          <div className="realistic-grid">
            <div className="settings-card" style={{ opacity: fade(frame, 72), transform: `translateY(${slide(frame, 72)}px)` }}>
              <ScreenTitle eyebrow="Team GitHub" title="Shared context source" copy="Choose the repo that stores products, research, skills, and workflows." />
              <label>Repository URL</label>
              <div className="input-demo"><span>{repo}</span><i /></div>
              <div className="config-two">
                <div><span>Sync mode</span><strong>Pull latest on launch</strong></div>
                <div><span>Write mode</span><strong>Create PR for changes</strong></div>
              </div>
              <div className="primary-button"><Github size={20} /> Connect repository</div>
              <div className="progress-wrap" style={{ opacity: fade(frame, 142) }}>
                <div className="progress-meta"><span>Indexing Markdown context</span><strong>{Math.round(progress)}%</strong></div>
                <div className="progress-bar"><div style={{ width: `${progress}%` }} /></div>
              </div>
            </div>
            <div className="context-panel" style={{ opacity: fade(frame, 128), transform: `translateX(${slide(frame, 128, 38)}px)` }}>
              <div className="panel-header"><GitBranch size={26} /> Indexed repo structure</div>
              <FileTree start={150} />
              <div className="sync-badge" style={{ opacity: fade(frame, 218) }}><Check size={20} /> ProductOS found 1 product, 4 research files, 2 reusable workflows</div>
            </div>
          </div>
        </ProductShell>
      </Sequence>
    </AbsoluteFill>
  );
};

const FlowStep = ({ icon, title, body, done, start }: { icon: React.ReactNode; title: string; body: string; done?: boolean; start: number }) => {
  const frame = useCurrentFrame();
  return (
    <div className={cx('flow-step', done && 'flow-step-done')} style={{ opacity: fade(frame, start), transform: `scale(${0.95 + pop(frame, start) * 0.05})` }}>
      <div className="flow-icon">{done ? <Check size={23} /> : icon}</div>
      <div><strong>{title}</strong><span>{body}</span></div>
    </div>
  );
};

const ChatBubble = ({ text, from = 'user', start }: { text: string; from?: 'user' | 'ai'; start: number }) => {
  const frame = useCurrentFrame();
  const visible = from === 'user' ? typeText(text, frame, start, 1.35) : text;
  return (
    <div className={cx('chat-bubble', from === 'ai' && 'chat-ai')} style={{ opacity: fade(frame, start), transform: `translateY(${slide(frame, start, 16)}px)` }}>
      {from === 'ai' ? <Bot size={18} /> : <Search size={18} />}
      <span>{visible}{from === 'user' && visible.length < text.length ? '|' : ''}</span>
    </div>
  );
};

const ArtifactPreview = ({ start }: { start: number }) => {
  const frame = useCurrentFrame();
  const rows = [
    ['Top gap', 'Teams need private AI that remembers product context across projects.'],
    ['Competitor risk', 'Generic chat is fast but loses repo-backed evidence and review history.'],
    ['Recommendation', 'Lead with “local-first workspace + GitHub source of truth”.'],
  ];
  return (
    <div className="artifact-preview" style={{ opacity: fade(frame, start), transform: `translateX(${slide(frame, start, -36)}px)` }}>
      <div className="artifact-header"><FileText size={24} /> Artifact · Competitive Analysis</div>
      <h2>AI PM workspace market map</h2>
      {rows.map(([label, value], index) => (
        <div className="insight-row" key={label} style={{ opacity: fade(frame, start + 12 + index * 8) }}>
          <span>{label}</span><strong>{value}</strong>
        </div>
      ))}
      <div className="artifact-footer" style={{ opacity: fade(frame, start + 44) }}><Check size={18} /> Saved to products/acme-insight-cloud/artifacts/competitive-analysis.md</div>
    </div>
  );
};

const CompetitiveDemo = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="scene">
      <Grain />
      <TopBar label="Demo 02 · Create competitive analysis" />
      <Sequence from={0} durationInFrames={68}>
        <TitleCard kicker="ACTUAL PRODUCT FLOW" title="Create a product, add evidence, then ask Copilot for analysis" subtitle="The demo now follows the flow a PM would actually take: product home, files, Copilot prompt, generated artifact." />
      </Sequence>
      <Sequence from={58}>
        <ProductShell active="Product Home">
          <div className="product-layout">
            <div className="product-column">
              <ScreenTitle eyebrow="Product Home" title="Acme Insight Cloud" copy="AI customer research workspace for B2B product teams." />
              <div className="flow-map">
                <FlowStep icon={<ClipboardList size={23} />} title="Product created" body="Goal, ICP, and owner captured" done start={80} />
                <FlowStep icon={<Github size={23} />} title="Context attached" body="4 GitHub files indexed" done start={104} />
                <FlowStep icon={<Sparkles size={23} />} title="Ask Copilot" body="Use files + competitor notes" start={128} />
                <FlowStep icon={<FileText size={23} />} title="Generate artifact" body="Competitive analysis doc" start={152} />
              </div>
              <div className="chat-panel-demo" style={{ opacity: fade(frame, 132) }}>
                <ChatBubble start={144} text="Use @competitors/pricing.md and interviews.md to create a competitive analysis for our Q3 positioning." />
                <ChatBubble start={194} from="ai" text="I found 3 positioning gaps and drafted a competitive analysis artifact with evidence links." />
              </div>
            </div>
            <ArtifactPreview start={210} />
          </div>
        </ProductShell>
      </Sequence>
    </AbsoluteFill>
  );
};

const Node = ({ title, detail, icon, start, x, y }: { title: string; detail: string; icon: React.ReactNode; start: number; x: number; y: number }) => {
  const frame = useCurrentFrame();
  return (
    <div className="workflow-node" style={{ left: x, top: y, opacity: fade(frame, start), transform: `scale(${0.92 + pop(frame, start) * 0.08})` }}>
      <div className="node-icon">{icon}</div>
      <div><strong>{title}</strong><span>{detail}</span></div>
    </div>
  );
};

const Connector = ({ start, x1, y1, x2, y2 }: { start: number; x1: number; y1: number; x2: number; y2: number }) => {
  const frame = useCurrentFrame();
  const progress = fade(frame, start, 20);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return <div className="connector" style={{ left: x1, top: y1, width: length * progress, transform: `rotate(${angle}deg)`, opacity: progress }} />;
};

const PullRequestCard = ({ start }: { start: number }) => {
  const frame = useCurrentFrame();
  return (
    <div className="pr-card" style={{ opacity: fade(frame, start), transform: `translateX(${slide(frame, start, 38)}px)` }}>
      <div className="panel-header"><GitPullRequest size={26} /> GitHub review handoff</div>
      <div className="pr-title">PR #42 · Update competitive analysis and weekly workflow</div>
      {['competitive-analysis.md updated', 'workflow run log attached', 'human approval required before merge'].map((item, index) => (
        <div className="pr-row" key={item} style={{ opacity: fade(frame, start + 12 + index * 8) }}><Check size={17} />{item}</div>
      ))}
      <div className="primary-button"><GitPullRequest size={20} /> Open PR review</div>
    </div>
  );
};

const WorkflowDemo = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="scene">
      <Grain />
      <TopBar label="Demo 03 · Automate and review" />
      <Sequence from={0} durationInFrames={68}>
        <TitleCard kicker="FROM ARTIFACT TO REPEATABLE WORKFLOW" title="Connect the analysis to a workflow with GitHub review built in" subtitle="The recurring competitive-intelligence loop pulls repo context, refreshes the artifact, and opens a PR for the team." />
      </Sequence>
      <Sequence from={58}>
        <ProductShell active="Workflows">
          <div className="workflow-layout">
            <div className="canvas-demo">
              <ScreenTitle eyebrow="Workflow Builder" title="Competitive intelligence loop" copy="Run weekly, or whenever competitor notes change." />
              <Connector start={126} x1={365} y1={335} x2={585} y2={335} />
              <Connector start={158} x1={795} y1={335} x2={1000} y2={205} />
              <Connector start={188} x1={795} y1={335} x2={1000} y2={465} />
              <Node title="Pull repo context" detail="GitHub Markdown + latest branch" icon={<Github size={24} />} start={86} x={90} y={290} />
              <Node title="Analyze competitors" detail="Compare pricing, claims, evidence" icon={<LineChart size={24} />} start={118} x={540} y={290} />
              <Node title="Update artifact" detail="Rewrite analysis with citations" icon={<FileText size={24} />} start={150} x={980} y={160} />
              <Node title="Open review PR" detail="Team reviews before merge" icon={<GitPullRequest size={24} />} start={180} x={980} y={420} />
              <div className="run-toast" style={{ opacity: fade(frame, 226), transform: `translateY(${slide(frame, 226, 18)}px)` }}><Play size={18} /> Workflow run complete · 3 outputs ready</div>
            </div>
            <PullRequestCard start={220} />
          </div>
        </ProductShell>
      </Sequence>
    </AbsoluteFill>
  );
};

const MasterDemo = () => (
  <AbsoluteFill className="scene">
    <Sequence from={0} durationInFrames={330}><ConnectDemo /></Sequence>
    <Sequence from={330} durationInFrames={330}><CompetitiveDemo /></Sequence>
    <Sequence from={660} durationInFrames={330}><WorkflowDemo /></Sequence>
  </AbsoluteFill>
);

export const ProductOSDemos = () => (
  <>
    <Composition id="ConnectProductToGitHub" component={ConnectDemo} durationInFrames={330} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="CompetitiveAnalysisArtifact" component={CompetitiveDemo} durationInFrames={330} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="WorkflowFromCompetitiveIntel" component={WorkflowDemo} durationInFrames={330} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Composition id="ProductOSMarketingSuite" component={MasterDemo} durationInFrames={990} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);
