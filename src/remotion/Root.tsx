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
  BrainCircuit,
  Check,
  ClipboardList,
  FileText,
  GitBranch,
  Github,
  GitPullRequest,
  LineChart,
  Lock,
  Play,
  Share2,
  Sparkles,
  Workflow,
} from 'lucide-react';

const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

const fade = (frame: number, start: number, duration = 18) =>
  interpolate(frame, [start, start + duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const slide = (frame: number, start: number, from = 32) =>
  interpolate(frame, [start, start + 24], [from, 0], { easing: Easing.out(Easing.cubic), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const pop = (frame: number, start: number) => {
  const { fps } = useVideoConfig();
  return spring({ fps, frame: frame - start, config: { damping: 17, stiffness: 150, mass: 0.7 } });
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

const TitleCard = ({ kicker, title, subtitle, start = 0 }: { kicker: string; title: string; subtitle: string; start?: number }) => {
  const frame = useCurrentFrame();
  return (
    <div
      className="title-card"
      style={{ opacity: fade(frame, start), transform: `translateY(${slide(frame, start, 36)}px)` }}
    >
      <div className="kicker">{kicker}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
};

const TopBar = ({ label }: { label: string }) => (
  <div className="topbar">
    <Logo />
    <div className="topbar-pill"><span className="live-dot" />New ProductOS UI · {label}</div>
  </div>
);

const ProductShell = ({ children, active = 'Home' }: { children: React.ReactNode; active?: string }) => (
  <div className="app-shell">
    <aside className="sidebar-demo">
      <Logo />
      {['Product Home', 'Files', 'Artifacts', 'Workflows', 'Team GitHub'].map((item) => (
        <div key={item} className={cx('side-item', item === active && 'side-item-active')}>
          {item === 'Team GitHub' ? <Github size={20} /> : item === 'Workflows' ? <Workflow size={20} /> : item === 'Artifacts' ? <FileText size={20} /> : item === 'Team GitHub' ? <Github size={20} /> : <Sparkles size={20} />}
          {item}
        </div>
      ))}
      <div className="side-bottom">
        <Lock size={18} /> Local-first · GitHub managed
      </div>
    </aside>
    <main className="main-demo">{children}</main>
  </div>
);

const GitHubPanel = ({ start }: { start: number }) => {
  const frame = useCurrentFrame();
  const items = [
    ['Repository', 'AIResearchFactory/customer-insights'],
    ['Branch strategy', 'main + product research PRs'],
    ['Shared folders', 'products / skills / workflows'],
    ['Access', 'PM, design, GTM, leadership'],
  ];
  return (
    <div className="github-panel" style={{ opacity: fade(frame, start), transform: `translateX(${slide(frame, start, 46)}px)` }}>
      <div className="panel-header"><Github size={28} /> Centralized GitHub context</div>
      {items.map(([label, value], index) => (
        <div className="config-row" key={label} style={{ opacity: fade(frame, start + 8 + index * 6) }}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <div className="sync-badge" style={{ opacity: fade(frame, start + 40) }}><Check size={20} /> ProductOS watches the repo for every team update</div>
    </div>
  );
};

const FileRail = ({ start }: { start: number }) => {
  const frame = useCurrentFrame();
  const files = ['README.md', 'customers/interviews.md', 'competitors/pricing.md', 'workflows/competitive-analysis.yml'];
  return (
    <div className="file-rail">
      {files.map((file, index) => (
        <div className="file-chip" key={file} style={{ opacity: fade(frame, start + index * 8), transform: `translateY(${slide(frame, start + index * 8, 24)}px)` }}>
          <FileText size={18} /> {file}
        </div>
      ))}
    </div>
  );
};

const FlowStep = ({ icon, title, body, accent = 'green', start }: { icon: React.ReactNode; title: string; body: string; accent?: 'green' | 'blue' | 'purple' | 'amber'; start: number }) => {
  const frame = useCurrentFrame();
  return (
    <div className={`flow-step accent-${accent}`} style={{ opacity: fade(frame, start), transform: `scale(${0.94 + pop(frame, start) * 0.06}) translateY(${slide(frame, start, 18)}px)` }}>
      <div className="flow-icon">{icon}</div>
      <div className="flow-title">{title}</div>
      <div className="flow-body">{body}</div>
    </div>
  );
};

const ConnectDemo = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="scene">
      <Grain />
      <TopBar label="Demo 01 · Connect the product to team context" />
      <Sequence from={0} durationInFrames={90}>
        <TitleCard
          kicker="FROM SCATTERED DOCS TO ONE SOURCE OF TRUTH"
          title="Connect ProductOS to a centralized GitHub workspace"
          subtitle="Give every product, artifact, skill, and workflow a versioned home that the whole team can trust."
        />
      </Sequence>
      <Sequence from={78}>
        <ProductShell active="Team GitHub">
          <div className="connect-layout">
            <div className="setup-stack" style={{ opacity: fade(frame, 86), transform: `translateY(${slide(frame, 86)}px)` }}>
              <div className="screen-label">Shared product setup</div>
              <div className="command-card hero-command">
                <div className="command-title"><Github size={24} /> Connect GitHub repository</div>
                <div className="command-copy">ProductOS indexes product folders, reusable skills, and workflows from one repo — while keeping work local-first.</div>
                <div className="input-demo">github.com/AIResearchFactory/customer-insights</div>
                <div className="primary-button"><Share2 size={20} /> Connect & sync context</div>
              </div>
              <FileRail start={120} />
            </div>
            <GitHubPanel start={114} />
          </div>
        </ProductShell>
      </Sequence>
      <Sequence from={250}>
        <div className="bottom-callout" style={{ opacity: fade(frame, 250) }}>
          <GitBranch size={22} /> Every team change becomes durable product context: reviewed, versioned, and ready for AI workflows.
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};

const CompetitorCard = ({ name, metric, note, start }: { name: string; metric: string; note: string; start: number }) => {
  const frame = useCurrentFrame();
  return (
    <div className="competitor-card" style={{ opacity: fade(frame, start), transform: `translateY(${slide(frame, start, 34)}px)` }}>
      <div className="competitor-top"><span>{name}</span><LineChart size={20} /></div>
      <div className="metric">{metric}</div>
      <p>{note}</p>
    </div>
  );
};

const ArtifactPreview = ({ start }: { start: number }) => {
  const frame = useCurrentFrame();
  const rows = [
    ['Positioning gap', 'Enterprise buyers want private AI with reusable context'],
    ['Pricing signal', 'Competitors hide automation behind premium tiers'],
    ['Recommended angle', 'Lead with local-first + GitHub-backed team memory'],
  ];
  return (
    <div className="artifact-preview" style={{ opacity: fade(frame, start), transform: `translateX(${slide(frame, start, -42)}px)` }}>
      <div className="artifact-header"><FileText size={24} /> Competitive analysis artifact</div>
      <h2>Market map: AI PM workspaces</h2>
      {rows.map(([label, value], index) => (
        <div className="insight-row" key={label} style={{ opacity: fade(frame, start + 12 + index * 8) }}>
          <span>{label}</span><strong>{value}</strong>
        </div>
      ))}
    </div>
  );
};

const CompetitiveDemo = () => (
  <AbsoluteFill className="scene">
    <Grain />
    <TopBar label="Demo 02 · Create a product competitive analysis" />
    <Sequence from={0} durationInFrames={82}>
      <TitleCard
        kicker="A PRODUCT STRATEGY FLOW IN MINUTES"
        title="Create a product and generate competitive analysis from shared context"
        subtitle="ProductOS turns customer notes, competitor research, and positioning docs into structured artifacts your team can act on."
      />
    </Sequence>
    <Sequence from={72}>
      <ProductShell active="Product Home">
        <div className="analysis-layout">
          <div className="product-home-demo">
            <div className="screen-label">Product Home · AI Research Workspace</div>
            <div className="flow-grid">
              <FlowStep icon={<ClipboardList size={25} />} title="Create product" body="Define the goal and owner" accent="green" start={82} />
              <FlowStep icon={<Github size={25} />} title="Add GitHub context" body="Pull market notes and research" accent="blue" start={104} />
              <FlowStep icon={<BrainCircuit size={25} />} title="Ask Copilot" body="Compare competitors with product context" accent="purple" start={126} />
              <FlowStep icon={<FileText size={25} />} title="Generate artifact" body="Publish a polished analysis doc" accent="amber" start={148} />
            </div>
            <div className="competitor-grid">
              <CompetitorCard name="ChatGPT" metric="Generic memory" note="Great for prompts, weak on durable team context." start={168} />
              <CompetitorCard name="Cloud PM Suite" metric="Centralized SaaS" note="Workflow visibility, but sensitive strategy leaves your machine." start={184} />
              <CompetitorCard name="ProductOS" metric="Local + GitHub" note="Private workspace with shared, reviewed product memory." start={200} />
            </div>
          </div>
          <ArtifactPreview start={184} />
        </div>
      </ProductShell>
    </Sequence>
  </AbsoluteFill>
);

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
  const progress = fade(frame, start, 22);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return <div className="connector" style={{ left: x1, top: y1, width: length * progress, transform: `rotate(${angle}deg)`, opacity: progress }} />;
};

const WorkflowDemo = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill className="scene">
      <Grain />
      <TopBar label="Demo 03 · Connect analysis to reusable workflows" />
      <Sequence from={0} durationInFrames={80}>
        <TitleCard
          kicker="FROM INSIGHT TO EXECUTION"
          title="Turn competitive analysis into workflows the whole team can run"
          subtitle="A GitHub-backed workspace makes every workflow repeatable, reviewable, and connected to the latest product context."
        />
      </Sequence>
      <Sequence from={70}>
        <ProductShell active="Workflows">
          <div className="workflow-layout">
            <div className="canvas-demo">
              <div className="screen-label">Workflow builder · Competitive Intelligence Loop</div>
              <Connector start={128} x1={430} y1={245} x2={660} y2={245} />
              <Connector start={160} x1={850} y1={245} x2={1070} y2={365} />
              <Connector start={192} x1={850} y1={245} x2={1070} y2={145} />
              <Node title="Pull GitHub context" detail="docs, interviews, pricing notes" icon={<Github size={24} />} start={92} x={140} y={200} />
              <Node title="Run competitor scan" detail="AI analyzes market shifts" icon={<Bot size={24} />} start={124} x={610} y={200} />
              <Node title="Update artifact" detail="analysis doc + recommendations" icon={<FileText size={24} />} start={156} x={1060} y={100} />
              <Node title="Open PR" detail="review workflow output in GitHub" icon={<GitPullRequest size={24} />} start={188} x={1060} y={320} />
            </div>
            <div className="automation-panel" style={{ opacity: fade(frame, 214), transform: `translateX(${slide(frame, 214, 40)}px)` }}>
              <div className="panel-header"><Workflow size={26} /> Managed workflow run</div>
              <div className="run-row"><span>Trigger</span><strong>Weekly or on competitor note change</strong></div>
              <div className="run-row"><span>Approval</span><strong>Human review before publishing</strong></div>
              <div className="run-row"><span>Output</span><strong>GitHub PR + ProductOS artifact</strong></div>
              <div className="primary-button"><Play size={20} /> Run competitive loop</div>
            </div>
          </div>
        </ProductShell>
      </Sequence>
      <Sequence from={278}>
        <div className="final-line" style={{ opacity: fade(frame, 278), transform: `translateY(${slide(frame, 278, 22)}px)` }}>
          One workspace. One GitHub source of truth. Every product decision connected to action.
        </div>
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
