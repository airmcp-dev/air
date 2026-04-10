// my-api-server — src/index.ts
//
// 외부 API 래핑 도구 서버 템플릿.
// fetch로 외부 API를 호출하고 결과를 MCP 도구로 노출한다.
// BASE_URL과 API_KEY를 환경변수로 설정.

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
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

const server = defineServer({
  name: 'my-api-server',
  version: '0.1.0',

  // transport: { type: 'sse', port: 3510 },
  description: 'External API wrapper as MCP tools',

  tools: [
    defineTool('fetch', {
      description: 'Fetch data from the API',
      params: {
        path: { type: 'string', description: 'API endpoint path (e.g. /users, /posts/1)' },
      },
      handler: async ({ path }) => {
        const data = await apiFetch(path);
        return data;
      },
    }),

    defineTool('post', {
      description: 'Create data via API',
      params: {
        path: { type: 'string', description: 'API endpoint path' },
        body: { type: 'string', description: 'JSON string of request body' },
      },
      handler: async ({ path, body }) => {
        const data = await apiFetch(path, {
          method: 'POST',
          body,
        });
        return data;
      },
    }),

    defineTool('search', {
      description: 'Search the API with query parameters',
      params: {
        path: { type: 'string', description: 'API endpoint path' },
        query: { type: 'string', description: 'Query string (e.g. "q=hello&limit=10")' },
      },
      handler: async ({ path, query }) => {
        const separator = path.includes('?') ? '&' : '?';
        const data = await apiFetch(`${path}${separator}${query}`);
        return data;
      },
    }),
  ],
});

server.start();
