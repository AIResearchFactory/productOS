const healthPanelEl = document.getElementById('healthPanel');
const panicBtnEl = document.getElementById('panicBtn');
const runtimeControlsEl = document.getElementById('runtimeControls');

const applyOptimizeBtnEl = document.getElementById('applyOptimizeBtn');
const keepCurrentBtnEl = document.getElementById('keepCurrentBtn');

const problemBoxEl = document.getElementById('problemBox');
const recommendedBoxEl = document.getElementById('recommendedBox');
const approvalNoteEl = document.getElementById('approvalNote');

const competitorCountEl = document.getElementById('competitorCount');
const fanoutStepsEl = document.getElementById('fanoutSteps');
const perTaskRamMbEl = document.getElementById('perTaskRamMb');

let panicMode = false;
let lastValidation = null;

function collectPlanInput() {
  return {
    competitorCount: Number(competitorCountEl.value || 0),
    fanoutSteps: Number(fanoutStepsEl.value || 0),
    perTaskRamMb: Number(perTaskRamMbEl.value || 0)
  };
}

function renderHealth(state) {
  panicMode = Boolean(state.panicMode);
  const runActive = Number(state.activeWorkers || 0) > 0;

  healthPanelEl.innerHTML = `
    <div class="stat">Mode: <strong>${state.mode}</strong></div>
    <div class="stat">Workers: <strong>${state.activeWorkers}/${state.maxWorkers}</strong></div>
    <div class="stat">Memory: <strong>${state.memory.usedPct}%</strong> (${state.memory.usedMb}MB/${state.memory.totalMb}MB)</div>
  `;

  runtimeControlsEl.classList.toggle('hidden', !runActive);
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
}

function renderDecision(validation) {
  const sMap = new Map(validation.suggestions.map((s) => [s.path, s.value]));
  const issues = validation.issues.map((i) => i.message).join(' | ') || 'No major issues detected.';

  problemBoxEl.classList.add('problem-box');
  recommendedBoxEl.classList.add('solution-box');

  if (validation.risk === 'low') {
    problemBoxEl.innerHTML = `<strong>Problem:</strong> No major risk detected.`;
  } else {
    problemBoxEl.innerHTML = `<strong>Problem:</strong> High risk due to parallel load (${validation.projection.projectedWorkers} concurrent units). ${issues}`;
  }

  recommendedBoxEl.innerHTML = `
    <strong>Recommended setup:</strong>
    max workers <strong>${sMap.get('globalMaxParallel') ?? '-'}</strong>,
    batch size <strong>${sMap.get('batchSize') ?? '-'}</strong>,
    timeout <strong>${sMap.get('stepDefaults.timeoutMs') ?? '-'} ms</strong>,
    retries <strong>${sMap.get('stepDefaults.maxRetries') ?? '-'}</strong>.
  `;

  approvalNoteEl.textContent = validation.risk === 'low'
    ? 'Optional: You can still apply recommendations for consistency.'
    : 'Recommended action: Apply Recommended Setup before run.';
}

async function runValidation() {
  const plan = collectPlanInput();
  const res = await fetch('/api/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Validation failed');

  lastValidation = data;
  renderDecision(data);
}

async function applySafeOptimization() {
  const plan = collectPlanInput();
  const res = await fetch('/api/optimize/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to apply safe profile');

  approvalNoteEl.textContent = `Applied: max workers ${data.profile.globalMaxParallel}, batch ${data.profile.batchSize}.`;
  await refreshHealth();
}

function keepCurrentSetup() {
  approvalNoteEl.textContent = 'Kept current setup. No changes applied.';
}

panicBtnEl.addEventListener('click', () => togglePanic().catch((e) => (approvalNoteEl.textContent = e.message)));
applyOptimizeBtnEl.addEventListener('click', () => applySafeOptimization().catch((e) => (approvalNoteEl.textContent = e.message)));
keepCurrentBtnEl.addEventListener('click', keepCurrentSetup);

let validationDebounce;
for (const el of [competitorCountEl, fanoutStepsEl, perTaskRamMbEl]) {
  el.addEventListener('input', () => {
    clearTimeout(validationDebounce);
    validationDebounce = setTimeout(() => {
      runValidation().catch((e) => (approvalNoteEl.textContent = e.message));
    }, 250);
  });
}

refreshHealth().catch((e) => {
  approvalNoteEl.textContent = e.message;
});
runValidation().catch((e) => {
  approvalNoteEl.textContent = e.message;
});
setInterval(() => {
  refreshHealth().catch(() => {});
}, 3000);
