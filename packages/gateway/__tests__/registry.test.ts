// @airmcp-dev/gateway — __tests__/registry.test.ts

import { describe, it, expect } from 'vitest';
import { ServerRegistry } from '../src/registry/server-registry.js';
import { ToolIndex } from '../src/registry/tool-index.js';

describe('ServerRegistry', () => {
  it('should register a server', () => {
    const registry = new ServerRegistry();
    const entry = registry.register('s1', 'My Server', {
      type: 'http',
      url: 'http://localhost:3000',
    });

    expect(entry.id).toBe('s1');
    expect(entry.name).toBe('My Server');
    expect(entry.status).toBe('registered');
    expect(registry.size).toBe(1);
  });

  it('should unregister a server', () => {
    const registry = new ServerRegistry();
    registry.register('s1', 'Server', { type: 'http', url: 'http://localhost:3000' });
    const removed = registry.unregister('s1');
    expect(removed).toBe(true);
    expect(registry.size).toBe(0);
  });

  it('should update server status', () => {
    const registry = new ServerRegistry();
    registry.register('s1', 'Server', { type: 'http', url: 'http://localhost:3000' });
    registry.updateStatus('s1', 'connected');
    expect(registry.get('s1')!.status).toBe('connected');
  });

  it('should list by status', () => {
    const registry = new ServerRegistry();
    registry.register('s1', 'A', { type: 'http', url: 'http://a' });
    registry.register('s2', 'B', { type: 'http', url: 'http://b' });
    registry.updateStatus('s1', 'connected');

    const connected = registry.listByStatus('connected');
    expect(connected.length).toBe(1);
    expect(connected[0].id).toBe('s1');
  });
});

describe('ToolIndex', () => {
  it('should index and find tools', () => {
    const index = new ToolIndex();
    const server = {
      id: 's1', name: 'Server', transport: 'http' as const,
      connection: { type: 'http' as const, url: 'http://localhost' },
      tools: [
        { name: 'search', serverId: 's1', description: 'Search stuff' },
        { name: 'create', serverId: 's1' },
      ],
      status: 'connected' as const, restartCount: 0,
    };

    index.reindex(server);
    expect(index.size).toBe(2);
    expect(index.find('search').length).toBe(1);
    expect(index.find('search')[0].serverId).toBe('s1');
  });

  it('should remove server tools', () => {
    const index = new ToolIndex();
    const server = {
      id: 's1', name: 'Server', transport: 'http' as const,
      connection: { type: 'http' as const, url: 'http://localhost' },
      tools: [{ name: 'search', serverId: 's1' }],
      status: 'connected' as const, restartCount: 0,
    };

    index.reindex(server);
    index.removeServer('s1');
    expect(index.size).toBe(0);
  });

  it('should handle duplicate tool names across servers', () => {
    const index = new ToolIndex();
    const s1 = {
      id: 's1', name: 'A', transport: 'http' as const,
      connection: { type: 'http' as const, url: 'http://a' },
      tools: [{ name: 'search', serverId: 's1' }],
      status: 'connected' as const, restartCount: 0,
    };
    const s2 = {
      id: 's2', name: 'B', transport: 'http' as const,
      connection: { type: 'http' as const, url: 'http://b' },
      tools: [{ name: 'search', serverId: 's2' }],
      status: 'connected' as const, restartCount: 0,
    };

    index.reindex(s1);
    index.reindex(s2);
    expect(index.find('search').length).toBe(2);
  });
});
