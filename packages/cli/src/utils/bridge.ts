// air CLI — utils/bridge.ts
//
// stdio ↔ 게이트웨이 브릿지 (클라이언트 측 페일오버).
// Claude Desktop·Cursor 같은 클라이언트는 서버 주소를 하나만 받으므로, 게이트웨이를 여러 대 띄워도
// 클라이언트 스스로는 갈아타지 못한다. 이 브릿지가 stdio MCP 서버로 붙어서 게이트웨이 목록을 들고 있다가
// 현재 게이트웨이가 죽으면 다음으로 넘어간다. nginx·VIP 없이 air만으로 프론트 HA를 만드는 조각.
//
//   stdin(JSON 한 줄) → POST <gateway>/mcp → 응답(JSON 또는 SSE 이벤트들) → stdout(JSON 한 줄씩)
//
//   - tools/call은 Accept: text/event-stream으로 보내 progress/log/elicitation을 그대로 흘린다
//   - stdin으로 온 JSON-RPC 응답(elicitation 답)은 현재 게이트웨이로 POST
//   - initialize 파라미터를 기억해 두고, 페일오버 시 새 게이트웨이에 조용히 다시 보낸다
//   - 연결 실패·5xx면 다음 게이트웨이로. 아직 아무 이벤트도 못 받은 요청은 한 번 재시도
//   - 우선순위가 높은 게이트웨이가 복구되면 되돌아간다 (주기적 /health 프로브)

import type { Readable, Writable } from 'node:stream';

export interface BridgeOptions {
  /** 게이트웨이 베이스 URL들 (우선순위 순). /mcp 없이 */
  gateways: string[];
  /** Authorization: Bearer */
  token?: string;
  /** 요청 타임아웃 ms (기본: 60000 — 도구 실행 포함) */
  timeoutMs?: number;
  /** 우선순위 복귀 프로브 주기 ms (기본: 10000) */
  failbackProbeMs?: number;
  /** 로그 출력 (기본: stderr) */
  log?: (line: string) => void;
}

interface SseEvent { data: string }

function parseSseBlock(block: string): SseEvent | null {
  const data: string[] = [];
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  return data.length ? { data: data.join('\n') } : null;
}

function isResponse(m: any): boolean {
  return m && typeof m === 'object' && !('method' in m) && 'id' in m && ('result' in m || 'error' in m);
}

