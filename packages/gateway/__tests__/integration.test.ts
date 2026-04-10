// @airmcp-dev/gateway — __tests__/integration.test.ts
// Gateway 통합 테스트: registry + tool-index + router + load-balancer

import { describe, it, expect } from 'vitest';
import { ServerRegistry } from '../src/registry/server-registry.js';
import { ToolIndex } from '../src/registry/tool-index.js';
import { RequestRouter } from '../src/router/request-router.js';
import { LoadBalancer } from '../src/router/load-balancer.js';
import { HealthChecker } from '../src/registry/health-checker.js';

describe('Gateway Integration', () => {
  it('should route tool call to correct server', () => {
    const registry = new ServerRegistry();
    const index = new ToolIndex();
    const balancer = new LoadBalancer('round-robin');
    const router = new RequestRouter(registry, index, balancer);

    // 서버 2개 등록
    const s1 = registry.register('s1', 'FileServer', { type: 'http', url: 'http://localhost:3001' });
    const s2 = registry.register('s2', 'DBServer', { type: 'http', url: 'http://localhost:3002' });

    // 도구 등록
    s1.tools = [{ name: 'read_file', serverId: 's1', description: 'Read a file' }];
    s2.tools = [{ name: 'query_db', serverId: 's2', description: 'Query database' }];
    registry.updateTools('s1', s1.tools);
    registry.updateTools('s2', s2.tools);
    registry.updateStatus('s1', 'connected');
    registry.updateStatus('s2', 'connected');

    index.reindex(s1);
    index.reindex(s2);

    // 라우팅 테스트
    const result1 = router.route({ toolName: 'read_file' });
    expect(result1.server.id).toBe('s1');
    expect(result1.tool.name).toBe('read_file');

    const result2 = router.route({ toolName: 'query_db' });
    expect(result2.server.id).toBe('s2');
  });

  it('should load-balance duplicate tools across servers', () => {
    const registry = new ServerRegistry();
    const index = new ToolIndex();
    const balancer = new LoadBalancer('round-robin');
    const router = new RequestRouter(registry, index, balancer);

    // 같은 도구를 가진 서버 3개 (스케일 아웃)
    for (const id of ['s1', 's2', 's3']) {
      const entry = registry.register(id, `Server-${id}`, { type: 'http', url: `http://localhost:300${id.slice(1)}` });
      entry.tools = [{ name: 'search', serverId: id, description: 'Search' }];
      registry.updateTools(id, entry.tools);
      registry.updateStatus(id, 'connected');
      index.reindex(entry);
    }

    // round-robin 확인
    const r1 = router.route({ toolName: 'search' });
    const r2 = router.route({ toolName: 'search' });
    const r3 = router.route({ toolName: 'search' });
    const r4 = router.route({ toolName: 'search' });

    expect(r1.server.id).toBe('s1');
    expect(r2.server.id).toBe('s2');
    expect(r3.server.id).toBe('s3');
    expect(r4.server.id).toBe('s1'); // 순환
  });

  it('should skip disconnected servers', () => {
    const registry = new ServerRegistry();
    const index = new ToolIndex();
    const balancer = new LoadBalancer('round-robin');
    const router = new RequestRouter(registry, index, balancer);

    const s1 = registry.register('s1', 'A', { type: 'http', url: 'http://a' });
    const s2 = registry.register('s2', 'B', { type: 'http', url: 'http://b' });
    s1.tools = [{ name: 'search', serverId: 's1' }];
    s2.tools = [{ name: 'search', serverId: 's2' }];
    index.reindex(s1);
    index.reindex(s2);

    registry.updateStatus('s1', 'disconnected');
    registry.updateStatus('s2', 'connected');

    // s1은 disconnected → s2만 라우팅
    const result = router.route({ toolName: 'search' });
    expect(result.server.id).toBe('s2');
  });

  it('should throw when tool not found', () => {
    const registry = new ServerRegistry();
    const index = new ToolIndex();
    const balancer = new LoadBalancer('round-robin');
    const router = new RequestRouter(registry, index, balancer);

    expect(() => router.route({ toolName: 'nonexistent' })).toThrow('not found');
  });

  it('should throw when no healthy server', () => {
    const registry = new ServerRegistry();
    const index = new ToolIndex();
    const balancer = new LoadBalancer('round-robin');
    const router = new RequestRouter(registry, index, balancer);

    const s1 = registry.register('s1', 'A', { type: 'http', url: 'http://a' });
    s1.tools = [{ name: 'search', serverId: 's1' }];
    index.reindex(s1);
    registry.updateStatus('s1', 'disconnected');

    expect(() => router.route({ toolName: 'search' })).toThrow('no healthy server');
  });

  it('should support canRoute check', () => {
    const registry = new ServerRegistry();
    const index = new ToolIndex();
    const balancer = new LoadBalancer('round-robin');
    const router = new RequestRouter(registry, index, balancer);

    const s1 = registry.register('s1', 'A', { type: 'http', url: 'http://a' });
    s1.tools = [{ name: 'search', serverId: 's1' }];
    index.reindex(s1);
    registry.updateStatus('s1', 'connected');

    expect(router.canRoute('search')).toBe(true);
    expect(router.canRoute('nonexistent')).toBe(false);
  });

  it('should handle server unregister', () => {
    const registry = new ServerRegistry();
    const index = new ToolIndex();

    const s1 = registry.register('s1', 'A', { type: 'http', url: 'http://a' });
    s1.tools = [{ name: 'search', serverId: 's1' }];
    index.reindex(s1);

    expect(index.size).toBe(1);

    index.removeServer('s1');
    registry.unregister('s1');

    expect(index.size).toBe(0);
    expect(registry.size).toBe(0);
  });
});

describe('HealthChecker', () => {
  it('should create health checker instance', () => {
    const registry = new ServerRegistry();
    const checker = new HealthChecker(registry);
    expect(checker).toBeDefined();
  });
});
