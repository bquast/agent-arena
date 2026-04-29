const params  = new URLSearchParams(location.search);
const taskId  = params.get('id');

const titleEl   = document.getElementById('taskTitle');
const descEl    = document.getElementById('taskDescription');
const runBtn    = document.getElementById('runBtn');
const statusEl  = document.getElementById('runStatus');
const arenaEl   = document.getElementById('arena');
const voteResEl = document.getElementById('voteResult');

const traceA  = document.getElementById('traceA');
const traceB  = document.getElementById('traceB');
const answerA = document.getElementById('answerA');
const answerB = document.getElementById('answerB');
const metaA   = document.getElementById('metaA');
const metaB   = document.getElementById('metaB');
const voteA   = document.getElementById('voteA');
const voteB   = document.getElementById('voteB');

let runId = null;

// ── Load task info ──────────────────────────────────────────────────────────

async function loadTask() {
  if (!taskId) { titleEl.textContent = 'No task ID'; return; }
  try {
    const res = await fetch(`/api/tasks?id=${taskId}`);
    const task = await res.json();
    titleEl.textContent = task.name;
    descEl.innerHTML = `<strong>Task:</strong> ${task.description}<br><br><strong>Prompt sent to agents:</strong><br><code>${task.prompt}</code>`;
  } catch (e) {
    titleEl.textContent = 'Failed to load task';
  }
}

// ── Render a trace array ────────────────────────────────────────────────────

function renderTrace(container, steps) {
  container.innerHTML = '';
  steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'trace-step';
    div.style.animationDelay = `${i * 80}ms`;

    const typeClass = step.type === 'think' ? 'think'
                    : step.type === 'action' ? 'action'
                    : step.type === 'result' ? 'result' : 'error';

    div.innerHTML = `
      <div class="step-header">
        <span class="step-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="step-type ${typeClass}">${step.type.toUpperCase()}</span>
      </div>
      <div class="step-content ${step.type === 'think' ? 'think-content' : ''}">${escHtml(step.content)}</div>
    `;
    container.appendChild(div);
  });
}

function renderAnswer(container, text) {
  container.innerHTML = `
    <div class="final-answer-label">FINAL OUTPUT</div>
    <div class="final-answer-text">${escHtml(text)}</div>
  `;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Run both agents ─────────────────────────────────────────────────────────

runBtn.addEventListener('click', async () => {
  if (!taskId) return;
  runBtn.disabled = true;
  statusEl.innerHTML = '<span class="spinner"></span> Running agents…';
  arenaEl.style.display = 'none';
  voteResEl.style.display = 'none';
  voteA.classList.remove('winner');
  voteB.classList.remove('winner');
  voteA.disabled = false;
  voteB.disabled = false;

  try {
    const res  = await fetch(`/api/run?task_id=${taskId}`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Run failed');

    runId = data.run_id;

    renderTrace(traceA, data.a.steps);
    renderAnswer(answerA, data.a.output);
    metaA.textContent = `${data.a.steps.length} steps · ${data.a.ms}ms`;

    renderTrace(traceB, data.b.steps);
    renderAnswer(answerB, data.b.output);
    metaB.textContent = `${data.b.steps.length} steps · ${data.b.ms}ms`;

    arenaEl.style.display = 'grid';
    statusEl.textContent  = 'Both agents finished. Cast your vote ↓';

  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
    runBtn.disabled = false;
  }
});

// ── Vote ────────────────────────────────────────────────────────────────────

async function castVote(side) {
  if (!runId) return;
  voteA.disabled = true;
  voteB.disabled = true;

  try {
    const res  = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: runId, vote: side })
    });
    const data = await res.json();

    if (side === 'A') voteA.classList.add('winner');
    else              voteB.classList.add('winner');

    voteResEl.style.display = 'block';
    voteResEl.innerHTML = `
      <div class="reveal-label">MODELS REVEALED</div>
      <div class="model-reveal">
        <span class="model-a">α = ${escHtml(data.model_a)}</span>
        &nbsp;·&nbsp;
        <span class="model-b">β = ${escHtml(data.model_b)}</span>
      </div>
      <div style="margin-top:0.5rem;font-size:0.7rem;color:var(--muted)">
        Vote recorded · run_id: ${escHtml(runId)}
      </div>
    `;
  } catch (e) {
    statusEl.textContent = `Vote error: ${e.message}`;
    voteA.disabled = false;
    voteB.disabled = false;
  }
}

voteA.addEventListener('click', () => castVote('A'));
voteB.addEventListener('click', () => castVote('B'));

// ── Init ────────────────────────────────────────────────────────────────────
loadTask();