export class GatewayBridge {
  private readonly gateways: string[];
  private active = 0;
  private readonly timeoutMs: number;
  private readonly failbackProbeMs: number;
  private readonly log: (line: string) => void;
  private initializeParams: any = null;
  private buffer = '';
  private probeTimer: ReturnType<typeof setInterval> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: BridgeOptions, private readonly input: Readable, private readonly output: Writable) {
    if (!options.gateways.length) throw new Error('bridge: at least one gateway url is required');
    this.gateways = options.gateways.map((u) => u.replace(/\/+$/, ''));
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.failbackProbeMs = options.failbackProbeMs ?? 10_000;
    this.log = options.log ?? ((l) => process.stderr.write(l + '\n'));
  }

  get activeGateway(): string {
    return this.gateways[this.active];
  }

  start(): void {
    this.input.setEncoding('utf-8');
    this.input.on('data', (chunk: string) => {
      this.buffer += chunk;
      let nl: number;
      while ((nl = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, nl).replace(/\r$/, '');
        this.buffer = this.buffer.slice(nl + 1);
        if (line.trim()) void this.handleLine(line);
      }
    });
    this.input.on('end', () => this.stop());
    if (this.gateways.length > 1) {
      this.probeTimer = setInterval(() => void this.failbackProbe(), this.failbackProbeMs);
      this.probeTimer.unref();
    }
  }

  stop(): void {
    if (this.probeTimer) { clearInterval(this.probeTimer); this.probeTimer = null; }
  }

  // ── 출력 (한 줄 JSON, 순서 보장) ──

  private write(message: any): void {
    this.writeQueue = this.writeQueue.then(() => new Promise<void>((resolve) => {
      this.output.write(JSON.stringify(message) + '\n', () => resolve());
    }));
  }

  // ── 입력 처리 ──

  private async handleLine(line: string): Promise<void> {
    let message: any;
    try {
      message = JSON.parse(line);
    } catch {
      this.write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }

    // 클라이언트 → 서버 응답 (elicitation 답): 현재 게이트웨이로
    if (isResponse(message)) {
      try { await this.postJson(this.activeGateway, message, 'application/json'); } catch (err: any) {
        this.log(`[air:bridge] could not forward client response to ${this.activeGateway}: ${err?.message ?? err}`);
      }
      return;
    }

    if (message.method === 'initialize') this.initializeParams = message.params ?? {};

    // notification: 전달만
    if (message.id === undefined) {
      try { await this.postJson(this.activeGateway, message, 'application/json'); } catch { /* 알림은 유실 허용 */ }
      return;
    }

    const stream = message.method === 'tools/call';
    let attempt = 0;
    while (true) {
      const gateway = this.activeGateway;
      let emitted = 0;
      try {
        const final = await this.request(gateway, message, stream, (event) => { emitted++; this.write(event); });
        this.write(final);
        return;
      } catch (err: any) {
        const retriable = err?.retriable === true && emitted === 0 && attempt < this.gateways.length;
        this.log(`[air:bridge] ${message.method} via ${gateway} failed: ${err?.message ?? err}${retriable ? ' — failing over' : ''}`);
        if (!retriable) {
          this.write({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: `Gateway error: ${err?.message ?? err}` } });
          return;
        }
        attempt++;
        await this.failover();
      }
    }
  }

  // ── 게이트웨이 호출 ──

  private headers(accept: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: accept,
      ...(this.options.token ? { Authorization: `Bearer ${this.options.token}` } : {}),
    };
  }

  private async postJson(gateway: string, body: any, accept: string, signal?: AbortSignal): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${gateway}/mcp`, { method: 'POST', headers: this.headers(accept), body: JSON.stringify(body), signal });
    } catch (err: any) {
      throw Object.assign(new Error(`connection failed: ${err?.message ?? err}`), { retriable: true });
    }
    if (res.status >= 500 || res.status === 404) {
      throw Object.assign(new Error(`HTTP ${res.status}`), { retriable: true });
    }
    return res;
  }

  /** 요청 하나를 보내고 최종 응���을 돌려준다. SSE면 중간 이벤트를 onEvent로 */
  private async request(gateway: string, message: any, stream: boolean, onEvent: (event: any) => void): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.postJson(gateway, message, stream ? 'application/json, text/event-stream' : 'application/json', controller.signal);
      if (!String(res.headers.get('content-type')).includes('text/event-stream')) {
        return await res.json();
      }
      // SSE: 마지막 응답(id 일치)만 돌려주고 나머지는 흘린다
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let final: any;
      const consume = (block: string) => {
        const ev = parseSseBlock(block);
        if (!ev) return;
        let m: any;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (isResponse(m) && m.id === message.id) final = m;
        else onEvent(m);
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
          const sepLen = buf.slice(idx).match(/^\r?\n\r?\n/)![0].length;
          consume(buf.slice(0, idx));
          buf = buf.slice(idx + sepLen);
        }
      }
      if (buf.trim()) consume(buf);
      if (!final) throw new Error('stream ended without a response');
      return final;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── 페일오버 / 페일백 ──

  private async failover(): Promise<void> {
    const next = (this.active + 1) % this.gateways.length;
    if (next === this.active) return;
    this.active = next;
    this.log(`[air:bridge] switched to ${this.activeGateway}`);
    await this.reinitialize(this.activeGateway);
  }

  /** 새 게이트웨이에 initialize를 조용히 다시 보낸다 (클라이언트 능력 전달) */
  private async reinitialize(gateway: string): Promise<void> {
    if (!this.initializeParams) return;
    try {
      const res = await this.postJson(gateway, { jsonrpc: '2.0', id: 'bridge-init', method: 'initialize', params: this.initializeParams }, 'application/json');
      await res.text();
      await this.postJson(gateway, { jsonrpc: '2.0', method: 'notifications/initialized' }, 'application/json').catch(() => {});
    } catch (err: any) {
      this.log(`[air:bridge] re-initialize on ${gateway} failed: ${err?.message ?? err}`);
    }
  }

  /** 우선순위가 더 높은 게이트웨이가 살아났으면 되돌아간다 */
  private async failbackProbe(): Promise<void> {
    for (let i = 0; i < this.active; i++) {
      try {
        const res = await fetch(`${this.gateways[i]}/health`, { signal: AbortSignal.timeout(2_000) });
        if (res.ok) {
          this.active = i;
          this.log(`[air:bridge] failing back to ${this.activeGateway}`);
          await this.reinitialize(this.activeGateway);
          return;
        }
      } catch { /* still down */ }
    }
  }
}
