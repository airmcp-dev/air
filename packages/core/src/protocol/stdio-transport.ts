// @airmcp-dev/core — protocol/stdio-transport.ts
//
// air 자체 stdio transport.
// MCP SDK의 StdioServerTransport를 대체.
// stdin에서 JSON-RPC 메시지를 읽고, stdout으로 응답을 쓴다.
// 줄 단위 JSON 프레이밍 (MCP 스펙 basic/transports, stdio):
//   - 메시지 하나가 JSON 한 줄이고 줄바꿈(\n)으로 구분한다. 메시지 안에는 줄바꿈을 넣지 않는다.
//   - stdout에는 MCP 메시지 외에는 아무것도 쓰지 않는다.

import type { McpProtocolEngine } from './mcp-protocol.js';

export class AirStdioTransport {
  private engine: McpProtocolEngine;
  private buffer = '';
  private running = false;

  constructor(engine: McpProtocolEngine) {
    this.engine = engine;
  }

  /** stdio transport를 시작한다. stdin을 읽고 stdout으로 응답한다. */
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // stdin을 UTF-8 스트림으로 읽기
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => {
      this.buffer += chunk;
      this.processBuffer();
    });

    process.stdin.on('end', () => {
      this.running = false;
    });

    process.stdin.on('error', (err) => {
      console.error(`[air:stdio] stdin error: ${err.message}`);
      this.running = false;
    });

    // stdin resume (paused 상태일 수 있음)
    process.stdin.resume();
  }

  /** 메시지를 stdout으로 전송한다 (JSON 한 줄 + 줄바꿈). */
  private write(message: any): void {
    // JSON.stringify는 문자열 안의 줄바꿈을 \n으로 이스케이프하므로 한 줄로 나간다
    process.stdout.write(JSON.stringify(message) + '\n');
  }

  /** 버퍼에서 완성된 줄을 꺼내 메시지로 처리한다. */
  private processBuffer(): void {
    let newline = this.buffer.indexOf('\n');
    while (newline !== -1) {
      // CRLF로 보내는 클라이언트도 받는다
      const line = this.buffer.slice(0, newline).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newline + 1);

      // 빈 줄은 메시지가 아니므로 건너뛴다
      if (line.trim() !== '') this.handleMessage(line);

      newline = this.buffer.indexOf('\n');
    }
  }

  /** 개별 메시지를 파싱하고 프로토콜 엔진에 전달한다. */
  private async handleMessage(raw: string): Promise<void> {
    let message: any;
    try {
      message = JSON.parse(raw);
    } catch {
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      };
      this.write(errorResponse);
      return;
    }

    // 배치 요청 처리 (JSON-RPC 2.0 스펙)
    if (Array.isArray(message)) {
      const responses = await Promise.all(
        message.map(msg => this.engine.handleMessage(msg)),
      );
      // notification(id 없음)은 응답 없이 필터링
      const filtered = responses.filter(r => r.id !== null);
      if (filtered.length > 0) {
        this.write(filtered);
      }
      return;
    }

    // 단일 요청
    const response = await this.engine.handleMessage(message);

    // notification은 응답 없음 (id가 undefined인 경우)
    if (message.id === undefined && !message.id) return;

    this.write(response);
  }

  /** transport를 중지한다. */
  stop(): void {
    this.running = false;
    process.stdin.pause();
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('end');
    process.stdin.removeAllListeners('error');
  }
}
