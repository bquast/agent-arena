// /functions/api/tasks.js
// GET /api/tasks        → full list
// GET /api/tasks?id=N   → single task

const TASKS = [
  {
    id: '1',
    name: 'Create & populate a file',
    description: 'Agent must create a text file, write structured content to it, and confirm success.',
    category: 'file-ops',
    prompt: `You are an autonomous agent. Complete the following task step by step, 
thinking out loud at each stage.

Task: Create a file called "notes.txt". Write three bullet points about the benefits 
of local LLM inference. Then confirm the file contents.

Format your response as a sequence of steps. For each step, prefix with one of:
THINK: (your reasoning)
ACTION: (what you are doing)
RESULT: (what happened / the output)

End with a line starting with OUTPUT: containing the final file contents.`
  },
  {
    id: '2',
    name: 'Patch text in a file',
    description: 'Agent receives a file with a bug and must locate and patch the specific text.',
    category: 'file-ops',
    prompt: `You are an autonomous agent. Complete the following task step by step,
thinking out loud at each stage.

Task: You have a config file with this content:
---
host: localhos
port: 8080
debug: flase
---
Find and fix all typos/errors in this config. Show your reasoning for each fix.

Format your response as a sequence of steps. For each step, prefix with one of:
THINK: (your reasoning)
ACTION: (what you are doing)
RESULT: (what happened / the output)

End with a line starting with OUTPUT: containing the corrected file contents.`
  },
  {
    id: '3',
    name: 'Append & summarise',
    description: 'Agent appends a log entry to an existing file then writes a one-line summary.',
    category: 'file-ops',
    prompt: `You are an autonomous agent. Complete the following task step by step,
thinking out loud at each stage.

Task: You have a log file with two existing entries:
---
2024-01-01 System started
2024-01-02 Config updated
---
Append a new entry for today with message "Benchmark run completed". 
Then write a one-line summary of the entire log.

Format your response as a sequence of steps. For each step, prefix with one of:
THINK: (your reasoning)
ACTION: (what you are doing)
RESULT: (what happened / the output)

End with a line starting with OUTPUT: containing the full updated log and the summary.`
  },
  {
    id: '4',
    name: 'Parse & transform data',
    description: 'Agent reads CSV-like data, applies a transformation, and writes the result.',
    category: 'data',
    prompt: `You are an autonomous agent. Complete the following task step by step,
thinking out loud at each stage.

Task: You have this CSV data:
---
name,score
alice,82
bob,91
carol,74
dave,88
---
Calculate each person's grade (A=90+, B=80+, C=70+) and produce a new CSV 
with an added "grade" column, sorted by score descending.

Format your response as a sequence of steps. For each step, prefix with one of:
THINK: (your reasoning)
ACTION: (what you are doing)
RESULT: (what happened / the output)

End with a line starting with OUTPUT: containing the transformed CSV.`
  },
  {
    id: '5',
    name: 'Write & self-review code',
    description: 'Agent writes a function, tests it mentally, then patches a bug it finds.',
    category: 'code',
    prompt: `You are an autonomous agent. Complete the following task step by step,
thinking out loud at each stage.

Task: Write a Python function called "word_freq(text)" that returns a dictionary 
of word frequencies (case-insensitive). Then trace through this input to verify it:
"The cat sat on the mat the cat"
If you find any bugs, fix them and re-verify.

Format your response as a sequence of steps. For each step, prefix with one of:
THINK: (your reasoning)
ACTION: (what you are doing)
RESULT: (what happened / the output)

End with a line starting with OUTPUT: containing the final function and the trace result.`
  }
];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const id  = url.searchParams.get('id');

  const headers = { 'Content-Type': 'application/json' };

  if (id) {
    const task = TASKS.find(t => t.id === id);
    if (!task) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
    return new Response(JSON.stringify(task), { headers });
  }

  // Return list without the full prompt (not needed on index)
  const list = TASKS.map(({ id, name, description, category }) => ({ id, name, description, category }));
  return new Response(JSON.stringify(list), { headers });
}
