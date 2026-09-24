// @airmcp-dev/core — transport/air-sse-transport.ts
//
// air 자체 SSE Transport — v2 SDK의 Transport 인터페이스를 구현하면서
// v1 SSEServerTransport의 아키텍처 단점을 보완한다.
//
// 보완 사항:
//   1. Last-Event-ID 기반 메시지 재전송 (연결 끊김 복구)
//   2. 주기적 하트비트 (죽은 연결 조기 감지)
//   3. 세션 idle timeout + TTL 자동 정리 (메모리 누수 방지)
//   4. DNS rebinding 방어 (Host/Origin 검증)

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

/** SSE를 통해 전송된 메시지 기록 (재전송용) */
interface SentMessage {
  id: string;
  data: string;
  timestamp: number;
}

export interface AirSSETransportOptions {
  /** 클라이언트가 POST할 메시지 엔드포인트 경로 (기본: '/message') */
  endpoint?: string;
  /** 하트비트 간격 ms (기본: 30000, 0이면 비활성) */
  heartbeatIntervalMs?: number;
  /** 재전송 버퍼 크기 — 최근 N개 메시지 보관 (기본: 100) */
  replayBufferSize?: number;
  /** 재전송 버퍼 TTL ms — 이 시간이 지난 메시지는 폐기 (기본: 300000 = 5분) */
  replayTtlMs?: number;
  /** DNS rebinding 방어: 허용 Host 목록 */
  allowedHosts?: string[];
  /** DNS rebinding 방어: 허용 Origin 목록 */
  allowedOrigins?: string[];
}

/**
 * air SSE Server Transport
 *
 * MCP v2 Transport 인터페이스를 구현하되,
 * SSE 방식의 편의성은 유지하면서 아키텍처 단점을 보완한다.
 *
 * 사용법:
 *   GET /sse → start() 호출 (SSE 스트림 개시)
 *   POST /message?sessionId=xxx → handlePostMessage() 호출
 */
export class AirSSETransport {
  private _sessionId: string;
  private _sseResponse: ServerResponse | null = null;
  private _endpoint: string;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _replayBuffer: SentMessage[] = [];
  private _messageCounter = 0;
  private _options: Required<Pick<AirSSETransportOptions, 'heartbeatIntervalMs' | 'replayBufferSize' | 'replayTtlMs'>> & AirSSETransportOptions;
  private _lastActivityAt: number = Date.now();

