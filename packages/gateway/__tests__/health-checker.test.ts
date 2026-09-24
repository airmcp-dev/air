// @airmcp-dev/gateway — __tests__/health-checker.test.ts
//
// HealthChecker의 initialDelayMs, 병렬 checkAll, stop 정리 테스트

import { describe, it, expect, vi, afterEach } from 'vitest';
import { HealthChecker } from '../src/registry/health-checker.js';
import { ServerRegistry } from '../src/registry/server-registry.js';

function createRegistryWithServers(count: number): ServerRegistry {
  const registry = new ServerRegistry();
  for (let i = 0; i < count; i++) {
    registry.register(`s${i}`, `Server${i}`, {
      type: 'http',
      url: `http://localhost:${3000 + i}`,
    });
    registry.updateStatus(`s${i}`, 'connected');
  }
  return registry;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HealthChecker — initialDelayMs', () => {
  it('should not check immediately on start', async () => {
    const registry = createRegistryWithServers(1);
    const checker = new HealthChecker(registry, 60_000, 5_000, 10_000);

    const checkAllSpy = vi.spyOn(checker, 'checkAll');
    checker.start();

    // 즉시 호출되지 않아야 함
    expect(checkAllSpy).not.toHaveBeenCalled();

    checker.stop();
  });

  it('should check after initialDelayMs', async () => {
    const registry = createRegistryWithServers(0); // 서버 없으면 빠르게 완료
    const checker = new HealthChecker(registry, 60_000, 5_000, 100); // 100ms delay

    const checkAllSpy = vi.spyOn(checker, 'checkAll');
    checker.start();

    // 100ms 후 호출되어야 함
    await new Promise(r => setTimeout(r, 200));
    expect(checkAllSpy).toHaveBeenCalledTimes(1);

    checker.stop();
  });

  it('should clear initialDelay timer on stop before first check', () => {
    const registry = createRegistryWithServers(0);
    const checker = new HealthChecker(registry, 60_000, 5_000, 60_000);

    const checkAllSpy = vi.spyOn(checker, 'checkAll');
    checker.start();
    checker.stop(); // 첫 체크 전에 stop

    // checkAll이 호출되지 않아야 함
    expect(checkAllSpy).not.toHaveBeenCalled();
  });

  it('should not double-start', () => {
    const registry = createRegistryWithServers(0);
    const checker = new HealthChecker(registry, 60_000, 5_000, 100);

    checker.start();
    checker.start(); // 두 번째 호출은 무시

    checker.stop();
  });
});

describe('HealthChecker — parallel checkAll', () => {
  it('should skip stopped servers', async () => {
    const registry = new ServerRegistry();
    registry.register('s1', 'A', { type: 'http', url: 'http://a' });
    registry.register('s2', 'B', { type: 'http', url: 'http://b' });
    registry.updateStatus('s1', 'connected');
    registry.updateStatus('s2', 'stopped');

    const checker = new HealthChecker(registry, 60_000, 1_000, 0);
    const results = await checker.checkAll();

    // stopped인 s2는 스킵
    expect(results.length).toBe(1);
    expect(results[0].serverId).toBe('s1');
  });

  it('should check multiple servers in parallel', async () => {
    const registry = createRegistryWithServers(3);
    const checker = new HealthChecker(registry, 60_000, 1_000, 0);

    const checkOneSpy = vi.spyOn(checker, 'checkOne');
    const results = await checker.checkAll();

    expect(checkOneSpy).toHaveBeenCalledTimes(3);
    expect(results.length).toBe(3);
  });

  it('should handle checkOne failure gracefully in parallel', async () => {
    const registry = createRegistryWithServers(2);
    const checker = new HealthChecker(registry, 60_000, 500, 0);

    // s0의 checkOne을 reject하도록 모킹
    const origCheckOne = checker.checkOne.bind(checker);
    vi.spyOn(checker, 'checkOne').mockImplementation(async (server) => {
      if (server.id === 's0') throw new Error('network error');
      return origCheckOne(server);
    });

    const results = await checker.checkAll();
    // Promise.allSettled이라 실패해도 나머지는 반환
    expect(results.length).toBe(1); // s1만 성공
    expect(results[0].serverId).toBe('s1');
  });
});

describe('HealthChecker — results tracking', () => {
  it('should store and retrieve last result', async () => {
    const registry = new ServerRegistry();
    registry.register('s1', 'A', { type: 'stdio', command: 'node' } as any);
    registry.updateStatus('s1', 'connected');

    const checker = new HealthChecker(registry, 60_000, 5_000, 0);
    await checker.checkAll();

    const result = checker.getLastResult('s1');
    expect(result).toBeDefined();
    expect(result!.serverId).toBe('s1');
    expect(result!.healthy).toBe(true);
    expect(result!.checkedAt).toBeInstanceOf(Date);
  });

  it('should return all results', async () => {
    const registry = createRegistryWithServers(2);
    // stdio로 변경해서 네트워크 없이 테스트
    for (const s of registry.listAll()) {
      (s.connection as any).type = 'stdio';
    }

    const checker = new HealthChecker(registry, 60_000, 5_000, 0);
    await checker.checkAll();

    const allResults = checker.getAllResults();
    expect(allResults.length).toBe(2);
  });
});
