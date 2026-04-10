// @airmcp-dev/gateway — proxy/protocol-adapter.ts
//
// MCP transport 간 프로토콜 변환.
// 클라이언트가 HTTP로 요청 → 하위 서버가 stdio인 경우,
// 또는 클라이언트가 stdio → 하위 서버가 SSE인 경우 등을 처리.

import type { ServerConnection } from '../types.js';

/** 프로토콜 변환 결과 */
export interface AdaptedRequest {
  /** 변환된 요청 데이터 (JSON-RPC 형태) */
  jsonrpc: {
    jsonrpc: '2.0';
    id: number | string;
    method: string;
    params?: Record<string, any>;
  };
}

/** JSON-RPC 요청 ID 카운터 */
let requestIdCounter = 0;

/**
 * MCP 도구 호출을 JSON-RPC 요청으로 변환한다.
 */
export function buildToolCallRequest(
  toolName: string,
  params: Record<string, any>,
): AdaptedRequest {
  return {
    jsonrpc: {
      jsonrpc: '2.0',
      id: ++requestIdCounter,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: params,
      },
    },
  };
}

/**
 * 서버 연결 타입에 따른 통신 방법을 결정한다.
 */
export function resolveTransportMethod(
  connection: ServerConnection,
): 'spawn-stdio' | 'http-post' | 'sse-stream' {
  if (connection.type === 'stdio') return 'spawn-stdio';
  if (connection.type === 'sse') return 'sse-stream';
  return 'http-post';
}

/**
 * 도구 목록 요청을 JSON-RPC로 변환한다.
 */
export function buildListToolsRequest(): AdaptedRequest {
  return {
    jsonrpc: {
      jsonrpc: '2.0',
      id: ++requestIdCounter,
      method: 'tools/list',
    },
  };
}

/**
 * JSON-RPC 응답에서 결과를 추출한다.
 */
export function extractResult(response: any): any {
  if (response?.error) {
    throw new Error(`MCP error ${response.error.code}: ${response.error.message}`);
  }
  return response?.result;
}
