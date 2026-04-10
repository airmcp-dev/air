// my-crud-server — src/index.ts
//
// DB CRUD 도구 서버 템플릿.
// 4개 도구(create, read, update, delete)를 제공한다.
// 실제 DB 연결은 사용자가 구현.

import { defineServer, defineTool, createStorage } from '@airmcp-dev/core';

// 인메모리 스토리지 (개발용, 실제로는 DB로 교체)
const store = createStorage({ adapter: 'memory' });

const server = defineServer({
  name: 'my-crud-server',
  version: '0.1.0',

  // transport: { type: 'sse', port: 3510 },
  description: 'CRUD operations for your data',

  tools: [
    defineTool('create', {
      description: 'Create a new record',
      params: {
        collection: { type: 'string', description: 'Collection/table name' },
        data: { type: 'string', description: 'JSON string of record data' },
      },
      handler: async ({ collection, data }) => {
        const record = JSON.parse(data);
        const id = `${collection}_${Date.now()}`;
        await store.set(id, { ...record, _id: id, _collection: collection });
        return { id, message: `Created in ${collection}` };
      },
    }),

    defineTool('read', {
      description: 'Read records from a collection',
      params: {
        collection: { type: 'string', description: 'Collection/table name' },
        id: { type: 'string', description: 'Record ID (optional, omit for all)', optional: true },
      },
      handler: async ({ collection, id }) => {
        if (id) {
          const record = await store.get(id);
          return record || { error: 'Not found' };
        }
        // 전체 조회 (인메모리 한정)
        const all = await store.list({ prefix: `${collection}_` });
        return { collection, count: all.length, records: all };
      },
    }),

    defineTool('update', {
      description: 'Update an existing record',
      params: {
        id: { type: 'string', description: 'Record ID' },
        data: { type: 'string', description: 'JSON string of fields to update' },
      },
      handler: async ({ id, data }) => {
        const existing = await store.get(id);
        if (!existing) return { error: 'Not found' };
        const updated = { ...existing, ...JSON.parse(data) };
        await store.set(id, updated);
        return { id, message: 'Updated', record: updated };
      },
    }),

    defineTool('delete', {
      description: 'Delete a record',
      params: {
        id: { type: 'string', description: 'Record ID' },
      },
      handler: async ({ id }) => {
        const existing = await store.get(id);
        if (!existing) return { error: 'Not found' };
        await store.delete(id);
        return { id, message: 'Deleted' };
      },
    }),
  ],
});

server.start();
