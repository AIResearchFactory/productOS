const healthPanelEl = document.getElementById('healthPanel');
const refreshHealthBtnEl = document.getElementById('refreshHealthBtn');
const panicBtnEl = document.getElementById('panicBtn');
const validateBtnEl = document.getElementById('validateBtn');
const applyOptimizeBtnEl = document.getElementById('applyOptimizeBtn');
const validatorResultEl = document.getElementById('validatorResult');
const competitorCountEl = document.getElementById('competitorCount');
const fanoutStepsEl = document.getElementById('fanoutSteps');
const perTaskRamMbEl = document.getElementById('perTaskRamMb');

let panicMode = false;

function collectPlanInput() {
  return {
    competitorCount: Number(competitorCountEl.value || 0),
    fanoutSteps: Number(fanoutStepsEl.value || 0),
    perTaskRamMb: Number(perTaskRamMbEl.value || 0)
  };
}

function renderHealth(state) {
  panicMode = Boolean(state.panicMode);
  healthPanelEl.innerHTML = `
    <div class="stat">Mode: <strong>${state.mode}</strong></div>
    <div class="stat">Workers: <strong>${state.activeWorkers}/${state.maxWorkers}</strong></div>
    <div class="stat">RAM: <strong>${state.memory.usedPct}%</strong> (${state.memory.usedMb}MB / ${state.memory.totalMb}MB)</div>
    <div class="stat">Queue: <strong>${state.queueDepth}</strong></div>
    <div class="stat">Safe Profile: <strong>${state.safeProfile?.enforced ? `ON (max=${state.safeProfile.globalMaxParallel}, batch=${state.safeProfile.batchSize})` : 'OFF'}</strong></div>
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
}

async function runValidation() {
  validatorResultEl.textContent = 'Running validator...';
  const plan = collectPlanInput();
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

async function applySafeOptimization() {
  validatorResultEl.textContent = 'Applying safe profile...';
  const plan = collectPlanInput();

  const res = await fetch('/api/optimize/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to apply safe profile');

  await refreshHealth();
  validatorResultEl.textContent = `Safe profile enforced: maxParallel=${data.profile.globalMaxParallel}, batchSize=${data.profile.batchSize}, timeoutMs=${data.profile.timeoutMs}.`;
}

refreshHealthBtnEl.addEventListener('click', () => refreshHealth().catch((e) => (validatorResultEl.textContent = e.message)));
panicBtnEl.addEventListener('click', () => togglePanic().catch((e) => (validatorResultEl.textContent = e.message)));
validateBtnEl.addEventListener('click', () => runValidation().catch((e) => (validatorResultEl.textContent = e.message)));
applyOptimizeBtnEl.addEventListener('click', () => applySafeOptimization().catch((e) => (validatorResultEl.textContent = e.message)));

refreshHealth().catch((e) => {
  validatorResultEl.textContent = e.message;
});
