// /functions/api/run.js
// POST /api/run?task_id=N
//
// Env vars required (set in Pages dashboard → Settings → Environment variables):
//   MODEL_A_NAME    e.g. "claude-3-5-haiku-20241022"
//   MODEL_A_URL     e.g. "https://api.anthropic.com/v1/messages"
//   MODEL_A_KEY     your API key
//   MODEL_A_PROVIDER  "anthropic" | "openai"   (affects request shape)
//
//   MODEL_B_NAME / MODEL_B_URL / MODEL_B_KEY / MODEL_B_PROVIDER
//
// D1 binding: DB  (set in Pages dashboard → Settings → Functions → D1 bindings)

function parseTrace(rawText) {
  const lines   = rawText.split('\n');
  const steps   = [];
  const prefixes = ['THINK:', 'ACTION:', 'RESULT:', 'ERROR:'];
  let current   = null;

  for (const line of lines) {
    const trimmed = line.trim();
    let matched = false;
    for (const p of prefixes) {
      if (trimmed.startsWith(p)) {
        if (current) steps.push(current);
        current = {
          type:    p.replace(':', '').toLowerCase(),
          content: trimmed.slice(p.length).trim()
        };
        matched = true;
        break;
      }
    }
    if (!matched && current && trimmed && !trimmed.startsWith('OUTPUT:')) {
      current.content += '\n' + trimmed;
    }
  }
  if (current) steps.push(current);

  // Extract OUTPUT line
  const outputLine = rawText.split('\n').find(l => l.trim().startsWith('OUTPUT:'));
  const output = outputLine ? outputLine.trim().slice(7).trim() : rawText;

  return { steps, output };
}

async function callModel(provider, url, key, model, prompt) {
  let body, headers;

  if (provider === 'anthropic') {
    headers = {
      'Content-Type':      'application/json',
      'x-api-key':         key,
      'anthropic-version': '2023-06-01'
    };
    body = JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
  } else {
    // OpenAI-compatible
    headers = {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`
    };
    body = JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
  }

  const res  = await fetch(url, { method: 'POST', headers, body });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));

  // Extract text from either format
  let text;
  if (provider === 'anthropic') {
    text = data.content?.[0]?.text ?? '';
  } else {
    text = data.choices?.[0]?.message?.content ?? '';
  }
  return text;
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const { env } = context;
  const url     = new URL(context.request.url);
  const taskId  = url.searchParams.get('task_id');

  if (!taskId) return new Response(JSON.stringify({ error: 'task_id required' }), { status: 400 });

  // Fetch task prompt from our own /api/tasks endpoint
  const taskRes  = await fetch(`${url.origin}/api/tasks?id=${taskId}`);
  const task     = await taskRes.json();
  if (!task.prompt) return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404 });

  const headers = { 'Content-Type': 'application/json' };

  try {
    const t0 = Date.now();
    const [rawA, rawB] = await Promise.all([
      callModel(
        env.MODEL_A_PROVIDER || 'anthropic',
        env.MODEL_A_URL      || 'https://api.anthropic.com/v1/messages',
        env.MODEL_A_KEY,
        env.MODEL_A_NAME,
        task.prompt
      ),
      callModel(
        env.MODEL_B_PROVIDER || 'anthropic',
        env.MODEL_B_URL      || 'https://api.anthropic.com/v1/messages',
        env.MODEL_B_KEY,
        env.MODEL_B_NAME,
        task.prompt
      )
    ]);
    const ms = Date.now() - t0;

    const traceA = parseTrace(rawA);
    const traceB = parseTrace(rawB);

    // Store run in D1 (binding name: DB)
    const runId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO runs (id, task_id, model_a, model_b, trace_a, trace_b, ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      runId,
      taskId,
      env.MODEL_A_NAME,
      env.MODEL_B_NAME,
      JSON.stringify(traceA),
      JSON.stringify(traceB),
      ms,
      new Date().toISOString()
    ).run();

    return new Response(JSON.stringify({
      run_id: runId,
      a: { ...traceA, ms },
      b: { ...traceB, ms }
    }), { headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
