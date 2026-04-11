# 플러그인 매니페스트

서드파티 플러그인은 `air-plugin.json`으로 자신을 설명합니다. 매니페스트를 통해 플러그인 검색, 버전 호환성 확인, 레지스트리 배포가 가능합니다.

## air-plugin.json

```json
{
  "name": "air-plugin-postgres",
  "version": "1.0.0",
  "description": "air용 PostgreSQL 스토리지 어댑터",
  "author": "Your Name",
  "license": "MIT",
  "air": {
    "minVersion": "0.1.0",
    "category": "storage",
    "tags": ["database", "postgres", "sql"],
    "entry": "dist/index.js",
    "factory": "postgresPlugin"
  },
  "package": "air-plugin-postgres",
  "homepage": "https://github.com/you/air-plugin-postgres"
}
```

## 매니페스트 필드

### 필수

| 필드 | 타입 | 설명 |
|------|------|------|
| `name` | `string` | 플러그인 이름 |
| `version` | `string` | Semver 버전 |
| `description` | `string` | 짧은 설명 |
| `author` | `string` | 저자 |
| `license` | `string` | SPDX 라이선스 |
| `air.minVersion` | `string` | 최소 호환 air 버전 |
| `air.category` | `PluginCategory` | 카테고리 |

### 선택

| 필드 | 타입 | 설명 |
|------|------|------|
| `air.tags` | `string[]` | 검색 태그 |
| `air.configSchema` | `object` | 플러그인 옵션 JSON Schema |
| `air.entry` | `string` | 엔트리포인트 파일 (기본: `index.js`) |
| `air.factory` | `string` | 팩토리 함수 이름 (기본: `default`) |
| `package` | `string` | npm 패키지명 (자동 매핑) |
| `homepage` | `string` | 문서/홈페이지 URL |
| `repository` | `string` | 소스 코드 저장소 URL |

## 플러그인 카테고리

```typescript
type PluginCategory =
  | 'security' | 'performance' | 'monitoring' | 'data'
  | 'network' | 'dev' | 'storage' | 'auth' | 'logging' | 'other';
```

## 설정 스키마

JSON Schema로 플러그인 옵션을 기술하면 사용자가 검증을 받을 수 있습니다:

```json
{
  "air": {
    "configSchema": {
      "type": "object",
      "properties": {
        "connectionString": { "type": "string", "description": "PostgreSQL 연결 URL" },
        "poolSize": { "type": "number", "default": 10, "description": "커넥션 풀 크기" }
      },
      "required": ["connectionString"]
    }
  }
}
```

## 플러그인 레지스트리

`plugins.airmcp.dev`의 air 플러그인 레지스트리가 배포된 플러그인을 인덱싱합니다.

기본 레지스트리 URL: `https://plugins.airmcp.dev/api/v1`

### 레지스트리 설정

```typescript
interface PluginRegistryConfig {
  url: string;       // 레지스트리 URL
  apiKey?: string;   // 배포(publish) 시 필요
}
```

`air.config.ts`에서 설정:

```typescript
export default {
  registry: {
    url: 'https://plugins.airmcp.dev/api/v1',  // 기본값
    apiKey: process.env.PLUGIN_REGISTRY_KEY,    // 배포 시만 필요
  },
};
```

### 레지스트리 검색 결과

```typescript
interface PluginRegistryEntry {
  manifest: AirPluginManifest;
  downloads: number;      // npm 다운로드 수
  rating: number;         // 평균 평점
  verified: boolean;      // air 팀 검증 여부
  publishedAt: string;    // 등록일 (ISO 8601)
  updatedAt: string;      // 최종 업데이트일
}
```

### 검색

```bash
air plugin search postgres
air plugin search --category storage
```

### 설치

```bash
npm install air-plugin-postgres
```

사용:

```typescript
import { defineServer } from '@airmcp-dev/core';
import { postgresPlugin } from 'air-plugin-postgres';

defineServer({
  use: [postgresPlugin({ connectionString: 'postgres://...' })],
});
```

## 예제: 완전한 플러그인 패키지

```
air-plugin-postgres/
├── src/
│   └── index.ts            # 플러그인 팩토리
├── air-plugin.json          # 매니페스트
├── package.json
└── README.md
```

```typescript
// src/index.ts
import type { AirPlugin } from '@airmcp-dev/core';

interface PostgresOptions {
  connectionString: string;
  poolSize?: number;
}

export function postgresPlugin(options: PostgresOptions): AirPlugin {
  return {
    meta: { name: 'air-plugin-postgres', version: '1.0.0' },
    hooks: {
      onInit: async (ctx) => {
        const pool = createPool(options.connectionString, options.poolSize || 10);
        ctx.state.db = pool;
        ctx.log('info', `PostgreSQL 연결됨 (pool: ${options.poolSize || 10})`);
      },
      onStop: async (ctx) => { await ctx.state.db?.close(); },
    },
    tools: [{
      name: 'pg_query',
      description: 'SQL 쿼리 실행',
      params: { sql: { type: 'string', description: 'SQL 쿼리' } },
      handler: async ({ sql }, context) => context.state.db.query(sql),
    }],
  };
}
```
