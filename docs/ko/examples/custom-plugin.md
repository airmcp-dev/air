# 예제: 커스텀 플러그인 만들기

처음부터 커스텀 플러그인을 만드는 실전 가이드. 3개의 플러그인을 단계별로 구현합니다.

## 1. 기본 — 실행 시간 로거

모든 도구 호출의 실행 시간을 측정하고 기록하는 가장 단순한 플러그인입니다.

```typescript
// plugins/timing.ts
import type { AirPlugin } from '@airmcp-dev/core';

interface TimingOptions {
  /** 느린 호출 기준 ms (기본: 1000) */
  slowMs?: number;
  /** 로그 출력 (기본: true) */
  log?: boolean;
}

export function timingPlugin(options?: TimingOptions): AirPlugin {
  const slowMs = options?.slowMs ?? 1000;
  const shouldLog = options?.log !== false;

  return {
    meta: {
      name: 'my-timing',
      version: '1.0.0',
      description: '도구 실행 시간 측정',
    },

    middleware: [{
      name: 'my-timing:mw',

      // 모든 도구 호출 전: 시작 시간을 meta에 저장
      before: async (ctx) => {
        ctx.meta._timing_start = performance.now();
      },

      // 모든 도구 호출 후: 실행 시간 계산 + 로그
      after: async (ctx) => {
        const elapsed = performance.now() - (ctx.meta._timing_start || 0);
        const ms = Math.round(elapsed * 100) / 100;

        if (shouldLog) {
          const level = ms > slowMs ? '🐌 SLOW' : '✅';
          console.log(`${level} ${ctx.tool.name}: ${ms}ms`);
        }

        // 결과에 실행 시간 메타데이터 추가 (선택)
        ctx.meta._timing_ms = ms;
      },
    }],
  };
}
```

사용:

```typescript
import { defineServer } from '@airmcp-dev/core';
import { timingPlugin } from './plugins/timing.js';

defineServer({
  use: [timingPlugin({ slowMs: 500 })],
  tools: [ /* ... */ ],
});
```

출력:

```
✅ search: 45.23ms
🐌 SLOW fetch_data: 1234.56ms
```

## 2. 중급 — API 사용량 추적기

사용자별·도구별 호출 횟수를 추적하고, 사용량 리포트 도구를 자동 등록하는 플러그인입니다.

```typescript
// plugins/usage-tracker.ts
import type { AirPlugin, AirMiddleware } from '@airmcp-dev/core';

interface UsageTrackerOptions {
  /** 사용자 식별 파라미터 이름 (기본: '_userId') */
  identifyBy?: string;
}

interface UsageRecord {
  calls: number;
  lastCalledAt: string;
  tools: Record<string, number>;
}

export function usageTrackerPlugin(options?: UsageTrackerOptions): AirPlugin {
  const identifyBy = options?.identifyBy ?? '_userId';

  // 사용량 데이터 (인메모리)
  const usage = new Map<string, UsageRecord>();

  function track(userId: string, toolName: string) {
    const record = usage.get(userId) || { calls: 0, lastCalledAt: '', tools: {} };
    record.calls++;
    record.lastCalledAt = new Date().toISOString();
    record.tools[toolName] = (record.tools[toolName] || 0) + 1;
    usage.set(userId, record);
  }

  const middleware: AirMiddleware = {
    name: 'usage-tracker:mw',
    after: async (ctx) => {
      const userId = (ctx.params[identifyBy] as string) || 'anonymous';
      track(userId, ctx.tool.name);
    },
  };

  return {
    meta: {
      name: 'usage-tracker',
      version: '1.0.0',
      description: '사용자별 API 사용량 추적',
    },

    middleware: [middleware],

    // 플러그인이 자체 도구를 등록
    tools: [
      {
        name: '_usage_report',
        description: '사용자별 API 사용량 리포트',
        handler: async () => {
          const report: Record<string, UsageRecord> = {};
          for (const [userId, record] of usage) {
            report[userId] = record;
          }
          return {
            totalUsers: usage.size,
            users: report,
          };
        },
      },
      {
        name: '_usage_reset',
        description: '사용량 데이터 초기화',
        handler: async () => {
          const count = usage.size;
          usage.clear();
          return { message: `${count}명의 사용량 데이터 초기화됨` };
        },
      },
    ],
  };
}
```

