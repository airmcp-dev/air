# Example: GitHub Issues

A GitHub API wrapper as MCP tools. AI can list, create, comment, label, and close issues.

## Full code

```typescript
// src/index.ts
import {
  defineServer, defineTool,
  timeoutPlugin, retryPlugin, cachePlugin, authPlugin,
} from '@airmcp-dev/core';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const DEFAULT_OWNER = process.env.GITHUB_OWNER || '';
const DEFAULT_REPO = process.env.GITHUB_REPO || '';

async function gh(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  return res.json();
}

function resolveRepo(owner?: string, repo?: string) {
  const o = owner || DEFAULT_OWNER;
  const r = repo || DEFAULT_REPO;
  if (!o || !r) throw new Error('Specify owner/repo or set GITHUB_OWNER/GITHUB_REPO env vars');
  return { owner: o, repo: r };
}

const server = defineServer({
  name: 'github-issues',
  version: '1.0.0',
  transport: { type: 'sse', port: 3510 },

  use: [
    authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!], publicTools: ['issue_list'] }),
    timeoutPlugin(15_000),
    retryPlugin({ maxRetries: 2, retryOn: (e) => e.message.includes('fetch failed') }),
    cachePlugin({ ttlMs: 30_000, exclude: ['issue_create', 'issue_comment', 'issue_label', 'issue_close'] }),
  ],

  tools: [
    defineTool('issue_list', {
      description: 'List issues',
      params: {
        owner: { type: 'string', optional: true }, repo: { type: 'string', optional: true },
        state: { type: 'string', description: '"open", "closed", "all"', optional: true },
        labels: { type: 'string', description: 'Comma-separated labels', optional: true },
        limit: { type: 'number', optional: true },
      },
      handler: async ({ owner, repo, state, labels, limit }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        const params = new URLSearchParams({ state: state || 'open', per_page: String(limit || 10) });
        if (labels) params.set('labels', labels);
        const issues = await gh(`/repos/${o}/${r}/issues?${params}`);
        return issues.map((i: any) => ({
          number: i.number, title: i.title, state: i.state,
          labels: i.labels.map((l: any) => l.name), author: i.user.login, comments: i.comments,
        }));
      },
    }),

    defineTool('issue_read', {
      description: 'Read issue details and comments',
      params: { number: 'number', owner: { type: 'string', optional: true }, repo: { type: 'string', optional: true } },
      handler: async ({ number, owner, repo }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        const [issue, comments] = await Promise.all([
          gh(`/repos/${o}/${r}/issues/${number}`),
          gh(`/repos/${o}/${r}/issues/${number}/comments`),
        ]);
        return {
          number: issue.number, title: issue.title, body: issue.body, state: issue.state,
          labels: issue.labels.map((l: any) => l.name),
          comments: comments.map((c: any) => ({ author: c.user.login, body: c.body, created: c.created_at })),
        };
      },
    }),

    defineTool('issue_create', {
      description: 'Create a new issue',
      params: {
        title: 'string',
        body: { type: 'string', optional: true },
        labels: { type: 'string', optional: true },
        owner: { type: 'string', optional: true }, repo: { type: 'string', optional: true },
      },
      handler: async ({ title, body, labels, owner, repo }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        const payload: any = { title };
        if (body) payload.body = body;
        if (labels) payload.labels = labels.split(',').map((l: string) => l.trim());
        const issue = await gh(`/repos/${o}/${r}/issues`, { method: 'POST', body: JSON.stringify(payload) });
        return { number: issue.number, url: issue.html_url, message: `#${issue.number} created` };
      },
    }),

    defineTool('issue_comment', {
      description: 'Add a comment to an issue',
      params: { number: 'number', body: 'string', owner: { type: 'string', optional: true }, repo: { type: 'string', optional: true } },
      handler: async ({ number, body, owner, repo }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        await gh(`/repos/${o}/${r}/issues/${number}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
        return { message: `Comment added to #${number}` };
      },
    }),

    defineTool('issue_close', {
      description: 'Close an issue',
      params: { number: 'number', owner: { type: 'string', optional: true }, repo: { type: 'string', optional: true } },
      handler: async ({ number, owner, repo }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        await gh(`/repos/${o}/${r}/issues/${number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
        return { number, message: `#${number} closed` };
      },
    }),

    defineTool('issue_label', {
      description: 'Add labels to an issue',
      params: { number: 'number', labels: 'string', owner: { type: 'string', optional: true }, repo: { type: 'string', optional: true } },
      handler: async ({ number, labels, owner, repo }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        const labelList = labels.split(',').map((l: string) => l.trim());
        await gh(`/repos/${o}/${r}/issues/${number}/labels`, { method: 'POST', body: JSON.stringify({ labels: labelList }) });
        return { number, labels: labelList, message: `Labels added to #${number}` };
      },
    }),
  ],
});

server.start();
```

## Environment variables

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxx       # Required
GITHUB_OWNER=your-org               # Default owner
GITHUB_REPO=your-repo               # Default repo
MCP_API_KEY=your-key                # MCP auth (optional)
```

## Usage

- "List open issues" → `issue_list`
- "Show issue #42 details and comments" → `issue_read`
- "Create an issue titled 'Fix CI pipeline'" → `issue_create`
- "Add a comment to #42: 'Confirmed, will fix next sprint'" → `issue_comment`
- "Add bug, priority-high labels to #42" → `issue_label`
- "Close issue #42" → `issue_close`