  // ── Transport 인터페이스 콜백 ──
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: any, extra?: any) => void;
  sessionId?: string;

  constructor(
    private _response: ServerResponse,
    options?: AirSSETransportOptions,
  ) {
    this._sessionId = randomUUID();
    this.sessionId = this._sessionId;
    this._endpoint = options?.endpoint ?? '/message';
    this._options = {
      heartbeatIntervalMs: 30_000,
      replayBufferSize: 100,
      replayTtlMs: 300_000,
      ...options,
    };
  }

  /** 세션 ID */
  get id(): string {
    return this._sessionId;
  }

  /** 마지막 활동 시각 */
  get lastActivityAt(): number {
    return this._lastActivityAt;
  }

  /** SSE 연결이 살아있는지 */
  get isConnected(): boolean {
    return this._sseResponse !== null && !this._sseResponse.writableEnded;
  }

  // ── Transport 인터페이스 구현 ──

  /**
   * SSE 스트림을 시작한다.
   * GET /sse 요청의 응답에 SSE 헤더를 설정하고 endpoint 이벤트를 전송한다.
   *
   * Last-Event-ID가 있으면 해당 ID 이후 메시지를 재전송한다.
   * McpServer.connect()가 내부적으로 start()를 재호출하므로 이미 시작된 경우 무시한다.
   */
  async start(lastEventId?: string): Promise<void> {
    if (this._sseResponse) {
      // 이미 시작됨 — McpServer.connect()에서의 재호출 허용
      return;
    }

    this._response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx 프록시 버퍼링 비활성
    });

    // endpoint 이벤트 전송 — 클라이언트에게 메시지 POST 경로 알림
    const endpointWithSession = `${this._endpoint}?sessionId=${this._sessionId}`;
    this._response.write(`event: endpoint\ndata: ${endpointWithSession}\n\n`);

    this._sseResponse = this._response;
    this._lastActivityAt = Date.now();

    // 연결 종료 시 정리
    this._response.on('close', () => {
      this._stopHeartbeat();
      this._sseResponse = null;
      this.onclose?.();
    });

    // Last-Event-ID 기반 재전송 (연결 끊김 복구)
    if (lastEventId) {
      this._replayFrom(lastEventId);
    }

    // 하트비트 시작
    if (this._options.heartbeatIntervalMs > 0) {
      this._startHeartbeat();
    }
  }

  /**
   * JSON-RPC 메시지를 SSE로 전송한다.
   * 각 메시지에 고유 ID를 부여하여 재전송 버퍼에 보관한다.
   */
  async send(message: any): Promise<void> {
    if (!this._sseResponse || this._sseResponse.writableEnded) {
      throw new Error('SSE connection not established');
    }

    const msgId = String(++this._messageCounter);
    const data = JSON.stringify(message);

    // ID 포함 SSE 이벤트 전송 — 클라이언트가 Last-Event-ID로 재연결 가능
    this._sseResponse.write(`id: ${msgId}\nevent: message\ndata: ${data}\n\n`);
    this._lastActivityAt = Date.now();

    // 재전송 버퍼에 보관
    this._addToReplayBuffer({ id: msgId, data, timestamp: Date.now() });
  }

  /**
   * SSE 연결을 종료한다.
   */
  async close(): Promise<void> {
    this._stopHeartbeat();
    if (this._sseResponse && !this._sseResponse.writableEnded) {
      this._sseResponse.end();
    }
    this._sseResponse = null;
    this.onclose?.();
  }

  // ── POST 메시지 처리 ──

  /**
   * POST 요청으로 수신된 JSON-RPC 메시지를 처리한다.
   */
  async handlePostMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!this._sseResponse) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'SSE connection not established' }));
      return;
    }

    // DNS rebinding 방어
    const validationError = this._validateHeaders(req);
    if (validationError) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end(validationError);
      this.onerror?.(new Error(validationError));
      return;
    }

    // 본문 파싱
    let body: any;
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf-8');
      body = JSON.parse(raw);
    } catch (err: any) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`Invalid JSON: ${err.message}`);
      this.onerror?.(err);
      return;
    }

    this._lastActivityAt = Date.now();

    // onmessage 콜백으로 전달 — McpServer가 처리
    try {
      this.onmessage?.(body);
      res.writeHead(202).end('Accepted');
    } catch (err: any) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`Invalid message: ${err.message}`);
    }
  }

  // ── 내부 메서드 ──

  /** 하트비트 시작 — :ping 코멘트를 주기적으로 전송 */
  private _startHeartbeat(): void {
    this._heartbeatTimer = setInterval(() => {
      if (this._sseResponse && !this._sseResponse.writableEnded) {
        try {
          this._sseResponse.write(': ping\n\n');
        } catch {
          // write 실패 → 연결 죽음
          this._stopHeartbeat();
          this._sseResponse = null;
          this.onclose?.();
        }
      }
    }, this._options.heartbeatIntervalMs);

    // 프로세스 종료 방지 해제
    if (this._heartbeatTimer.unref) {
      this._heartbeatTimer.unref();
    }
  }

  /** 하트비트 중지 */
  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  /** 재전송 버퍼에 메시지 추가 (크기/TTL 관리) */
  private _addToReplayBuffer(msg: SentMessage): void {
    this._replayBuffer.push(msg);

    // 크기 제한
    while (this._replayBuffer.length > this._options.replayBufferSize) {
      this._replayBuffer.shift();
    }

    // TTL 만료 메시지 제거
    const cutoff = Date.now() - this._options.replayTtlMs;
    while (this._replayBuffer.length > 0 && this._replayBuffer[0].timestamp < cutoff) {
      this._replayBuffer.shift();
    }
  }

  /** Last-Event-ID 이후 메시지를 재전송 */
  private _replayFrom(lastEventId: string): void {
    const idx = this._replayBuffer.findIndex(m => m.id === lastEventId);
    if (idx === -1) return; // 해당 ID를 찾지 못하면 재전송 스킵

    // lastEventId 다음 메시지부터 재전송
    const toReplay = this._replayBuffer.slice(idx + 1);
    for (const msg of toReplay) {
      if (this._sseResponse && !this._sseResponse.writableEnded) {
        this._sseResponse.write(`id: ${msg.id}\nevent: message\ndata: ${msg.data}\n\n`);
      }
    }
  }

  /** Host/Origin 헤더 검증 */
  private _validateHeaders(req: IncomingMessage): string | undefined {
    const { allowedHosts, allowedOrigins } = this._options;

    if (allowedHosts && allowedHosts.length > 0) {
      const host = req.headers.host;
      if (!host || !allowedHosts.includes(host)) {
        return `Invalid Host header: ${host}`;
      }
    }

    if (allowedOrigins && allowedOrigins.length > 0) {
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) {
        return `Invalid Origin header: ${origin}`;
      }
    }

    return undefined;
  }
}

