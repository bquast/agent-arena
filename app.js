// AgentArena.live — app.js

let currentTask  = null;
let taskPool     = [];
let sessionVotes = { A: 0, B: 0, skip: 0 };
let runId        = null;
let battleNum    = 0;

const TASKS = [
  {
    id: '1', name: 'Create & populate a file', category: 'file-ops',
    prompt: `You are an autonomous agent. Complete the following task step by step, thinking out loud at each stage.

Task: Create a file called "notes.txt". Write three bullet points about the benefits of local LLM inference. Then confirm the file contents.

Format your response as a sequence of steps. For each step, prefix with one of:
THINK: (your reasoning)
ACTION: (what you are doing)
RESULT: (what happened / the output)

End with a line starting with OUTPUT: containing the final file contents.`
  },
  {
    id: '2', name: 'Patch typos in a config', category: 'file-ops',
    prompt: `You are an autonomous agent. Complete the following task step by step, thinking out loud at each stage.

Task: You have a config file with this content:
---
host: localhos
port: 8080
debug: flase
---
Find and fix all typos/errors. Show your reasoning for each fix.

Format your response as a sequence of steps. For each step, prefix with one of:
THINK: (your reasoning)
ACTION: (what you are doing)
RESULT: (what happened / the output)

End with a line starting with OUTPUT: containing the corrected file contents.`
  },
  {
    id: '3', name: 'Append & summarise a log', category: 'file-ops',
    prompt: `You are an autonomous agent. Complete the following task step by step, thinking out loud at each stage.

Task: You have a log file:
---
2024-01-01 System started
2024-01-02 Config updated
---
Append a new entry for today: "Benchmark run completed". Then write a one-line summary of the full log.

Format your response as a sequence of steps. For each step, prefix with one of:
THINK: (your reasoning)
ACTION: (what you are doing)
RESULT: (what happened / the output)

End with a line starting with OUTPUT: containing the full updated log and the summary.`
  },
  {
    id: '4', name: 'Transform CSV data', category: 'data',
    prompt: `You are an autonomous agent. Complete the following task step by step, thinking out loud at each stage.

Task: You have this CSV:
---
name,score
alice,82
bob,91
carol,74
dave,88
---
Add a "grade" column (A=90+, B=80+, C=70+) and sort by score descending.

Format your response as a sequence of steps. For each step, prefix with one of:
THINK: (your reasoning)
ACTION: (what you are doing)
RESULT: (what happened / the output)

End with a line starting with OUTPUT: containing the transformed CSV.`
  },
  {
    id: '5', name: 'Write & self-review code', category: 'code',
    prompt: `You are an autonomous agent. Complete the following task step by step, thinking out loud at each stage.

Task: Write a Python function called "word_freq(text)" returning a dict of word frequencies (case-insensitive). Trace through this input to verify: "The cat sat on the mat the cat". Fix any bugs you find.

Format your response as a sequence of steps. For each step, prefix with one of:
THINK: (your reasoning)
ACTION: (what you are doing)
RESULT: (what happened / the output)

End with a line starting with OUTPUT: containing the final function and trace result.`
  }
];

const $ = id => document.getElementById(id);

// ── Init ──────────────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  taskPool = shuffle([...TASKS]);
  loadNextBattle();
});

// ── Battle lifecycle ──────────────────────────────────────────────────────────

async function loadNextBattle() {
  if (taskPool.length === 0) taskPool = shuffle([...TASKS]);

  currentTask = taskPool.pop();
  runId       = null;
  battleNum++;

  // Show arena immediately with running state — no loading gate
  $('loading-screen').style.display = 'none';
  $('arena').style.display          = 'block';
  $('card-a').className             = 'agent-card';
  $('card-b').className             = 'agent-card';
  $('trace-a').innerHTML            = '<div class="trace-placeholder"><span class="inline-spinner"></span> Agent running…</div>';
  $('trace-b').innerHTML            = '<div class="trace-placeholder"><span class="inline-spinner"></span> Agent running…</div>';
  $('output-a').textContent         = '';
  $('output-b').textContent         = '';
  $('status-a').textContent         = 'running…';
  $('status-a').className           = 'card-status running';
  $('status-b').textContent         = 'running…';
  $('status-b').className           = 'card-status running';
  $('model-a-name').textContent     = '';
  $('model-b-name').textContent     = '';
  $('model-a-name').classList.add('hidden');
  $('model-b-name').classList.add('hidden');
  $('vote-a').disabled              = true;
  $('vote-b').disabled              = true;
  $('vote-skip').disabled           = true;
  $('vote-area').style.display      = 'grid';
  $('next-area').style.display      = 'none';

  $('prompt-category').textContent  = currentTask.category;
  $('prompt-num').textContent       = `battle ${battleNum}`;
  $('prompt-text').textContent      = currentTask.name;

  runBattle();
}

