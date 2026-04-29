// /functions/api/vote.js
// POST /api/vote   body: { run_id, vote: "A" | "B" }
//
// D1 binding: DB

export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  const { env } = context;
  const headers = { 'Content-Type': 'application/json' };

  let body;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { run_id, vote } = body;
  if (!run_id || !['A', 'B'].includes(vote)) {
    return new Response(JSON.stringify({ error: 'run_id and vote (A|B) required' }), { status: 400, headers });
  }

  try {
    // Fetch run to get model names for the reveal
    const run = await env.DB.prepare(`
      SELECT model_a, model_b FROM runs WHERE id = ?
    `).bind(run_id).first();

    if (!run) return new Response(JSON.stringify({ error: 'Run not found' }), { status: 404, headers });

    // Record vote
    await env.DB.prepare(`
      INSERT INTO votes (id, run_id, vote, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      run_id,
      vote,
      new Date().toISOString()
    ).run();

    return new Response(JSON.stringify({
      ok:      true,
      model_a: run.model_a,
      model_b: run.model_b
    }), { headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}
