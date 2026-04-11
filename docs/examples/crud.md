# Example: CRUD Server

A data management tool server. AI can create, read, update, and delete records.

## Create project

```bash
npx @airmcp-dev/cli create my-crud-server --template crud
cd my-crud-server
npm install
```

## Full code

```typescript
// src/index.ts
import {
  defineServer, defineTool, createStorage, onShutdown,
  sanitizerPlugin, validatorPlugin,
} from '@airmcp-dev/core';

const store = await createStorage({ type: 'file', path: '.air/data' });

const server = defineServer({
  name: 'my-crud-server',
  version: '1.0.0',
  description: 'CRUD data management server',
  transport: { type: 'sse', port: 3510 },

  use: [
    sanitizerPlugin(),
    validatorPlugin({
      rules: [
        { tool: 'create', validate: (p) => { try { JSON.parse(p.data); } catch { return 'data must be valid JSON'; } }},
        { tool: 'update', validate: (p) => { try { JSON.parse(p.data); } catch { return 'data must be valid JSON'; } }},
      ],
    }),
  ],

  tools: [
    defineTool('create', {
      description: 'Create a new record',
      params: {
        collection: { type: 'string', description: 'Collection name (e.g. users, posts)' },
        data: { type: 'string', description: 'Record data (JSON string)' },
      },
      handler: async ({ collection, data }) => {
        const record = JSON.parse(data);
        const id = `${collection}_${Date.now()}`;
        await store.set(collection, id, { ...record, _id: id, _createdAt: new Date().toISOString() });
        return { id, message: `Created in ${collection}` };
      },
    }),

    defineTool('read', {
      description: 'Read records. Omit ID for full list',
      params: {
        collection: { type: 'string', description: 'Collection name' },
        id: { type: 'string', description: 'Record ID (optional)', optional: true },
      },
      handler: async ({ collection, id }) => {
        if (id) {
          const record = await store.get(collection, id);
          return record || { error: 'Not found', id };
        }
        const records = await store.entries(collection);
        return { collection, count: records.length, records };
      },
    }),

    defineTool('update', {
      description: 'Update an existing record',
      params: {
        collection: { type: 'string', description: 'Collection name' },
        id: { type: 'string', description: 'Record ID' },
        data: { type: 'string', description: 'Fields to update (JSON string)' },
      },
      handler: async ({ collection, id, data }) => {
        const existing = await store.get(collection, id);
        if (!existing) return { error: 'Not found', id };
        const updated = { ...existing, ...JSON.parse(data), _updatedAt: new Date().toISOString() };
        await store.set(collection, id, updated);
        return { id, message: 'Updated', record: updated };
      },
    }),

    defineTool('delete', {
      description: 'Delete a record',
      params: {
        collection: { type: 'string', description: 'Collection name' },
        id: { type: 'string', description: 'Record ID' },
      },
      handler: async ({ collection, id }) => {
        const existed = await store.delete(collection, id);
        return existed ? { id, message: 'Deleted' } : { error: 'Not found', id };
      },
    }),
  ],
});

server.state.store = store;
onShutdown(async () => { await store.close(); });
server.start();
```

## Usage in Claude

- "Create a user named Alice, age 30 in the users collection"
- "Show all records in the users collection"
- "Update users_1234567890 — change age to 31"
- "Delete users_1234567890"

## Storage structure

```
.air/data/
├── users.json
├── posts.json
└── ...
```

## Production tips

- `sanitizerPlugin` prevents XSS input
- `validatorPlugin` validates JSON format
- `onShutdown` ensures storage is flushed on exit
- For production, connect to PostgreSQL or MongoDB instead of `FileStore`
