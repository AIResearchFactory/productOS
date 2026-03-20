const providerEl = document.getElementById('provider');
const fileInputEl = document.getElementById('fileInput');
const importBtnEl = document.getElementById('importBtn');
const statusEl = document.getElementById('status');
const statsEl = document.getElementById('stats');
const conversationsEl = document.getElementById('conversations');

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? '#ff9fa9' : '#9fd1ff';
}

function renderStats(stats) {
  statsEl.innerHTML = '';
  const items = [
    ['Conversations', stats.conversationCount],
    ['Messages', stats.messageCount]
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
  for (const conv of conversations) {
    const wrap = document.createElement('div');
    wrap.className = 'conversation';
    wrap.innerHTML = `
      <h3>${conv.title}</h3>
      <div class="meta">${conv.source} • ${conv.messages.length} messages • customGPT=${String(conv.metadata?.isCustomGpt)}</div>
      <div class="messages"></div>
    `;

    const msgRoot = wrap.querySelector('.messages');
    for (const m of conv.messages.slice(0, 8)) {
      const msg = document.createElement('div');
      msg.className = 'msg';
      msg.innerHTML = `<span class="role">${m.role}</span><div>${m.text.replaceAll('<', '&lt;')}</div>`;
      msgRoot.appendChild(msg);
    }

    conversationsEl.appendChild(wrap);
  }
}

importBtnEl.addEventListener('click', async () => {
  try {
    const file = fileInputEl.files?.[0];
    if (!file) {
      setStatus('Please select a JSON export file first.', true);
      return;
    }

    setStatus('Reading file...');
    const text = await file.text();
    const payload = JSON.parse(text);

    setStatus('Importing...');
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: providerEl.value,
        payload
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Import failed');
    }

    renderStats(data.stats);
    renderConversations(data.conversations);
    setStatus(`Done. Imported ${data.stats.conversationCount} conversation(s).`);
  } catch (err) {
    setStatus(err.message || 'Failed', true);
  }
});
