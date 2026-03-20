const providerEl = document.getElementById('provider');
const fileInputEl = document.getElementById('fileInput');
const importBtnEl = document.getElementById('importBtn');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');
const conversationsEl = document.getElementById('conversations');
const modeGroupEl = document.getElementById('modeGroup');
const fileModeEl = document.getElementById('fileMode');
const accountModeEl = document.getElementById('accountMode');
const connectBtnEl = document.getElementById('connectBtn');
const planEl = document.getElementById('plan');
const outMdEl = document.getElementById('outMd');
const outSkillsEl = document.getElementById('outSkills');
const outRawEl = document.getElementById('outRaw');

const healthPanelEl = document.getElementById('healthPanel');
const refreshHealthBtnEl = document.getElementById('refreshHealthBtn');
const panicBtnEl = document.getElementById('panicBtn');
const validateBtnEl = document.getElementById('validateBtn');
const validatorResultEl = document.getElementById('validatorResult');
const competitorCountEl = document.getElementById('competitorCount');
const fanoutStepsEl = document.getElementById('fanoutSteps');
const perTaskRamMbEl = document.getElementById('perTaskRamMb');

let importMode = 'file';
let panicMode = false;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#ff9fa9' : '#9fd1ff';
}

function selectedOutputsText() {
  const options = [];
  if (outMdEl.checked) options.push('Markdown');
  if (outSkillsEl.checked) options.push('Skills');
  if (outRawEl.checked) options.push('Raw JSON');
  return options.length ? options.join(' + ') : 'None';
}

function renderPlan() {
  planEl.innerHTML = `
    <div class="stat">Provider: <strong>${providerEl.value}</strong></div>
    <div class="stat">Mode: <strong>${importMode === 'file' ? 'Upload file' : 'Connect account'}</strong></div>
    <div class="stat">Outputs: <strong>${selectedOutputsText()}</strong></div>
    <div class="stat">Destination: <strong>New folder</strong></div>
  `;
}

function renderStats(stats) {
  statsEl.innerHTML = '';
  const items = [
    ['Conversations Imported', stats.conversationCount],
    ['Messages Imported', stats.messageCount]
  ];
  for (const [label, value] of items) {
    const div = document.createElement('div');
    div.className = 'stat';
    div.textContent = `${label}: ${value}`;
    statsEl.appendChild(div);
  }
}

function renderConversations(conversations) {
  conversationsEl.innerHTML = '';
  if (!conversations.length) {
    conversationsEl.innerHTML = '<div class="empty">No conversations imported yet.</div>';
    return;
  }

  for (const conv of conversations) {
    const wrap = document.createElement('div');
    wrap.className = 'conversation';
    wrap.innerHTML = `
      <h3>${conv.title}</h3>
      <div class="meta">${conv.source} • ${conv.messages.length} messages • customGPT=${String(conv.metadata?.isCustomGpt)}</div>
      <div class="messages"></div>
    `;

    const msgRoot = wrap.querySelector('.messages');
    for (const m of conv.messages.slice(0, 6)) {
      const msg = document.createElement('div');
      msg.className = 'msg';
      msg.innerHTML = `<span class="role">${m.role}</span><div>${m.text.replaceAll('<', '&lt;')}</div>`;
      msgRoot.appendChild(msg);
    }

    conversationsEl.appendChild(wrap);
  }
}

function setMode(nextMode) {
  importMode = nextMode;
  for (const btn of modeGroupEl.querySelectorAll('.chip')) {
    btn.classList.toggle('active', btn.dataset.mode === importMode);
  }
  fileModeEl.classList.toggle('hidden', importMode !== 'file');
  accountModeEl.classList.toggle('hidden', importMode !== 'account');
  renderPlan();
}

function renderHealth(state) {
  panicMode = Boolean(state.panicMode);
  healthPanelEl.innerHTML = `
    <div class="stat">Mode: <strong>${state.mode}</strong></div>
    <div class="stat">Workers: <strong>${state.activeWorkers}/${state.maxWorkers}</strong></div>
    <div class="stat">RAM: <strong>${state.memory.usedPct}%</strong> (${state.memory.usedMb}MB / ${state.memory.totalMb}MB)</div>
    <div class="stat">Queue: <strong>${state.queueDepth}</strong></div>
    <div class="stat">Last event: <strong>${state.lastReason || 'None'}</strong></div>
  `;
  panicBtnEl.textContent = panicMode ? 'Disable Panic Mode' : 'Activate Panic Mode';
}

async function refreshHealth() {
  const res = await fetch('/api/runtime/health');
  const state = await res.json();
  renderHealth(state);
}

async function togglePanic() {
  const res = await fetch('/api/runtime/panic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enable: !panicMode })
  });
  const data = await res.json();
  renderHealth(data.state);
  setStatus(panicMode ? 'Panic mode enabled. Imports are now blocked.' : 'Panic mode disabled. Imports are allowed.');
}

async function runValidation() {
  validatorResultEl.textContent = 'Running validator...';
  const plan = {
    competitorCount: Number(competitorCountEl.value || 0),
    fanoutSteps: Number(fanoutStepsEl.value || 0),
    perTaskRamMb: Number(perTaskRamMbEl.value || 0)
  };

  const res = await fetch('/api/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Validation failed');

  const issueText = data.issues.length
    ? data.issues.map((i) => `${i.severity.toUpperCase()}: ${i.message}`).join(' | ')
    : 'No major issues found.';

  validatorResultEl.textContent = `Risk: ${data.risk.toUpperCase()} • workers=${data.projection.projectedWorkers} • RAM peak≈${data.projection.projectedPeakRamPct}% • ${issueText}`;
}

modeGroupEl.addEventListener('click', (event) => {
  const btn = event.target.closest('.chip');
  if (!btn) return;
  setMode(btn.dataset.mode);
});

connectBtnEl?.addEventListener('click', () => {
  setStatus('Account connection UI approved. Next step: wire OAuth/API connector.');
});

for (const el of [providerEl, outMdEl, outSkillsEl, outRawEl]) {
  el.addEventListener('change', renderPlan);
}

refreshHealthBtnEl.addEventListener('click', () => {
  refreshHealth().catch((err) => setStatus(err.message, true));
});
panicBtnEl.addEventListener('click', () => {
  togglePanic().catch((err) => setStatus(err.message, true));
});
validateBtnEl.addEventListener('click', () => {
  runValidation().catch((err) => {
    validatorResultEl.textContent = err.message;
  });
});

importBtnEl.addEventListener('click', async () => {
  try {
    if (panicMode) {
      setStatus('Panic mode is active. Disable panic mode before importing.', true);
      return;
    }

    if (importMode !== 'file') {
      setStatus('Connect-account flow is UI only for now. Approve this design and I will wire provider auth next.');
      return;
    }

    const file = fileInputEl.files?.[0];
    if (!file) {
      setStatus('Please select a history JSON file first.', true);
      return;
    }

    setStatus('Reading file...');
    const text = await file.text();
    const payload = JSON.parse(text);

    setStatus('Importing...');
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerEl.value, payload })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import failed');

    renderStats(data.stats);
    renderConversations(data.conversations);
    await refreshHealth();
    setStatus(`Done. Imported ${data.stats.conversationCount} conversation(s).`);
  } catch (err) {
    setStatus(err.message || 'Failed', true);
  }
});

renderPlan();
renderConversations([]);
refreshHealth().catch(() => {
  setStatus('Failed to load runtime health.', true);
});