사용:

```typescript
defineServer({
  use: [usageTrackerPlugin({ identifyBy: '_userId' })],
  tools: [
    defineTool('search', {
      params: { query: 'string', _userId: 'string?' },
      handler: async ({ query }) => doSearch(query),
    }),
  ],
});
// → _usage_report, _usage_reset 도구가 자동 등록됨
```

Claude에서:
- "사용량 리포트 보여줘" → `_usage_report` 호출
- "사용량 초기화해줘" → `_usage_reset` 호출

## 3. 고급 — DB 커넥션 풀

라이프사이클 훅으로 DB 커넥션 풀을 관리하고, 도구에 `state.db`를 제공하는 플러그인입니다.

```typescript
// plugins/postgres.ts
import type { AirPlugin, PluginContext } from '@airmcp-dev/core';

interface PostgresOptions {
  connectionString: string;
  poolSize?: number;
}

// 실제로는 pg 패키지의 Pool 사용
interface MockPool {
  query(sql: string, params?: any[]): Promise<any>;
  end(): Promise<void>;
}

function createPool(connStr: string, size: number): MockPool {
  // 실제 구현: import { Pool } from 'pg';
  // return new Pool({ connectionString: connStr, max: size });
  console.log(`[postgres] Pool created: ${connStr} (max: ${size})`);
  return {
    query: async (sql: string) => {
      console.log(`[postgres] Query: ${sql}`);
      return { rows: [], rowCount: 0 };
    },
    end: async () => {
      console.log('[postgres] Pool closed');
    },
  };
}

export function postgresPlugin(options: PostgresOptions): AirPlugin {
  const poolSize = options.poolSize ?? 10;
  let pool: MockPool | null = null;

  return {
    meta: {
      name: 'air-postgres',
      version: '1.0.0',
      description: 'PostgreSQL 커넥션 풀',
    },

    hooks: {
      // 서버 초기화 시 커넥션 풀 생성
      onInit: async (ctx: PluginContext) => {
        pool = createPool(options.connectionString, poolSize);
        ctx.state.db = pool;  // server.state.db로 접근 가능
        ctx.log('info', `PostgreSQL connected (pool: ${poolSize})`);
      },

      // 서버 종료 시 커넥션 풀 해제
      onStop: async (ctx: PluginContext) => {
        if (pool) {
          await pool.end();
          pool = null;
          ctx.log('info', 'PostgreSQL disconnected');
        }
      },

      // 도구 등록 시 description에 [DB] 태그 추가 (선택)
      onToolRegister: (tool, ctx) => {
        // db_로 시작하는 도구에만 태그 추가
        if (tool.name.startsWith('db_')) {
          return {
            ...tool,
            description: `[DB] ${tool.description || tool.name}`,
          };
        }
      },
    },

    // DB 쿼리 도구를 자동 등록
    tools: [
      {
        name: 'db_query',
        description: 'SQL 쿼리를 실행합니다',
        params: {
          sql: { type: 'string', description: 'SQL 쿼리' },
        },
        handler: async ({ sql }, context) => {
          if (!context.state.db) throw new Error('DB not initialized');
          const result = await context.state.db.query(sql);
          return { rows: result.rows, rowCount: result.rowCount };
        },
      },
      {
        name: 'db_health',
        description: 'DB 연결 상태를 확인합니다',
        handler: async (_, context) => {
          try {
            await context.state.db.query('SELECT 1');
            return { status: 'healthy' };
          } catch (err: any) {
            return { status: 'unhealthy', error: err.message };
          }
        },
      },
    ],
  };
}
```

사용:

