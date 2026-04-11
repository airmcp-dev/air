# 예제: 데이터 파이프라인

CSV/JSON 데이터를 로드하고 변환, 집계, 필터링하는 MCP 서버. AI가 데이터를 분석하고 리포트를 생성할 수 있습니다.

## 전체 코드

```typescript
// src/index.ts
import {
  defineServer, defineTool, defineResource,
  timeoutPlugin, queuePlugin, sanitizerPlugin,
} from '@airmcp-dev/core';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';

// 데이터 로딩 헬퍼
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
      headers.forEach((h, i) => {
        const num = Number(values[i]);
        row[h] = isNaN(num) || values[i] === '' ? values[i] : num;
      });
      return row;
    });
  }
  throw new Error(`지원하지 않는 형식: ${ext} (json, csv만 가능)`);
}

const server = defineServer({
  name: 'data-pipeline',
  version: '1.0.0',
  description: '데이터 로드/변환/집계 MCP 서버',

  transport: { type: 'sse', port: 3510 },

  use: [
    sanitizerPlugin(),
    timeoutPlugin(30_000),
    queuePlugin({ concurrency: { 'data_load': 3, '*': 5 } }),  // 동시 파일 로드 3개 제한
  ],

  tools: [
    defineTool('data_files', {
      description: '데이터 디렉토리의 파일 목록을 반환합니다',
      layer: 2,
      handler: async () => {
        const files = await readdir(DATA_DIR);
        const dataFiles = files.filter(f => ['.json', '.csv'].includes(extname(f).toLowerCase()));
        return { directory: DATA_DIR, files: dataFiles };
      },
    }),

    defineTool('data_load', {
      description: '데이터 파일을 로드하고 미리보기를 반환합니다',
      layer: 2,
      params: {
        file: { type: 'string', description: '파일명 (예: sales.csv, users.json)' },
        limit: { type: 'number', description: '미리보기 행 수 (기본: 5)', optional: true },
      },
      handler: async ({ file, limit }) => {
        const data = await loadData(file);
        const preview = data.slice(0, limit || 5);
        const columns = data.length > 0 ? Object.keys(data[0]) : [];
        return {
          file,
          totalRows: data.length,
          columns,
          preview,
        };
      },
    }),

    defineTool('data_filter', {
      description: '조건에 맞는 행을 필터링합니다',
      layer: 3,
      params: {
        file: { type: 'string', description: '파일명' },
        column: { type: 'string', description: '필터링할 컬럼' },
        operator: { type: 'string', description: '연산자: eq, ne, gt, lt, gte, lte, contains' },
        value: { type: 'string', description: '비교 값' },
        limit: { type: 'number', description: '최대 결과 수', optional: true },
      },
      handler: async ({ file, column, operator, value, limit }) => {
        const data = await loadData(file);
        const numValue = Number(value);
        const useNum = !isNaN(numValue) && ['gt', 'lt', 'gte', 'lte'].includes(operator);
        const compareValue = useNum ? numValue : value;

        const ops: Record<string, (a: any, b: any) => boolean> = {
          eq: (a, b) => a == b,
          ne: (a, b) => a != b,
          gt: (a, b) => a > b,
          lt: (a, b) => a < b,
          gte: (a, b) => a >= b,
          lte: (a, b) => a <= b,
          contains: (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
        };

        const op = ops[operator];
        if (!op) throw new Error(`지원하지 않는 연산자: ${operator}`);

        const filtered = data.filter(row => op(row[column], compareValue));
        const results = filtered.slice(0, limit || 100);
        return { file, filter: `${column} ${operator} ${value}`, matchedRows: filtered.length, results };
      },
    }),

    defineTool('data_aggregate', {
      description: '컬럼의 합계, 평균, 최솟값, 최댓값, 개수를 계산합니다',
      layer: 4,
      params: {
        file: { type: 'string', description: '파일명' },
        column: { type: 'string', description: '집계할 숫자 컬럼' },
        groupBy: { type: 'string', description: '그룹핑 컬럼 (선택)', optional: true },
      },
      handler: async ({ file, column, groupBy }) => {
        const data = await loadData(file);

        function aggregate(rows: any[]) {
          const values = rows.map(r => Number(r[column])).filter(v => !isNaN(v));
          if (values.length === 0) return { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
          const sum = values.reduce((a, b) => a + b, 0);
          return {
            count: values.length,
            sum: Math.round(sum * 100) / 100,
            avg: Math.round((sum / values.length) * 100) / 100,
            min: Math.min(...values),
            max: Math.max(...values),
          };
        }

        if (!groupBy) {
          return { file, column, ...aggregate(data) };
        }

        // 그룹별 집계
        const groups: Record<string, any[]> = {};
        for (const row of data) {
          const key = String(row[groupBy] ?? 'null');
          (groups[key] ||= []).push(row);
        }

        const result = Object.entries(groups).map(([group, rows]) => ({
          [groupBy]: group,
          ...aggregate(rows),
        }));

        return { file, column, groupBy, groups: result };
      },
    }),

    defineTool('data_sort', {
      description: '데이터를 정렬합니다',
      layer: 3,
      params: {
        file: { type: 'string', description: '파일명' },
        column: { type: 'string', description: '정렬 컬럼' },
        order: { type: 'string', description: '"asc" 또는 "desc" (기본: asc)', optional: true },
        limit: { type: 'number', description: '최대 결과 수 (기본: 20)', optional: true },
      },
      handler: async ({ file, column, order, limit }) => {
        const data = await loadData(file);
        const sorted = [...data].sort((a, b) => {
          const va = a[column], vb = b[column];
          const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
          return order === 'desc' ? -cmp : cmp;
        });
        return { file, sortedBy: column, order: order || 'asc', results: sorted.slice(0, limit || 20) };
      },
    }),

    defineTool('data_export', {
      description: '필터링/정렬된 데이터를 새 파일로 저장합니다',
      layer: 3,
      params: {
        file: { type: 'string', description: '원본 파일명' },
        output: { type: 'string', description: '출력 파일명 (예: filtered.json)' },
        column: { type: 'string', description: '필터 컬럼 (선택)', optional: true },
        operator: { type: 'string', description: '필터 연산자 (선택)', optional: true },
        value: { type: 'string', description: '필터 값 (선택)', optional: true },
      },
      handler: async ({ file, output, column, operator, value }) => {
        let data = await loadData(file);

        if (column && operator && value) {
          const numValue = Number(value);
          const ops: Record<string, (a: any, b: any) => boolean> = {
            eq: (a, b) => a == b, gt: (a, b) => a > b, lt: (a, b) => a < b,
            contains: (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
          };
          const op = ops[operator];
          if (op) data = data.filter(row => op(row[column], isNaN(numValue) ? value : numValue));
        }

        const outputPath = join(DATA_DIR, output);
        await writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
        return { output: outputPath, rows: data.length, message: '저장 완료' };
      },
    }),
  ],

  resources: [
    defineResource('data:///{file}', {
      name: 'data-file',
      description: '데이터 파일 내용',
      handler: async (uri) => {
        const file = uri.replace('data:///', '');
        const data = await loadData(file);
        return JSON.stringify(data.slice(0, 50), null, 2);
      },
    }),
  ],
});

server.start();
```

## 사용 예시

```bash
# 데이터 디렉토리에 CSV 파일 준비
mkdir -p data
echo "name,department,salary,year
Alice,Engineering,95000,2023
Bob,Marketing,72000,2023
Charlie,Engineering,105000,2024
Diana,Marketing,78000,2024
Eve,Engineering,88000,2024" > data/employees.csv
```

Claude에서:
- "데이터 디렉토리에 어떤 파일이 있어?"
- "employees.csv를 로드해서 보여줘"
- "Engineering 부서 직원만 필터링해줘"
- "부서별 평균 급여를 계산해줘"
- "급여 기준으로 내림차순 정렬해줘"
- "2024년 데이터만 filtered_2024.json으로 저장해줘"

## Meter 분류

| 도구 | 계층 | 이유 |
|------|------|------|
| `data_files` | L2 | 디렉토리 목록 조회 |
| `data_load` | L2 | 파일 읽기 |
| `data_filter` | L3 | 데이터 변환 |
| `data_sort` | L3 | 데이터 변환 |
| `data_aggregate` | L4 | 집계/계산 |
| `data_export` | L3 | 파일 쓰기 |
