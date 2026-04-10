import { defineServer, defineTool } from '@airmcp-dev/core';

// 메모 저장소
const memos = new Map<string, string>();

const server = defineServer({
  name: 'memo-server',
  version: '0.1.0',
  description: '메모장 MCP 서버',

  transport: {
    type: 'sse',
    port: 3510,
  },

  shield: {
    enabled: true,
    policies: [
      { name: 'block-system', target: 'system_*', action: 'deny', priority: 10 },
      { name: 'allow-memo', target: 'memo_*', action: 'allow', priority: 5 },
    ],
    threatDetection: true,
    rateLimit: {
      maxCalls: 100,
      perTool: {
        memo_save: { maxCalls: 30, windowMs: 60_000 },
      },
    },
    audit: true,
  },

  meter: {
    enabled: true,
    classify: true,
    trackCalls: true,
  },

  tools: [
    defineTool('memo_save', {
      description: '메모를 저장합니다. title과 content를 받아서 저장합니다.',
      params: {
        title: { type: 'string', description: '메모 제목' },
        content: { type: 'string', description: '메모 내용' },
      },
      handler: async ({ title, content }) => {
        memos.set(title, content);
        return `"${title}" 저장 완료 (총 ${memos.size}개)`;
      },
    }),

    defineTool('memo_list', {
      description: '저장된 메모 목록을 보여줍니다.',
      params: {},
      handler: async () => {
        if (memos.size === 0) return '저장된 메모가 없습니다';
        const list = Array.from(memos.entries())
          .map(([title, content]) => `- ${title}: ${content}`)
          .join('\n');
        return `메모 ${memos.size}개:\n${list}`;
      },
    }),

    defineTool('memo_delete', {
      description: '메모를 삭제합니다. title을 받아서 해당 메모를 삭제합니다.',
      params: {
        title: { type: 'string', description: '삭제할 메모 제목' },
      },
      handler: async ({ title }) => {
        if (!memos.has(title)) return `"${title}" 메모를 찾을 수 없습니다`;
        memos.delete(title);
        return `"${title}" 삭제 완료 (남은 ${memos.size}개)`;
      },
    }),
  ],
});


// MCP 서버 시작 (HTTP 모드, 포트 3500)
server.start();