// ── 세션 관리자 ──

export interface AirSSESessionManagerOptions {
  /** 최대 동시 세션 수 (기본: 200) */
  maxSessions?: number;
  /** 세션 idle timeout ms (기본: 600000 = 10분) */
  idleTimeoutMs?: number;
  /** 정리 주기 ms (기본: 60000 = 1분) */
  cleanupIntervalMs?: number;
}

/**
 * SSE 세션 관리자 — 세션 생성/조회/정리를 담당한다.
 * idle timeout이 지난 세션을 자동으로 정리하여 메모리 누수를 방지한다.
 */
export class AirSSESessionManager {
  private _sessions = new Map<string, AirSSETransport>();
  private _cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private _maxSessions: number;
  private _idleTimeoutMs: number;

  constructor(options?: AirSSESessionManagerOptions) {
    this._maxSessions = options?.maxSessions ?? 200;
    this._idleTimeoutMs = options?.idleTimeoutMs ?? 600_000;
    const cleanupInterval = options?.cleanupIntervalMs ?? 60_000;

    // 주기적 정리 시작
    this._cleanupTimer = setInterval(() => this.cleanup(), cleanupInterval);
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  /** 새 세션 등록 */
  add(transport: AirSSETransport): boolean {
    if (this._sessions.size >= this._maxSessions) {
      return false;
    }
    this._sessions.set(transport.id, transport);
    return true;
  }

  /** 세션 조회 */
  get(sessionId: string): AirSSETransport | undefined {
    return this._sessions.get(sessionId);
  }

  /** 세션 제거 */
  remove(sessionId: string): void {
    this._sessions.delete(sessionId);
  }

  /** 현재 세션 수 */
  get size(): number {
    return this._sessions.size;
  }

  /** idle timeout이 지난 세션 정리 */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, transport] of this._sessions) {
      // 연결이 끊긴 세션 제거
      if (!transport.isConnected) {
        this._sessions.delete(id);
        cleaned++;
        continue;
      }

      // idle timeout 초과 세션 강제 종료
      if (now - transport.lastActivityAt > this._idleTimeoutMs) {
        transport.close().catch(() => {});
        this._sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /** 전체 종료 */
  async closeAll(): Promise<void> {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }

    const closePromises: Promise<void>[] = [];
    for (const transport of this._sessions.values()) {
      closePromises.push(transport.close().catch(() => {}));
    }
    await Promise.all(closePromises);
    this._sessions.clear();
  }
}
