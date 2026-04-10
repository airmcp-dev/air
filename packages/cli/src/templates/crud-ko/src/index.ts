// my-crud-server — src/index.ts
//
// DB CRUD 도구 서버 템플릿.
// 4개 도구(생성, 조회, 수정, 삭제)를 제공합니다.
// 실제 DB 연결은 직접 구현하세요.

import { defineServer, defineTool, createStorage } from '@airmcp-dev/core';

// 인메모리 스토리지 (개발용, 실제로는 DB로 교체하세요)
const store = createStorage({ adapter: 'memory' });

const server = defineServer({
  name: 'my-crud-server',
  version: '0.1.0',

  // transport: { type: 'sse', port: 3510 },
  description: '데이터 CRUD 도구 서버',

  tools: [
    defineTool('create', {
      description: '새 레코드를 생성합니다',
      params: {
        collection: { type: 'string', description: '컬렉션/테이블 이름' },
        data: { type: 'string', description: '레코드 데이터 (JSON 문자열)' },
      },
      handler: async ({ collection, data }) => {
        const record = JSON.parse(data);
        const id = `${collection}_${Date.now()}`;
        await store.set(id, { ...record, _id: id, _collection: collection });
        return { id, message: `${collection}에 생성 완료` };
      },
    }),

    defineTool('read', {
      description: '컬렉션에서 레코드를 조회합니다',
      params: {
        collection: { type: 'string', description: '컬렉션/테이블 이름' },
        id: { type: 'string', description: '레코드 ID (생략하면 전체 조회)', optional: true },
      },
      handler: async ({ collection, id }) => {
        if (id) {
          const record = await store.get(id);
          return record || { error: '찾을 수 없습니다' };
        }
        const all = await store.list({ prefix: `${collection}_` });
        return { collection, count: all.length, records: all };
      },
    }),

    defineTool('update', {
      description: '기존 레코드를 수정합니다',
      params: {
        id: { type: 'string', description: '레코드 ID' },
        data: { type: 'string', description: '수정할 필드 (JSON 문자열)' },
      },
      handler: async ({ id, data }) => {
        const existing = await store.get(id);
        if (!existing) return { error: '찾을 수 없습니다' };
        const updated = { ...existing, ...JSON.parse(data) };
        await store.set(id, updated);
        return { id, message: '수정 완료', record: updated };
      },
    }),

    defineTool('delete', {
      description: '레코드를 삭제합니다',
      params: {
        id: { type: 'string', description: '레코드 ID' },
      },
      handler: async ({ id }) => {
        const existing = await store.get(id);
        if (!existing) return { error: '찾을 수 없습니다' };
        await store.delete(id);
        return { id, message: '삭제 완료' };
      },
    }),
  ],
});

server.start();
