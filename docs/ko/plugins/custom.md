# 커스텀 플러그인

나만의 air 플러그인을 만들어보세요.

## 플러그인 구조

`AirPlugin`은 네 가지 선택 파트로 구성됩니다: meta, middleware, tools, hooks.

```typescript
import type { AirPlugin } from '@airmcp-dev/core';

const myPlugin: AirPlugin = {
  meta: { name: 'my-plugin', version: '1.0.0', description: '유용한 기능' },

  middleware: [{
    name: 'my-plugin:mw',
    before: async (ctx) => { /* 모든 도구 호출 전 */ },
    after: async (ctx) => { /* 모든 도구 호출 후 */ },
    onError: async (ctx, error) => { /* 에러 발생 시 */ },
  }],

  tools: [ /* 플러그인이 자체 도구를 등록할 수 있음 */ ],
  resources: [ /* 플러그인이 자체 리소스를 등록할 수 있음 */ ],

  hooks: {
    onInit: async (ctx) => { /* 서버 초기화 */ },
    onStart: async (ctx) => { /* 서버 시작 */ },
    onStop: async (ctx) => { /* 서버 종료 */ },
    onToolRegister: (tool, ctx) => {
      return { ...tool, description: `[Enhanced] ${tool.description}` };
    },
  },
};
```

## 플러그인 팩토리

대부분의 플러그인은 옵션을 받습니다. 팩토리 함수를 사용합니다:

```typescript
interface MyPluginOptions {
  prefix?: string;
  verbose?: boolean;
}

export function myPlugin(options?: MyPluginOptions): AirPlugin {
  const prefix = options?.prefix ?? '[my-plugin]';
  const verbose = options?.verbose ?? false;

  return {
    meta: { name: 'my-plugin', version: '1.0.0' },
    middleware: [{
      name: 'my-plugin:logger',
      before: async (ctx) => {
        if (verbose) console.log(`${prefix} calling ${ctx.tool.name}`, ctx.params);
      },
      after: async (ctx) => {
        console.log(`${prefix} ${ctx.tool.name} done in ${ctx.duration}ms`);
      },
    }],
  };
}

// 사용
defineServer({ use: [myPlugin({ prefix: '[APP]', verbose: true })] });
```

## 라이프사이클 훅

```typescript
interface PluginHooks {
  onInit?: (ctx: PluginContext) => Promise<void> | void;
  onStart?: (ctx: PluginContext) => Promise<void> | void;
  onStop?: (ctx: PluginContext) => Promise<void> | void;
  onToolRegister?: (tool: AirToolDef, ctx: PluginContext) => AirToolDef | void;
}
```

### PluginContext

```typescript
interface PluginContext {
  serverName: string;                   // 서버 이름
  config: Record<string, any>;         // 서버 설정
  state: Record<string, any>;          // 글로벌 상태
  log: (level: string, message: string, data?: any) => void;
}
```

## 도구가 있는 플러그인

```typescript
export function healthPlugin(): AirPlugin {
  return {
    meta: { name: 'health', version: '1.0.0' },
    tools: [{
      name: '_health',
      description: '헬스 체크',
      handler: async (_, ctx) => ({
        status: 'ok', server: ctx.serverName, timestamp: Date.now(),
      }),
    }],
  };
}
```

## 미들웨어 메타 공유

`ctx.meta`를 사용하여 `before`와 `after` 사이에 데이터를 전달합니다:

```typescript
middleware: [{
  name: 'timing',
  before: async (ctx) => { ctx.meta.startTime = performance.now(); },
  after: async (ctx) => {
    const elapsed = performance.now() - ctx.meta.startTime;
    console.log(`${ctx.tool.name}: ${elapsed.toFixed(1)}ms`);
  },
}]
```

## 타입 레퍼런스

```typescript
import type {
  AirPlugin, AirPluginFactory, AirPluginMeta,
  PluginHooks, PluginContext,
  AirMiddleware, MiddlewareContext, MiddlewareResult,
} from '@airmcp-dev/core';
```
