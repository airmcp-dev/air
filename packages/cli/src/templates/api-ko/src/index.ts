// my-api-server — src/index.ts
//
// 외부 API 래핑 도구 서버 템플릿.
// fetch로 외부 API를 호출하고 결과를 MCP 도구로 제공합니다.
// BASE_URL과 API_KEY를 환경변수로 설정하세요.

import { defineServer, defineTool } from '@airmcp-dev/core';

const BASE_URL = process.env.API_BASE_URL || 'https://jsonplaceholder.typicode.com';
const API_KEY = process.env.API_KEY || '';

/** 공통 fetch 헬퍼 */
async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    throw new Error(`API 오류: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

const server = defineServer({
  name: 'my-api-server',
  version: '0.1.0',

  // transport: { type: 'sse', port: 3510 },
  description: '외부 API를 MCP 도구로 제공하는 서버',

  tools: [
    defineTool('fetch', {
      description: 'API에서 데이터를 가져옵니다',
      params: {
        path: { type: 'string', description: 'API 경로 (예: /users, /posts/1)' },
      },
      handler: async ({ path }) => {
        return await apiFetch(path);
      },
    }),

    defineTool('post', {
      description: 'API에 데이터를 생성합니다',
      params: {
        path: { type: 'string', description: 'API 경로' },
        body: { type: 'string', description: '요청 본문 (JSON 문자열)' },
      },
      handler: async ({ path, body }) => {
        return await apiFetch(path, { method: 'POST', body });
      },
    }),

    defineTool('search', {
      description: 'API를 검색합니다',
      params: {
        path: { type: 'string', description: 'API 경로' },
        query: { type: 'string', description: '쿼리 문자열 (예: "q=hello&limit=10")' },
      },
      handler: async ({ path, query }) => {
        const separator = path.includes('?') ? '&' : '?';
        return await apiFetch(`${path}${separator}${query}`);
      },
    }),
  ],
});

server.start();