async function runBattle() {
  try {
    const res  = await fetch(`/api/run?task_id=${currentTask.id}`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Run failed');

    runId = data.run_id;

    // Render A
    if (data.a && data.a.steps && data.a.steps.length > 0) {
      renderTrace('trace-a', data.a.steps);
      renderOutput('output-a', data.a.output);
      $('status-a').textContent = `${data.a.steps.length} steps · ${data.ms}ms`;
      $('status-a').className   = 'card-status done';
    } else {
      const errA = data.a && data.a.error ? data.a.error : 'No response from model';
      $('trace-a').innerHTML    = `<div class="trace-error">${escHtml(errA)}</div>`;
      $('status-a').textContent = 'error';
      $('status-a').className   = 'card-status error';
    }

    // Render B
    if (data.b && data.b.steps && data.b.steps.length > 0) {
      renderTrace('trace-b', data.b.steps);
      renderOutput('output-b', data.b.output);
      $('status-b').textContent = `${data.b.steps.length} steps · ${data.ms}ms`;
      $('status-b').className   = 'card-status done';
    } else {
      const errB = data.b && data.b.error ? data.b.error : 'No response from model';
      $('trace-b').innerHTML    = `<div class="trace-error">${escHtml(errB)}</div>`;
      $('status-b').textContent = 'error';
      $('status-b').className   = 'card-status error';
    }

  } catch (e) {
    ['a', 'b'].forEach(s => {
      $(`trace-${s}`).innerHTML    = `<div class="trace-error">${escHtml(e.message)}</div>`;
      $(`status-${s}`).textContent = 'error';
      $(`status-${s}`).className   = 'card-status error';
    });
  }

  // Enable voting regardless of errors
  $('vote-a').disabled    = false;
  $('vote-b').disabled    = false;
  $('vote-skip').disabled = false;
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderTrace(elId, steps) {
  const el = $(elId);
  el.innerHTML = '';
  steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'trace-step';
    div.style.animationDelay = `${i * 60}ms`;
    const typeClass = { think: 'think', action: 'action', result: 'result', error: 'step-error' }[step.type] || '';
    div.innerHTML = `
      <div class="step-header">
        <span class="step-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="step-type ${typeClass}">${step.type.toUpperCase()}</span>
      </div>
      <div class="step-content ${step.type === 'think' ? 'think-content' : ''}">${escHtml(step.content)}</div>
    `;
    el.appendChild(div);
  });
}

function renderOutput(elId, text) {
  $(elId).textContent = text || '(no output)';
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Voting ────────────────────────────────────────────────────────────────────

window.vote = async function(choice) {
  $('vote-a').disabled    = true;
  $('vote-b').disabled    = true;
  $('vote-skip').disabled = true;

  if (choice === 'A') {
    $('card-a').className = 'agent-card winner';
    $('card-b').className = 'agent-card loser';
    sessionVotes.A++;
  } else if (choice === 'B') {
    $('card-b').className = 'agent-card winner';
    $('card-a').className = 'agent-card loser';
    sessionVotes.B++;
  } else {
    sessionVotes.skip++;
  }

  $('vote-area').style.display = 'none';
  $('next-area').style.display = 'flex';

  try {
    const res  = await fetch('/api/vote', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ run_id: runId, vote: choice === 'skip' ? 'skip' : choice })
    });
    const data = await res.json();

    // Reveal actual model names from D1
    if (data.model_a) {
      $('model-a-name').textContent = data.model_a;
      $('model-a-name').classList.remove('hidden');
    }
    if (data.model_b) {
      $('model-b-name').textContent = data.model_b;
      $('model-b-name').classList.remove('hidden');
    }

    const winner = choice === 'A' ? data.model_a : choice === 'B' ? data.model_b : 'skipped';
    const tally  = `α ${sessionVotes.A}  ·  β ${sessionVotes.B}  ·  skipped ${sessionVotes.skip}`;
    $('vote-result').textContent = choice === 'skip'
      ? `skipped  ·  ${tally}`
      : `${winner} won  ·  ${tally}`;

  } catch (e) {
    $('vote-result').textContent = choice === 'skip' ? 'skipped' : `voted ${choice}`;
    console.warn('[vote] failed:', e.message);
  }
};

window.nextBattle = loadNextBattle;

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
