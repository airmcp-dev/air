// @airmcp-dev/gateway — gateway/sse.ts
//
// SSE(text/event-stream) 바디를 이벤트 단위로 읽는다.
// 하위 서버의 Streamable HTTP 응답 스트림을 파싱해 JSON-RPC 메시지를 하나씩 꺼낼 때 쓴다.

export interface SseEvent {
  event?: string;
  id?: string;
  data: string;
}

/** 한 블록("\n\n"으로 끝난 줄 묶음)을 SseEvent로 파싱한다. data 줄이 없으면 null (주석/하트비트). */
export function parseSseBlock(block: string): SseEvent | null {
  let event: string | undefined;
  let id: string | undefined;
  const data: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') data.push(value);
    else if (field === 'event') event = value;
    else if (field === 'id') id = value;
  }
  if (data.length === 0) return null;
  return { event, id, data: data.join('\n') };
}

/**
 * ReadableStream<Uint8Array>를 끝까지 읽으며 이벤트마다 onEvent를 부른다.
 * 스트림이 끝나면 resolve. 취소(signal)되면 reader를 놓고 종료한다.
 */
export async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseEvent) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const onAbort = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      // 블록 구분자: \n\n (CRLF도 허용)
      while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const sepLen = buffer.slice(idx).match(/^\r?\n\r?\n/)![0].length;
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + sepLen);
        const event = parseSseBlock(block);
        if (event) await onEvent(event);
      }
    }
    // 마지막 블록이 구분자 없이 끝났을 수 있다
    const tail = buffer + decoder.decode();
    if (tail.trim()) {
      const event = parseSseBlock(tail);
      if (event) await onEvent(event);
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
}
