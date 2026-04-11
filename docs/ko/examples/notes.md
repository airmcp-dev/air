# 예제: Markdown 노트

FileStore를 사용하는 개인 노트 관리 서버. 노트 생성, 조회, 검색, 태그 관리를 지원합니다. 별도 DB 없이 `.air/notes` 디렉토리에 JSON으로 저장됩니다.

## 전체 코드

```typescript
// src/index.ts
import {
  defineServer, defineTool, defineResource, createStorage, onShutdown,
  sanitizerPlugin, cachePlugin,
} from '@airmcp-dev/core';

const store = await createStorage({ type: 'file', path: '.air/notes' });

const server = defineServer({
  name: 'note-server',
  version: '1.0.0',
  description: 'Markdown 노트 관리 MCP 서버',

  transport: { type: 'sse', port: 3510 },

  use: [
    sanitizerPlugin({ exclude: ['note_create', 'note_update'] }),  // 노트 본문은 HTML 허용
    cachePlugin({ ttlMs: 10_000, exclude: ['note_create', 'note_update', 'note_delete'] }),
  ],

  tools: [
    defineTool('note_create', {
      description: '새 노트를 생성합니다',
      params: {
        title: { type: 'string', description: '노트 제목' },
        content: { type: 'string', description: '노트 본문 (Markdown)' },
        tags: { type: 'string', description: '쉼표로 구분된 태그 (예: "work,important")', optional: true },
      },
      handler: async ({ title, content, tags }) => {
        const id = `note_${Date.now()}`;
        const note = {
          id,
          title,
          content,
          tags: tags ? tags.split(',').map((t: string) => t.trim()) : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await store.set('notes', id, note);
        await store.append('activity', { action: 'create', noteId: id, title });
        return { id, message: `"${title}" 생성됨` };
      },
    }),

    defineTool('note_read', {
      description: '노트를 ID로 조회합니다',
      params: {
        id: { type: 'string', description: '노트 ID' },
      },
      handler: async ({ id }) => {
        const note = await store.get('notes', id);
        if (!note) return { error: '노트를 찾을 수 없습니다', id };
        return note;
      },
    }),

    defineTool('note_list', {
      description: '모든 노트의 제목과 태그를 나열합니다',
      params: {
        tag: { type: 'string', description: '태그로 필터링 (선택)', optional: true },
      },
      handler: async ({ tag }) => {
        const entries = await store.entries<any>('notes');
        let notes = entries.map(e => ({
          id: e.key,
          title: e.value.title,
          tags: e.value.tags,
          updatedAt: e.value.updatedAt,
        }));

        if (tag) {
          notes = notes.filter(n => n.tags.includes(tag));
        }

        notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return { count: notes.length, notes };
      },
    }),

    defineTool('note_search', {
      description: '노트 제목과 본문에서 키워드를 검색합니다',
      params: {
        query: { type: 'string', description: '검색어' },
      },
      handler: async ({ query }) => {
        const entries = await store.entries<any>('notes');
        const q = query.toLowerCase();
        const results = entries
          .filter(e =>
            e.value.title.toLowerCase().includes(q) ||
            e.value.content.toLowerCase().includes(q)
          )
          .map(e => ({
            id: e.key,
            title: e.value.title,
            snippet: e.value.content.substring(0, 200),
            tags: e.value.tags,
          }));

        return { query, count: results.length, results };
      },
    }),

    defineTool('note_update', {
      description: '기존 노트를 수정합니다',
      params: {
        id: { type: 'string', description: '노트 ID' },
        title: { type: 'string', description: '새 제목 (선택)', optional: true },
        content: { type: 'string', description: '새 본문 (선택)', optional: true },
        tags: { type: 'string', description: '새 태그 (선택)', optional: true },
      },
      handler: async ({ id, title, content, tags }) => {
        const existing = await store.get<any>('notes', id);
        if (!existing) return { error: '노트를 찾을 수 없습니다', id };

        const updated = {
          ...existing,
          ...(title && { title }),
          ...(content && { content }),
          ...(tags && { tags: tags.split(',').map((t: string) => t.trim()) }),
          updatedAt: new Date().toISOString(),
        };
        await store.set('notes', id, updated);
        await store.append('activity', { action: 'update', noteId: id });
        return { id, message: '수정됨' };
      },
    }),

    defineTool('note_delete', {
      description: '노트를 삭제합니다',
      params: {
        id: { type: 'string', description: '노트 ID' },
      },
      handler: async ({ id }) => {
        const existed = await store.delete('notes', id);
        if (!existed) return { error: '노트를 찾을 수 없습니다', id };
        await store.append('activity', { action: 'delete', noteId: id });
        return { id, message: '삭제됨' };
      },
    }),

    defineTool('note_tags', {
      description: '사용 중인 모든 태그와 각 태그의 노트 수를 반환합니다',
      handler: async () => {
        const entries = await store.entries<any>('notes');
        const tagCounts: Record<string, number> = {};
        for (const e of entries) {
          for (const tag of (e.value.tags || [])) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }
        return { tags: Object.entries(tagCounts).map(([name, count]) => ({ name, count })) };
      },
    }),

    defineTool('note_activity', {
      description: '최근 활동 로그를 조회합니다',
      params: {
        limit: { type: 'number', description: '최대 개수 (기본: 20)', optional: true },
      },
      handler: async ({ limit }) => {
        const logs = await store.query('activity', { limit: limit || 20 });
        return { logs };
      },
    }),
  ],

  resources: [
    defineResource('note:///{id}', {
      name: 'note',
      description: '노트 내용을 리소스로 제공',
      mimeType: 'text/markdown',
      handler: async (uri) => {
        const id = uri.replace('note:///', '');
        const note = await store.get<any>('notes', id);
        if (!note) return '# Not Found';
        return `# ${note.title}\n\n${note.content}\n\n---\nTags: ${note.tags.join(', ')}\nUpdated: ${note.updatedAt}`;
      },
    }),
  ],
});

onShutdown(async () => { await store.close(); });
server.start();
```

## 사용 예시

Claude에서:

- "오늘 회의록을 노트로 만들어줘. 내용은 '프로젝트 일정 확인, Q3 예산 논의'. 태그는 work,meeting"
- "모든 노트 보여줘"
- "work 태그가 달린 노트만 보여줘"
- "예산이라는 키워드로 노트를 검색해줘"
- "note_1234 노트의 제목을 '수정된 회의록'으로 바꿔줘"
- "사용 중인 태그 목록 보여줘"
- "최근 활동 로그 5개 보여줘"

## 저장 구조

```
.air/notes/
├── notes.json            # 모든 노트 (key-value)
└── activity.log.jsonl    # 활동 로그 (append-only)
```

## 특징

- `sanitizerPlugin` — 노트 본문은 Markdown/HTML을 허용하되(`exclude`), 다른 도구는 XSS 방지
- `cachePlugin` — `note_list`, `note_search`, `note_tags` 결과를 10초 캐시. 쓰기 도구는 `exclude`
- `defineResource` — `note:///note_1234` URI로 노트 내용을 Markdown 리소스로 제공
- `store.append` + `store.query` — 활동 로그를 JSONL로 기록하고 조회
