// @airmcp-dev/core — plugin/builtin/sanitizer.ts
//
// 입력 데이터 정제 플러그인.
// XSS, HTML 태그, 제어 문자를 자동으로 제거.
//
// @example
//   defineServer({
//     use: [sanitizerPlugin()],
//   });

import type { AirPlugin } from '../../types/plugin.js';
import type { AirMiddleware } from '../../types/middleware.js';

interface SanitizerOptions {
  /** HTML 태그 제거 (기본: true) */
  stripHtml?: boolean;
  /** 제어 문자 제거 (기본: true) */
  stripControl?: boolean;
  /** 최대 문자열 길이 (기본: 10000) */
  maxStringLength?: number;
  /** 적용 제외 도구 */
  exclude?: string[];
}

function sanitizeValue(value: any, opts: Required<SanitizerOptions>): any {
  if (typeof value === 'string') {
    let s = value;
    if (opts.stripHtml) s = s.replace(/<[^>]*>/g, '');
    if (opts.stripControl) s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (s.length > opts.maxStringLength) s = s.slice(0, opts.maxStringLength);
    return s;
  }
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, opts));
  if (value && typeof value === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      cleaned[k] = sanitizeValue(v, opts);
    }
    return cleaned;
  }
  return value;
}

export function sanitizerPlugin(options?: SanitizerOptions): AirPlugin {
  const opts = {
    stripHtml: options?.stripHtml !== false,
    stripControl: options?.stripControl !== false,
    maxStringLength: options?.maxStringLength ?? 10_000,
    exclude: options?.exclude || [],
  };

  const excludeSet = new Set(opts.exclude);

  const middleware: AirMiddleware = {
    name: 'air:sanitizer',
    before: async (ctx) => {
      if (excludeSet.has(ctx.tool.name)) return;
      const cleaned = sanitizeValue(ctx.params, opts);
      return { params: cleaned };
    },
  };

  return {
    meta: { name: 'air:sanitizer', version: '1.0.0' },
    middleware: [middleware],
  };
}
