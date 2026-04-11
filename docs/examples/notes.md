# Example: Markdown Notes

A personal note management server using FileStore. Supports creating, reading, searching, and tagging notes. No external DB needed — stores everything as JSON in `.air/notes`.

## Full code

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
  description: 'Markdown note management MCP server',
  transport: { type: 'sse', port: 3510 },

  use: [
    sanitizerPlugin({ exclude: ['note_create', 'note_update'] }),
    cachePlugin({ ttlMs: 10_000, exclude: ['note_create', 'note_update', 'note_delete'] }),
  ],

  tools: [
    defineTool('note_create', {
      description: 'Create a new note',
      params: {
        title: { type: 'string', description: 'Note title' },
        content: { type: 'string', description: 'Note body (Markdown)' },
        tags: { type: 'string', description: 'Comma-separated tags', optional: true },
      },
      handler: async ({ title, content, tags }) => {
        const id = `note_${Date.now()}`;
        const note = {
          id, title, content,
          tags: tags ? tags.split(',').map((t: string) => t.trim()) : [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await store.set('notes', id, note);
        await store.append('activity', { action: 'create', noteId: id, title });
        return { id, message: `"${title}" created` };
      },
    }),

    defineTool('note_read', {
      description: 'Read a note by ID',
      params: { id: { type: 'string', description: 'Note ID' } },
      handler: async ({ id }) => {
        const note = await store.get('notes', id);
        return note || { error: 'Note not found', id };
      },
    }),

    defineTool('note_list', {
      description: 'List all notes with titles and tags',
      params: { tag: { type: 'string', description: 'Filter by tag', optional: true } },
      handler: async ({ tag }) => {
        const entries = await store.entries<any>('notes');
        let notes = entries.map(e => ({
          id: e.key, title: e.value.title, tags: e.value.tags, updatedAt: e.value.updatedAt,
        }));
        if (tag) notes = notes.filter(n => n.tags.includes(tag));
        notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return { count: notes.length, notes };
      },
    }),

    defineTool('note_search', {
      description: 'Search notes by keyword in title and body',
      params: { query: { type: 'string', description: 'Search keyword' } },
      handler: async ({ query }) => {
        const entries = await store.entries<any>('notes');
        const q = query.toLowerCase();
        const results = entries
          .filter(e => e.value.title.toLowerCase().includes(q) || e.value.content.toLowerCase().includes(q))
          .map(e => ({ id: e.key, title: e.value.title, snippet: e.value.content.substring(0, 200), tags: e.value.tags }));
        return { query, count: results.length, results };
      },
    }),

    defineTool('note_update', {
      description: 'Update an existing note',
      params: {
        id: { type: 'string', description: 'Note ID' },
        title: { type: 'string', description: 'New title', optional: true },
        content: { type: 'string', description: 'New body', optional: true },
        tags: { type: 'string', description: 'New tags', optional: true },
      },
      handler: async ({ id, title, content, tags }) => {
        const existing = await store.get<any>('notes', id);
        if (!existing) return { error: 'Note not found', id };
        const updated = {
          ...existing,
          ...(title && { title }), ...(content && { content }),
          ...(tags && { tags: tags.split(',').map((t: string) => t.trim()) }),
          updatedAt: new Date().toISOString(),
        };
        await store.set('notes', id, updated);
        await store.append('activity', { action: 'update', noteId: id });
        return { id, message: 'Updated' };
      },
    }),

    defineTool('note_delete', {
      description: 'Delete a note',
      params: { id: { type: 'string', description: 'Note ID' } },
      handler: async ({ id }) => {
        const existed = await store.delete('notes', id);
        if (!existed) return { error: 'Note not found', id };
        await store.append('activity', { action: 'delete', noteId: id });
        return { id, message: 'Deleted' };
      },
    }),

    defineTool('note_tags', {
      description: 'List all tags and their note counts',
      handler: async () => {
        const entries = await store.entries<any>('notes');
        const tagCounts: Record<string, number> = {};
        for (const e of entries) for (const tag of (e.value.tags || [])) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        return { tags: Object.entries(tagCounts).map(([name, count]) => ({ name, count })) };
      },
    }),

    defineTool('note_activity', {
      description: 'View recent activity log',
      params: { limit: { type: 'number', description: 'Max entries (default: 20)', optional: true } },
      handler: async ({ limit }) => ({ logs: await store.query('activity', { limit: limit || 20 }) }),
    }),
  ],

  resources: [
    defineResource('note:///{id}', {
      name: 'note', description: 'Note content as Markdown resource', mimeType: 'text/markdown',
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

## Usage

- "Create a note titled 'Meeting Notes' with content about Q3 budget. Tag it work,meeting"
- "List all notes with the 'work' tag"
- "Search for notes containing 'budget'"
- "Show all tags and their counts"
- "Show last 5 activity entries"

## Highlights

- `sanitizerPlugin` with `exclude` — allows Markdown/HTML in note body while protecting other tools
- `cachePlugin` — caches reads for 10s, excludes writes
- `defineResource` — exposes notes as `note:///note_1234` Markdown resources
- `store.append` + `store.query` — activity log in JSONL format
