// @airmcp-dev/core — context/server-context.ts
// 서버 글로벌 컨텍스트 — 서버 전체에서 공유되는 상태

export class ServerContext {
  readonly name: string;
  readonly version: string;
  readonly startedAt: Date;
  readonly state: Record<string, any> = {};

  private _status: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error' = 'idle';

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
    this.startedAt = new Date();
  }

  get status() {
    return this._status;
  }
  set status(s: typeof this._status) {
    this._status = s;
  }

  get uptime(): number {
    return Date.now() - this.startedAt.getTime();
  }
}
