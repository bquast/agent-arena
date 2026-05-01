# Agent Arena

<https://AgentsArena.live>

Head-to-head agentic task evaluation. Two anonymous LLMs get the same task, 
you inspect their reasoning traces and vote for the better agent.

## File structure

```
index.html          task list
task.html           battle page
style.css
app.js              index page logic
task.js             task page logic
schema.sql          D1 init (run once)
functions/
  api/
    tasks.js        GET /api/tasks[?id=N]
    run.js          POST /api/run?task_id=N
    vote.js         POST /api/vote
```

## Setup (all in Cloudflare dashboard, no wrangler.toml needed)

### 1. Create a D1 database
Pages → Workers & Pages → D1 → Create database (e.g. `agent-arena`)

Run schema.sql in the D1 Console tab.

### 2. Bind D1 to your Pages project
Pages → your project → Settings → Functions → D1 database bindings  
Variable name: `DB`  
Database: `agent-arena`

### 3. Set environment variables
Pages → Settings → Environment variables → Production (and Preview if needed)

| Variable         | Example value                                |
|------------------|----------------------------------------------|
| MODEL_A_NAME     | claude-3-5-haiku-20241022                    |
| MODEL_A_URL      | https://api.anthropic.com/v1/messages        |
| MODEL_A_KEY      | sk-ant-...                                   |
| MODEL_A_PROVIDER | anthropic                                    |
| MODEL_B_NAME     | gpt-4o-mini                                  |
| MODEL_B_URL      | https://api.openai.com/v1/chat/completions   |
| MODEL_B_KEY      | sk-...                                       |
| MODEL_B_PROVIDER | openai                                       |

`MODEL_*_PROVIDER` can be `anthropic` or `openai` (OpenAI-compatible endpoint).

### 4. Deploy
Push to your connected git repo or drag-drop to Pages.

## How it works

1. User picks a task from the list
2. Clicks "Run Both Agents" → POST /api/run calls both models in parallel
3. Traces are parsed (THINK / ACTION / RESULT steps) and rendered side-by-side
4. User votes → POST /api/vote stores the result in D1 and reveals model names

## Adding tasks
Edit `functions/api/tasks.js` — the `TASKS` array. Each task needs:
- `id` (unique string)
- `name`, `description`, `category`  
- `prompt` — the full prompt sent to the agent, using THINK/ACTION/RESULT/OUTPUT format
