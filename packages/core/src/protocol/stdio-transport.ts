// @airmcp-dev/core — protocol/stdio-transport.ts
//
// air 자체 stdio transport.
// MCP SDK의 StdioServerTransport를 대체.
// stdin에서 JSON-RPC 메시지를 읽고, stdout으로 응답을 쓴다.
// Content-Length 헤더 기반 메시지 프레이밍 (LSP 스타일).

import type { McpProtocolEngine } from './mcp-protocol.js';

const HEADER_DELIMITER = '\r\n\r\n';
const CONTENT_LENGTH_RE = /^Content-Length:\s*(\d+)\s*$/im;

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

  /** 메시지를 stdout으로 전송한다 (Content-Length 프레이밍). */
  private write(message: any): void {
    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf-8')}${HEADER_DELIMITER}`;
    process.stdout.write(header + json);
  }

  /** 버퍼에서 완전한 메시지를 추출하고 처리한다. */
  private processBuffer(): void {
    while (true) {
      // 헤더 구분자 찾기
      const headerEnd = this.buffer.indexOf(HEADER_DELIMITER);
      if (headerEnd === -1) break;

      // Content-Length 파싱
      const headerBlock = this.buffer.slice(0, headerEnd);
      const match = headerBlock.match(CONTENT_LENGTH_RE);
      if (!match) {
        // 헤더가 올바르지 않으면 해당 부분 버리기
        this.buffer = this.buffer.slice(headerEnd + HEADER_DELIMITER.length);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + HEADER_DELIMITER.length;
      const bodyEnd = bodyStart + contentLength;

      // 본문이 아직 다 안 왔으면 대기
      if (Buffer.byteLength(this.buffer.slice(bodyStart), 'utf-8') < contentLength) break;

      // 본문 추출
      const body = this.buffer.slice(bodyStart, bodyStart + this.getCharLength(this.buffer, bodyStart, contentLength));
      this.buffer = this.buffer.slice(bodyStart + this.getCharLength(this.buffer, bodyStart, contentLength));

      // JSON-RPC 메시지 처리
      this.handleMessage(body);
    }
  }

  /** UTF-8 바이트 길이에 해당하는 문자 길이를 반환한다. */
  private getCharLength(str: string, start: number, byteLength: number): number {
    let bytes = 0;
    let chars = 0;
    for (let i = start; i < str.length && bytes < byteLength; i++) {
      const code = str.charCodeAt(i);
      if (code <= 0x7f) bytes += 1;
      else if (code <= 0x7ff) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i++; } // surrogate pair
      else bytes += 3;
      chars++;
    }
    return chars;
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
