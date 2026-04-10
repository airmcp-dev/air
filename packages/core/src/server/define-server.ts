// @airmcp-dev/core — server/define-server.ts
//
// defineServer() — air의 심장.
// 모든 것을 합쳐서 하나의 MCP 서버를 만든다.
//
// shield/meter 설정이 있으면 자동으로 보안/측정 미들웨어가 체인에 등록된다.
// 사용자는 handler 로직만 작성하면 나머지는 프레임워크가 처리.
//
// @example
// ```ts
// import { defineServer, defineTool } from '@airmcp-dev/core';
//
// export default defineServer({
//   name: 'my-tool',
//   shield: {
//     enabled: true,
//     policies: [{ name: 'block-admin', target: 'admin_*', action: 'deny' }],
//     threatDetection: true,
//     rateLimit: { maxCalls: 100, windowMs: 60000 },
//   },
//   meter: { classify: true, trackCalls: true },
//   tools: [
//     defineTool('search', {
//       params: { query: 'string' },
//       handler: async ({ query }) => doSearch(query),
//     }),
//   ],
// });
// ```

import type { AirServerOptions, AirServer } from '../types/server.js';
import type { AirToolDef } from '../types/tool.js';
import type { AirMiddleware } from '../types/middleware.js';
import type { AirPlugin, AirPluginFactory } from '../types/plugin.js';
import { loadConfig } from '../config/loader.js';
import { ServerRunner } from './server-runner.js';
import { MiddlewareChain } from '../middleware/chain.js';
import { validationMiddleware } from '../middleware/before-hook.js';
import { errorBoundaryMiddleware } from '../middleware/error-handler.js';
import { createShieldMiddleware } from '../middleware/shield-middleware.js';
import { createMeterMiddleware } from '../middleware/meter-middleware.js';
import { McpErrors } from '../middleware/error-handler.js';
import { createRequestContext } from '../context/request-context.js';
import { PluginManager } from '../plugin/plugin-manager.js';
import { builtinLoggerPlugin } from '../plugin/builtin/logger.js';
import { builtinMetricsPlugin } from '../plugin/builtin/metrics.js';

/**
 * MCP 서버를 정의한다.
 *
 * 내장 기능 (자동 적용):
 * - 입력 검증 (zod)
 * - 에러 → MCP 프로토콜 변환
 * - 로깅 (builtin logger plugin)
 * - 보안 (shield 설정 시: 정책, 위협탐지, 레이트리밋, 감사)
 * - 측정 (meter 설정 시: 7-Layer 분류, 호출 추적, 지연시간)
 * - Graceful shutdown (SIGTERM/SIGINT)
 */
export function defineServer(options: AirServerOptions): AirServer {
  // ── 1. 미들웨어 체인 구성 ──
  const chain = new MiddlewareChain();

  // 내장 미들웨어 (최우선)
  chain.add(errorBoundaryMiddleware());
  chain.add(validationMiddleware());

  // ── 2. Shield 자동 등록 ──
  if (options.shield?.enabled) {
    chain.add(createShieldMiddleware(options.shield));
  }

  // ── 3. Meter 자동 등록 ──
  if (options.meter?.enabled !== false) {
    chain.add(createMeterMiddleware(options.meter || {}));
  }

  // ── 4. 플러그인 관리 ──
  const pluginManager = new PluginManager();

  // 내장 플러그인 (로깅 + 메트릭)
  const logLevel = options.logging?.level || 'info';
  pluginManager.register(builtinLoggerPlugin(logLevel));

  if (options.metrics?.enabled !== false) {
    pluginManager.register(builtinMetricsPlugin());
  }

  // 사용자 플러그인
  if (options.use) {
    for (const p of options.use) {
      pluginManager.register(p);
    }
  }

  // 플러그인 미들웨어 수집 → 체인에 추가
  chain.addAll(pluginManager.collectMiddleware());

  // 사용자 미들웨어 (마지막)
  if (options.middleware) {
    chain.addAll(options.middleware);
  }

  // ── 5. 서버 러너 생성 ──
  const config = {
    name: options.name,
    version: options.version,
    description: options.description,
    transport: options.transport,
    storage: options.storage,
    logging: options.logging,
    metrics: options.metrics,
    shield: options.shield,
    meter: options.meter,
    dev: options.dev,
  };

  const runner = new ServerRunner(config, chain);

  // ── 6. 플러그인 컨텍스트 생성 ──
  const pluginCtx = pluginManager.createContext(
    config.name,
    config as Record<string, any>,
    runner.getContext().state,
  );

  // ── 7. 도구 등록 (사용자 + 플러그인) ──
  const allTools = [...(options.tools || []), ...pluginManager.collectTools()];
  for (const tool of allTools) {
    const finalTool = pluginManager.hookRunner.runOnToolRegister(tool, pluginCtx);
    runner.registerTool(finalTool);
  }

  // ── 8. 리소스 등록 ──
  const allResources = [...(options.resources || []), ...pluginManager.collectResources()];
  for (const resource of allResources) {
    runner.registerResource(resource);
  }

  // ── 9. 프롬프트 등록 ──
  if (options.prompts) {
    for (const prompt of options.prompts) {
      runner.registerPrompt(prompt);
    }
  }

  // ── 10. AirServer 인터페이스 반환 ──
  const server: AirServer = {
    get name() {
      return config.name;
    },

    async start() {
      await pluginManager.hookRunner.runOnInit(pluginCtx);
      await pluginManager.hookRunner.runOnStart(pluginCtx);
      await runner.start();
    },

    async stop() {
      await pluginManager.hookRunner.runOnStop(pluginCtx);
      await runner.stop();
    },

    status() {
      return runner.status();
    },

    tools() {
      return runner.getTools();
    },

    resources() {
      return allResources;
    },

    async callTool(toolName: string, params?: Record<string, any>) {
      const tool = runner.getTools().find((t) => t.name === toolName);
      if (!tool) throw McpErrors.toolNotFound(toolName);

      const reqCtx = createRequestContext(config.name, runner.getContext().state);
      const content = await chain.execute(tool, params || {}, reqCtx);

      // content는 McpContent[] 형태 — 텍스트 결과만 추출
      if (Array.isArray(content) && content.length > 0) {
        const first = content[0];
        if (first && typeof first === 'object' && 'text' in first) {
          return first.text;
        }
      }
      return content;
    },

    addTool(tool: AirToolDef) {
      const finalTool = pluginManager.hookRunner.runOnToolRegister(tool, pluginCtx);
      runner.registerTool(finalTool);
    },

    addMiddleware(mw: AirMiddleware) {
      chain.add(mw);
    },

    addPlugin(plugin: AirPlugin | AirPluginFactory) {
      pluginManager.register(plugin);
      chain.addAll(pluginManager.collectMiddleware());
    },

    get state() {
      return runner.getContext().state;
    },
  };

  return server;
}
