// subscriptions/listen 테스트

import { describe, it, expect } from 'vitest';
import { McpProtocolEngine } from '../src/protocol/mcp-protocol.js';

function createEngine() {
  return new McpProtocolEngine({
    name: 'sub-test',
    version: '1.0.0',
    tools: [{ name: 'ping', params: {}, handler: async () => 'pong' }],
    resources: [],
    prompts: [],
    callTool: async () => [{ type: 'text', text: 'ok' }],
  });
}

const modernMeta = {
  _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' },
};

describe('subscriptions/listen (2026-07-28)', () => {
  it('should create subscription and return subscriptionId', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'subscriptions/listen', id: 1,
      params: { types: ['toolsListChanged'], ...modernMeta },
    });

    expect(res.result.resultType).toBe('complete');
    expect(res.result['io.modelcontextprotocol/subscriptionId']).toBeDefined();
    expect(engine.subscriptionCount).toBe(1);
  });

  it('should accept multiple subscription types', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'subscriptions/listen', id: 1,
      params: {
        types: ['toolsListChanged', 'resourcesListChanged', 'promptsListChanged'],
        ...modernMeta,
      },
    });

    expect(res.result.resultType).toBe('complete');
    expect(res.result['io.modelcontextprotocol/subscriptionId']).toBeDefined();
  });

  it('should reject empty types array', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'subscriptions/listen', id: 1,
      params: { types: [], ...modernMeta },
    });

    expect(res.error).toBeDefined();
    expect(res.error!.code).toBe(-32602);
  });

  it('should reject invalid subscription type', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'subscriptions/listen', id: 1,
      params: { types: ['invalidType'], ...modernMeta },
    });

    expect(res.error).toBeDefined();
    expect(res.error!.message).toContain('Invalid subscription type');
  });

  it('should reject missing types parameter', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'subscriptions/listen', id: 1,
      params: { ...modernMeta },
    });

    expect(res.error).toBeDefined();
  });

  it('should create notifications for subscribed types', async () => {
    const engine = createEngine();
    await engine.handleMessage({
      jsonrpc: '2.0', method: 'subscriptions/listen', id: 1,
      params: { types: ['toolsListChanged'], ...modernMeta },
    });

    const notifications = engine.createNotification('toolsListChanged');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].method).toBe('notifications/tools/list_changed');
    expect(notifications[0].params['io.modelcontextprotocol/subscriptionId']).toBeDefined();
  });

  it('should not create notifications for unsubscribed types', async () => {
    const engine = createEngine();
    await engine.handleMessage({
      jsonrpc: '2.0', method: 'subscriptions/listen', id: 1,
      params: { types: ['toolsListChanged'], ...modernMeta },
    });

    const notifications = engine.createNotification('promptsListChanged');
    expect(notifications).toHaveLength(0);
  });

  it('should handle multiple subscriptions', async () => {
    const engine = createEngine();

    await engine.handleMessage({
      jsonrpc: '2.0', method: 'subscriptions/listen', id: 1,
      params: { types: ['toolsListChanged'], ...modernMeta },
    });
    await engine.handleMessage({
      jsonrpc: '2.0', method: 'subscriptions/listen', id: 2,
      params: { types: ['toolsListChanged', 'resourcesListChanged'], ...modernMeta },
    });

    expect(engine.subscriptionCount).toBe(2);

    const notifications = engine.createNotification('toolsListChanged');
    expect(notifications).toHaveLength(2);

    const resNotifications = engine.createNotification('resourcesListChanged');
    expect(resNotifications).toHaveLength(1);
  });
});

describe('Legacy resources/subscribe (2025-11-25)', () => {
  it('should handle resources/subscribe', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'resources/subscribe', id: 1,
      params: { uri: 'test://resource' },
    });

    expect(res.result).toBeDefined();
    expect(res.error).toBeUndefined();
  });

  it('should handle resources/unsubscribe', async () => {
    const engine = createEngine();

    await engine.handleMessage({
      jsonrpc: '2.0', method: 'resources/subscribe', id: 1,
      params: { uri: 'test://resource' },
    });

    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'resources/unsubscribe', id: 2,
      params: { uri: 'test://resource' },
    });

    expect(res.result).toBeDefined();
    expect(res.error).toBeUndefined();
  });

  it('should reject subscribe without uri', async () => {
    const engine = createEngine();
    const res = await engine.handleMessage({
      jsonrpc: '2.0', method: 'resources/subscribe', id: 1,
      params: {},
    });

    expect(res.error).toBeDefined();
  });
});
