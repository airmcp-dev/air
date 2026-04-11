# 예제: GitHub 이슈 관리

GitHub API를 MCP 도구로 래핑한 서버. AI가 이슈를 조회, 생성, 댓글 추가, 라벨 관리를 할 수 있습니다.

## 전체 코드

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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

function resolveRepo(owner?: string, repo?: string) {
  const o = owner || DEFAULT_OWNER;
  const r = repo || DEFAULT_REPO;
  if (!o || !r) throw new Error('owner와 repo를 지정하거나 GITHUB_OWNER/GITHUB_REPO 환경변수를 설정하세요');
  return { owner: o, repo: r };
}

const server = defineServer({
  name: 'github-issues',
  version: '1.0.0',
  description: 'GitHub 이슈 관리 MCP 서버',

  transport: { type: 'sse', port: 3510 },

  use: [
    authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!], publicTools: ['issue_list'] }),
    timeoutPlugin(15_000),
    retryPlugin({ maxRetries: 2, retryOn: (e) => e.message.includes('fetch failed') }),
    cachePlugin({ ttlMs: 30_000, exclude: ['issue_create', 'issue_comment', 'issue_label', 'issue_close'] }),
  ],

  tools: [
    defineTool('issue_list', {
      description: '이슈 목록을 조회합니다',
      params: {
        owner: { type: 'string', description: '저장소 소유자', optional: true },
        repo: { type: 'string', description: '저장소 이름', optional: true },
        state: { type: 'string', description: '"open", "closed", "all" (기본: open)', optional: true },
        labels: { type: 'string', description: '쉼표로 구분된 라벨 필터', optional: true },
        limit: { type: 'number', description: '최대 개수 (기본: 10)', optional: true },
      },
      handler: async ({ owner, repo, state, labels, limit }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        const params = new URLSearchParams({
          state: state || 'open',
          per_page: String(limit || 10),
        });
        if (labels) params.set('labels', labels);

        const issues = await gh(`/repos/${o}/${r}/issues?${params}`);
        return issues.map((i: any) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          labels: i.labels.map((l: any) => l.name),
          author: i.user.login,
          created: i.created_at,
          comments: i.comments,
        }));
      },
    }),

    defineTool('issue_read', {
      description: '이슈 상세 정보와 댓글을 조회합니다',
      params: {
        number: { type: 'number', description: '이슈 번호' },
        owner: { type: 'string', optional: true },
        repo: { type: 'string', optional: true },
      },
      handler: async ({ number, owner, repo }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        const [issue, comments] = await Promise.all([
          gh(`/repos/${o}/${r}/issues/${number}`),
          gh(`/repos/${o}/${r}/issues/${number}/comments`),
        ]);
        return {
          number: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          labels: issue.labels.map((l: any) => l.name),
          author: issue.user.login,
          created: issue.created_at,
          comments: comments.map((c: any) => ({
            author: c.user.login,
            body: c.body,
            created: c.created_at,
          })),
        };
      },
    }),

    defineTool('issue_create', {
      description: '새 이슈를 생성합니다',
      params: {
        title: { type: 'string', description: '이슈 제목' },
        body: { type: 'string', description: '이슈 본문 (Markdown)', optional: true },
        labels: { type: 'string', description: '쉼표로 구분된 라벨', optional: true },
        owner: { type: 'string', optional: true },
        repo: { type: 'string', optional: true },
      },
      handler: async ({ title, body, labels, owner, repo }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        const payload: any = { title };
        if (body) payload.body = body;
        if (labels) payload.labels = labels.split(',').map((l: string) => l.trim());

        const issue = await gh(`/repos/${o}/${r}/issues`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        return { number: issue.number, url: issue.html_url, message: `#${issue.number} 생성됨` };
      },
    }),

    defineTool('issue_comment', {
      description: '이슈에 댓글을 추가합니다',
      params: {
        number: { type: 'number', description: '이슈 번호' },
        body: { type: 'string', description: '댓글 내용 (Markdown)' },
        owner: { type: 'string', optional: true },
        repo: { type: 'string', optional: true },
      },
      handler: async ({ number, body, owner, repo }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        const comment = await gh(`/repos/${o}/${r}/issues/${number}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body }),
        });
        return { commentId: comment.id, message: `#${number}에 댓글 추가됨` };
      },
    }),

    defineTool('issue_close', {
      description: '이슈를 닫습니다',
      params: {
        number: { type: 'number', description: '이슈 번호' },
        owner: { type: 'string', optional: true },
        repo: { type: 'string', optional: true },
      },
      handler: async ({ number, owner, repo }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        await gh(`/repos/${o}/${r}/issues/${number}`, {
          method: 'PATCH',
          body: JSON.stringify({ state: 'closed' }),
        });
        return { number, message: `#${number} 닫힘` };
      },
    }),

    defineTool('issue_label', {
      description: '이슈에 라벨을 추가합니다',
      params: {
        number: { type: 'number', description: '이슈 번호' },
        labels: { type: 'string', description: '쉼표로 구분된 라벨' },
        owner: { type: 'string', optional: true },
        repo: { type: 'string', optional: true },
      },
      handler: async ({ number, labels, owner, repo }) => {
        const { owner: o, repo: r } = resolveRepo(owner, repo);
        const labelList = labels.split(',').map((l: string) => l.trim());
        await gh(`/repos/${o}/${r}/issues/${number}/labels`, {
          method: 'POST',
          body: JSON.stringify({ labels: labelList }),
        });
        return { number, labels: labelList, message: `#${number}에 라벨 추가됨` };
      },
    }),
  ],
});

server.start();
```

## 환경변수

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxx       # GitHub Personal Access Token (필수)
GITHUB_OWNER=your-org               # 기본 저장소 소유자
GITHUB_REPO=your-repo               # 기본 저장소 이름
MCP_API_KEY=your-mcp-key            # MCP 인증 키 (선택)
```

## 실행

```bash
GITHUB_TOKEN=ghp_xxx GITHUB_OWNER=airmcp-dev GITHUB_REPO=air \
  npx @airmcp-dev/cli dev --console -p 3510
```

## 사용 예시

- "air 저장소의 열린 이슈 목록 보여줘"
- "이슈 #42의 상세 내용과 댓글을 보여줘"
- "'CI 파이프라인 개선' 제목으로 새 이슈를 만들어줘. 본문에 현재 빌드 시간이 느리다고 적어줘"
- "이슈 #42에 '확인했습니다. 다음 스프린트에 포함하겠습니다.' 댓글을 달아줘"
- "이슈 #42에 bug, priority-high 라벨을 추가해줘"
- "이슈 #42를 닫아줘"

## 플러그인 활용

- `authPlugin` — MCP_API_KEY로 인증. `issue_list`는 공개(publicTools)
- `timeoutPlugin` — GitHub API 응답 15초 제한
- `retryPlugin` — 네트워크 에러 시 2회 재시도
- `cachePlugin` — 조회 결과 30초 캐시. 쓰기 도구(create/comment/label/close)는 제외
