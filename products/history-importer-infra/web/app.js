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

let importMode = 'file';

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

importBtnEl.addEventListener('click', async () => {
  try {
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
    setStatus(`Done. Imported ${data.stats.conversationCount} conversation(s).`);
  } catch (err) {
    setStatus(err.message || 'Failed', true);
  }
});

renderPlan();
renderConversations([]);