```typescript
import { defineServer, defineTool } from '@airmcp-dev/core';
import { postgresPlugin } from './plugins/postgres.js';

defineServer({
  use: [
    postgresPlugin({
      connectionString: process.env.DATABASE_URL!,
      poolSize: 20,
    }),
  ],
  tools: [
    // 커스텀 도구에서도 state.db 사용 가능
    defineTool('get_users', {
      description: '사용자 목록 조회',
      handler: async (_, ctx) => {
        const result = await ctx.state.db.query('SELECT id, name, email FROM users LIMIT 50');
        return result.rows;
      },
    }),
  ],
});
```

## 플러그인 구조 요약

```typescript
interface AirPlugin {
  meta: { name: string; version?: string; description?: string };  // 필수

  middleware?: AirMiddleware[];  // 모든 도구 호출에 끼어드는 로직
  //   before: 호출 전 (파라미터 수정, 인증, 캐시 확인 등)
  //   after:  호출 후 (로깅, 메트릭, 결과 변환 등)
  //   onError: 에러 처리 (재시도, 폴백 등)

  hooks?: PluginHooks;  // 서버 라이프사이클에 끼어드는 로직
  //   onInit: 서버 초기화 (DB 연결, 리소스 로드)
  //   onStart: 서버 시작 (워커 시작, 헬스체크 등록)
  //   onStop: 서버 종료 (DB 닫기, 클린업)
  //   onToolRegister: 도구 등록 시 변환 (설명 추가, 래핑)

  tools?: AirToolDef[];      // 자동 등록할 도구
  resources?: AirResourceDef[];  // 자동 등록할 리소스
}
```

## 핵심 패턴

### 1. 미들웨어로 모든 호출에 공통 로직 추가

```typescript
middleware: [{
  name: 'my:mw',
  before: async (ctx) => {
    // ctx.meta에 데이터 저장 (after에서 사용)
    // ctx.params 수정 가능 (return { params: ... })
    // 호출 중단 가능 (return { abort: true, abortResponse: ... })
  },
  after: async (ctx) => {
    // ctx.duration으로 실행 시간 접근
    // ctx.result로 결과 접근
    // ctx.meta에서 before가 저장한 데이터 읽기
  },
  onError: async (ctx, error) => {
    // 에러 복구 → 값 반환 시 정상 응답으로 전환
    // 에러 전달 → undefined 반환
  },
}]
```

### 2. hooks로 서버 라이프사이클 관리

```typescript
hooks: {
  onInit: async (ctx) => {
    // ctx.state에 공유 리소스 등록 → 모든 도구에서 접근 가능
    ctx.state.cache = new Map();
  },
  onStop: async (ctx) => {
    // 정리
    ctx.state.cache.clear();
  },
}
```

### 3. tools/resources로 자동 등록

```typescript
tools: [{
  name: '_my_plugin_status',   // 관례: _ 접두사 = 내부 도구
  description: '플러그인 상태',
  handler: async () => ({ status: 'ok' }),
}]
```

## NPM 패키지로 배포

```
air-plugin-postgres/
├── src/
│   └── index.ts
├── air-plugin.json        # 매니페스트 (선택)
├── package.json
├── tsconfig.json
└── README.md
```

```json
// package.json
{
  "name": "air-plugin-postgres",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@airmcp-dev/core": ">=0.1.0"
  }
}
```

```json
// air-plugin.json (플러그인 레지스트리에 등록 시)
{
  "name": "air-plugin-postgres",
  "version": "1.0.0",
  "description": "PostgreSQL storage adapter for air",
  "author": "Your Name",
  "license": "MIT",
  "air": {
    "minVersion": "0.1.0",
    "category": "storage",
    "tags": ["database", "postgres"],
    "entry": "dist/index.js",
    "factory": "postgresPlugin"
  }
}
```

```bash
npm publish
# 레지스트리 등록 (선택)
airmcp-dev plugin publish --registry-key YOUR_KEY
```
