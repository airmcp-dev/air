# Example: Data Pipeline

Load, transform, aggregate, and filter CSV/JSON data. AI can analyze data and generate reports.

## Full code

```typescript
// src/index.ts
import {
  defineServer, defineTool, defineResource,
  timeoutPlugin, queuePlugin, sanitizerPlugin,
} from '@airmcp-dev/core';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';

async function loadData(filename: string): Promise<any[]> {
  const ext = extname(filename).toLowerCase();
  const raw = await readFile(join(DATA_DIR, filename), 'utf-8');
  if (ext === '.json') return JSON.parse(raw);
  if (ext === '.csv') {
    const lines = raw.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, any> = {};
      headers.forEach((h, i) => { const n = Number(values[i]); row[h] = isNaN(n) || values[i] === '' ? values[i] : n; });
      return row;
    });
  }
  throw new Error(`Unsupported format: ${ext} (json and csv only)`);
}

const server = defineServer({
  name: 'data-pipeline',
  version: '1.0.0',
  transport: { type: 'sse', port: 3510 },

  use: [
    sanitizerPlugin(),
    timeoutPlugin(30_000),
    queuePlugin({ concurrency: { 'data_load': 3, '*': 5 } }),
  ],

  tools: [
    defineTool('data_files', {
      description: 'List data files in the data directory', layer: 2,
      handler: async () => {
        const files = await readdir(DATA_DIR);
        return { directory: DATA_DIR, files: files.filter(f => ['.json', '.csv'].includes(extname(f).toLowerCase())) };
      },
    }),

    defineTool('data_load', {
      description: 'Load a data file and show preview', layer: 2,
      params: { file: 'string', limit: { type: 'number', optional: true } },
      handler: async ({ file, limit }) => {
        const data = await loadData(file);
        return { file, totalRows: data.length, columns: data.length > 0 ? Object.keys(data[0]) : [], preview: data.slice(0, limit || 5) };
      },
    }),

    defineTool('data_filter', {
      description: 'Filter rows by condition', layer: 3,
      params: {
        file: 'string', column: 'string',
        operator: { type: 'string', description: 'eq, ne, gt, lt, gte, lte, contains' },
        value: 'string', limit: { type: 'number', optional: true },
      },
      handler: async ({ file, column, operator, value, limit }) => {
        const data = await loadData(file);
        const numValue = Number(value);
        const ops: Record<string, (a: any, b: any) => boolean> = {
          eq: (a, b) => a == b, ne: (a, b) => a != b, gt: (a, b) => a > b,
          lt: (a, b) => a < b, gte: (a, b) => a >= b, lte: (a, b) => a <= b,
          contains: (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
        };
        const op = ops[operator];
        if (!op) throw new Error(`Unsupported operator: ${operator}`);
        const compareValue = !isNaN(numValue) && ['gt', 'lt', 'gte', 'lte'].includes(operator) ? numValue : value;
        const filtered = data.filter(row => op(row[column], compareValue));
        return { file, filter: `${column} ${operator} ${value}`, matchedRows: filtered.length, results: filtered.slice(0, limit || 100) };
      },
    }),

    defineTool('data_aggregate', {
      description: 'Calculate sum, avg, min, max, count for a numeric column', layer: 4,
      params: { file: 'string', column: 'string', groupBy: { type: 'string', optional: true } },
      handler: async ({ file, column, groupBy }) => {
        const data = await loadData(file);
        function agg(rows: any[]) {
          const vals = rows.map(r => Number(r[column])).filter(v => !isNaN(v));
          if (!vals.length) return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
          const sum = vals.reduce((a, b) => a + b, 0);
          return { count: vals.length, sum: Math.round(sum * 100) / 100, avg: Math.round(sum / vals.length * 100) / 100, min: Math.min(...vals), max: Math.max(...vals) };
        }
        if (!groupBy) return { file, column, ...agg(data) };
        const groups: Record<string, any[]> = {};
        for (const row of data) { const k = String(row[groupBy] ?? 'null'); (groups[k] ||= []).push(row); }
        return { file, column, groupBy, groups: Object.entries(groups).map(([g, rows]) => ({ [groupBy]: g, ...agg(rows) })) };
      },
    }),

    defineTool('data_sort', {
      description: 'Sort data by column', layer: 3,
      params: { file: 'string', column: 'string', order: { type: 'string', optional: true }, limit: { type: 'number', optional: true } },
      handler: async ({ file, column, order, limit }) => {
        const data = await loadData(file);
        const sorted = [...data].sort((a, b) => {
          const cmp = typeof a[column] === 'number' ? a[column] - b[column] : String(a[column]).localeCompare(String(b[column]));
          return order === 'desc' ? -cmp : cmp;
        });
        return { file, sortedBy: column, order: order || 'asc', results: sorted.slice(0, limit || 20) };
      },
    }),

    defineTool('data_export', {
      description: 'Export filtered data to a new file', layer: 3,
      params: { file: 'string', output: 'string', column: { type: 'string', optional: true }, operator: { type: 'string', optional: true }, value: { type: 'string', optional: true } },
      handler: async ({ file, output, column, operator, value }) => {
        let data = await loadData(file);
        if (column && operator && value) {
          const n = Number(value);
          const ops: Record<string, (a: any, b: any) => boolean> = { eq: (a, b) => a == b, gt: (a, b) => a > b, lt: (a, b) => a < b, contains: (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()) };
          const op = ops[operator];
          if (op) data = data.filter(row => op(row[column], isNaN(n) ? value : n));
        }
        const outputPath = join(DATA_DIR, output);
        await writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
        return { output: outputPath, rows: data.length, message: 'Saved' };
      },
    }),
  ],

  resources: [
    defineResource('data:///{file}', {
      name: 'data-file', description: 'Data file content',
      handler: async (uri) => { const f = uri.replace('data:///', ''); return JSON.stringify((await loadData(f)).slice(0, 50), null, 2); },
    }),
  ],
});

server.start();
```

## Usage

```bash
mkdir -p data && echo "name,department,salary\nAlice,Eng,95000\nBob,Mkt,72000\nCharlie,Eng,105000" > data/employees.csv
```

- "What data files are available?" → `data_files`
- "Load employees.csv" → `data_load`
- "Filter Engineering department" → `data_filter`
- "Average salary by department" → `data_aggregate`
- "Sort by salary descending" → `data_sort`
- "Export 2024 data to filtered.json" → `data_export`
