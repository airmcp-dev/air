// @airmcp-dev/core — types/resource.ts

/** 리소스 정의 */
export interface AirResourceDef {
  /** 리소스 URI (예: "file:///{path}") */
  uri: string;
  /** 이름 */
  name: string;
  /** 설명 */
  description?: string;
  /** MIME 타입 (기본: text/plain) */
  mimeType?: string;
  /** 리소스 핸들러 */
  handler: (
    uri: string,
    context: AirResourceContext,
  ) => Promise<AirResourceContent> | AirResourceContent;
}

export interface AirResourceContext {
  requestId: string;
  serverName: string;
}

export type AirResourceContent =
  | string
  | { text: string; mimeType?: string }
  | { blob: string; mimeType: string };
