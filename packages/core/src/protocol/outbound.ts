// @airmcp-dev/core — protocol/outbound.ts
//
// 서버 → 클라이언트 채널.
// 도구가 실행되는 동안 알림(notifications/progress, notifications/message)을 보내고,
// 서버발 요청(elicitation/create 등)을 보낸 뒤 클라이언트의 응답을 기다린다.
//
// transport마다 메시지를 "내보내는 방법"만 다르고(stdout, SSE 스트림, …), 응답 매칭은 같으므로
// transport는 OutboundChannel을 만들어 엔진에 넘기고, 클라이언트가 보낸 JSON-RPC 응답은
// PendingRequests.resolve()로 돌려준다.

export interface JsonRpcOutboundMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, any>;
}

/** 도구 실행 중 서버가 클라이언트로 보낼 수 있는 것 */
export interface AirOutbound {
  /** 알림 전송 (응답 없음). 채널이 닫혔으면 조용히 버린다. */
  notify(method: string, params?: Record<string, any>): void;
  /**
   * 서버발 요청 전송 후 클라이언트 응답을 기다린다.
   * transport가 양방향이 아니면 undefined — 호출자는 기능을 비활성화한다.
   */
  request?(method: string, params?: Record<string, any>): Promise<any>;
}

/** JSON-RPC 응답(method 없이 id + result/error)인지 */
export function isJsonRpcResponse(message: any): boolean {
  return (
    message !== null &&
    typeof message === 'object' &&
    !('method' in message) &&
    'id' in message &&
    ('result' in message || 'error' in message)
  );
}

/**
 * 서버가 보낸 요청의 응답 대기 테이블.
 * transport 하나가 하나를 가지고, 클라이언트 응답이 도착하면 resolve()로 넘긴다.
 */
export class PendingRequests {
  private pending = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private seq = 0;
  private readonly prefix: string;
  private readonly timeoutMs: number;

  constructor(options?: { prefix?: string; timeoutMs?: number }) {
    this.prefix = options?.prefix ?? 'srv';
    this.timeoutMs = options?.timeoutMs ?? 5 * 60_000; // elicitation은 사람이 답하므로 넉넉히
  }

  /** 요청 id를 발급하고 응답 Promise를 만든다. send는 실제로 메시지를 내보내는 함수. */
  send(
    method: string,
    params: Record<string, any> | undefined,
    write: (message: JsonRpcOutboundMessage) => void,
  ): Promise<any> {
    const id = `${this.prefix}-${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for client response to ${method} (${id})`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        write({ jsonrpc: '2.0', id, method, params });
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** 클라이언트 응답을 해당 요청에 전달한다. 매칭되는 요청이 있으면 true. */
  resolve(response: { id: string | number; result?: any; error?: { code: number; message: string; data?: any } }): boolean {
    const entry = this.pending.get(response.id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(response.id);
    if (response.error) {
      entry.reject(Object.assign(new Error(response.error.message), { code: response.error.code, data: response.error.data }));
    } else {
      entry.resolve(response.result);
    }
    return true;
  }

  /** 채널이 닫힐 때 — 남은 요청은 전부 실패 처리 */
  rejectAll(reason: string): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(`${reason} (${id})`));
    }
    this.pending.clear();
  }

  get size(): number {
    return this.pending.size;
  }
}
