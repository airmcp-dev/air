# Example: AI Agent

An agent server with the think → execute → remember pattern. AI analyzes problems, executes plans, and remembers results.

## Create project

```bash
npx @airmcp-dev/cli create my-agent --template agent
cd my-agent
npm install
```

## Full code

```typescript
// src/index.ts
import {
  defineServer, defineTool, createStorage, onShutdown,
  retryPlugin, timeoutPlugin,
} from '@airmcp-dev/core';

const memory = await createStorage({ type: 'file', path: '.air/memory' });

const server = defineServer({
  name: 'my-agent',
  version: '1.0.0',
  description: 'AI agent — think, execute, remember',
  transport: { type: 'sse', port: 3510 },

  use: [
    timeoutPlugin(60_000),
    retryPlugin({ maxRetries: 1 }),
  ],

  tools: [
    defineTool('think', {
      description: 'Analyze a problem and generate an execution plan',
      layer: 7,
      params: {
        problem: { type: 'string', description: 'Problem to solve' },
        context: { type: 'string', description: 'Additional context', optional: true },
      },
      handler: async ({ problem, context }) => {
        // TODO: Connect LLM here
        const plan = {
          problem,
          steps: ['1. Understand the problem', '2. Gather data', '3. Execute solution', '4. Verify result'],
          reasoning: 'Replace with LLM-generated reasoning',
        };
        await memory.set('thoughts', `thought_${Date.now()}`, { ...plan, timestamp: new Date().toISOString() });
        return plan;
      },
    }),

    defineTool('execute', {
      description: 'Execute a step from the plan',
      layer: 6,
      params: {
        step: { type: 'string', description: 'Step description' },
        input: { type: 'string', description: 'Input data for the step', optional: true },
      },
      handler: async ({ step, input }) => {
        const result = { step, status: 'completed', output: `Executed: ${step}`, timestamp: new Date().toISOString() };
        await memory.set('executions', `exec_${Date.now()}`, result);
        return result;
      },
    }),

    defineTool('remember', {
      description: 'Store or recall information from agent memory',
      layer: 1,
      params: {
        action: { type: 'string', description: '"store" or "recall"' },
        key: { type: 'string', description: 'Memory key' },
        value: { type: 'string', description: 'Value to store', optional: true },
      },
      handler: async ({ action, key, value }) => {
        if (action === 'store' && value) {
          await memory.set('facts', key, { value, storedAt: new Date().toISOString() });
          return { action: 'stored', key };
        }
        if (action === 'recall') {
          const data = await memory.get('facts', key);
          return data ? { action: 'recall', key, found: true, data } : { action: 'recall', key, found: false };
        }
        return { error: 'Use "store" or "recall"' };
      },
    }),

    defineTool('memory_search', {
      description: 'Search recent thoughts/executions in memory',
      layer: 2,
      params: {
        type: { type: 'string', description: '"thoughts", "executions", or "facts"' },
        limit: { type: 'number', description: 'Max results', optional: true },
      },
      handler: async ({ type, limit }) => {
        const entries = await memory.entries(type);
        return entries.slice(0, limit || 10);
      },
    }),
  ],
});

onShutdown(async () => { await memory.close(); });
server.start();
```

## Usage scenario

1. "Analyze why our login failure rate is high" → `think`
2. "Execute step 1: collect log data" → `execute`
3. "Save the analysis as 'login-issue-2025'" → `remember(store)`
4. "Recall 'login-issue-2025'" → `remember(recall)`
5. "Show my last 5 thoughts" → `memory_search(thoughts, 5)`

## Meter classification

| Tool | Layer | Reason |
|------|-------|--------|
| `think` | L7 | Agent reasoning (high cost with LLM) |
| `execute` | L6 | External action execution |
| `remember` | L1 | Simple key-value lookup |
| `memory_search` | L2 | Memory search |

## LLM integration

Connect a real LLM to the `think` tool:

```typescript
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

handler: async ({ problem, context }) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Analyze the problem and return a step-by-step plan as JSON.' },
      { role: 'user', content: `Problem: ${problem}\nContext: ${context || 'none'}` },
    ],
    response_format: { type: 'json_object' },
  });
  const plan = JSON.parse(response.choices[0].message.content!);
  await memory.set('thoughts', `thought_${Date.now()}`, plan);
  return plan;
},
```
