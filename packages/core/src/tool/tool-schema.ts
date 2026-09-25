// @airmcp-dev/core — tool/tool-schema.ts
// ParamShorthand → zod 스키마 자동 변환
// Zod v3, v4, Standard Schema 모두 지원

import { z } from 'zod';
import type { AirToolParams, ParamShorthand, ParamObjectDef } from '../types/tool.js';

/** 단축 타입 문자열을 zod 스키마로 변환 */
function shorthandToZod(shorthand: ParamShorthand): z.ZodType {
  switch (shorthand) {
    case 'string':
      return z.string();
    case 'string?':
      return z.string().optional();
    case 'number':
      return z.number();
    case 'number?':
      return z.number().optional();
    case 'boolean':
      return z.boolean();
    case 'boolean?':
      return z.boolean().optional();
    case 'object':
      return z.record(z.any());
    case 'object?':
      return z.record(z.any()).optional();
    default:
      return z.any();
  }
}

/** 객체 형식 파라미터 정의인지 판별 */
function isParamObjectDef(value: any): value is ParamObjectDef {
  return value && typeof value === 'object' && 'type' in value && typeof value.type === 'string';
}

/** 객체 형식 파라미터를 zod 스키마로 변환 */
function objectDefToZod(def: ParamObjectDef): z.ZodType {
  let schema: z.ZodType;
  switch (def.type) {
    case 'string':
      schema = def.description ? z.string().describe(def.description) : z.string();
      break;
    case 'number':
      schema = def.description ? z.number().describe(def.description) : z.number();
      break;
    case 'boolean':
      schema = def.description ? z.boolean().describe(def.description) : z.boolean();
      break;
    case 'object':
      schema = def.description ? z.record(z.any()).describe(def.description) : z.record(z.any());
      break;
    default:
      schema = z.any();
  }
  return def.optional ? schema.optional() : schema;
}

/** Zod 스키마인지 판별 (v3: _def 존재, v4: ~standard 프로퍼티) */
function isZodSchema(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  // Zod v3: _def 프로퍼티
  if ('_def' in value) return true;
  // Zod v4 / Standard Schema: ~standard 프로퍼티
  if ('~standard' in value) return true;
  // 함수 형태의 parse/safeParse가 있으면 Zod-like
  if (typeof value.parse === 'function' && typeof value.safeParse === 'function') return true;
  return false;
}

/** Zod 스키마에서 JSON Schema를 추출한다 (v3 + v4 호환) */
function zodToJsonSchemaProperty(schema: any): Record<string, any> {
  // Zod v4: ~standard.type으로 타입 정보 접근
  if ('~standard' in schema) {
    const std = schema['~standard'];
    if (std.type === 'string') return { type: 'string' };
    if (std.type === 'number' || std.type === 'float' || std.type === 'integer') return { type: 'number' };
    if (std.type === 'boolean') return { type: 'boolean' };
    if (std.type === 'array') return { type: 'array' };
    if (std.type === 'object') return { type: 'object' };
  }

  // Zod v3: _def.typeName 기반
  if ('_def' in schema) {
    const def = schema._def;
    const typeName = def.typeName;

    if (typeName === 'ZodString') return { type: 'string', ...(def.description ? { description: def.description } : {}) };
    if (typeName === 'ZodNumber') return { type: 'number', ...(def.description ? { description: def.description } : {}) };
    if (typeName === 'ZodBoolean') return { type: 'boolean', ...(def.description ? { description: def.description } : {}) };
    if (typeName === 'ZodArray') return { type: 'array' };
    if (typeName === 'ZodObject') {
      // 중첩 object — shape에서 재귀 추출
      const shape = def.shape?.();
      if (shape) {
        const props: Record<string, any> = {};
        const req: string[] = [];
        for (const [k, v] of Object.entries(shape)) {
          props[k] = zodToJsonSchemaProperty(v);
          if (!(v as any)?.isOptional?.()) req.push(k);
        }
        return { type: 'object', properties: props, ...(req.length > 0 ? { required: req } : {}) };
      }
      return { type: 'object' };
    }
    if (typeName === 'ZodOptional') {
      return zodToJsonSchemaProperty(def.innerType);
    }
    if (typeName === 'ZodDefault') {
      const inner = zodToJsonSchemaProperty(def.innerType);
      return { ...inner, default: def.defaultValue() };
    }
    if (typeName === 'ZodEnum') {
      return { type: 'string', enum: def.values };
    }
    if (typeName === 'ZodRecord') return { type: 'object' };
    if (typeName === 'ZodAny') return {};
  }

  // 최후 폴백
  return { type: 'string' };
}

/** Zod object 스키마에서 optional 여부를 판별 */
function isZodOptional(schema: any): boolean {
  if ('_def' in schema) {
    return schema._def.typeName === 'ZodOptional' || schema._def.typeName === 'ZodDefault';
  }
  if (typeof schema.isOptional === 'function') return schema.isOptional();
  return false;
}

/** AirToolParams를 zod object 스키마로 변환 */
export function paramsToZodSchema(params?: AirToolParams): z.ZodObject<any> | undefined {
  if (!params || Object.keys(params).length === 0) return undefined;

  const shape: Record<string, z.ZodType> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      shape[key] = shorthandToZod(value as ParamShorthand);
    } else if (isParamObjectDef(value)) {
      shape[key] = objectDefToZod(value);
    } else {
      // 이미 zod 스키마인 경우 그대로 사용
      shape[key] = value;
    }
  }

  return z.object(shape).passthrough();
}

/** AirToolParams를 MCP JSON Schema로 변환 (도구 등록용) */
export function paramsToJsonSchema(params?: AirToolParams): Record<string, any> | undefined {
  if (!params || Object.keys(params).length === 0) return undefined;

  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      // ParamShorthand
      const isOptional = value.endsWith('?');
      const baseType = value.replace('?', '');
      properties[key] = { type: baseType === 'object' ? 'object' : baseType };
      if (!isOptional) required.push(key);
    } else if (isParamObjectDef(value)) {
      // ParamObjectDef
      properties[key] = { type: value.type, ...(value.description ? { description: value.description } : {}) };
      if (!value.optional) required.push(key);
    } else if (isZodSchema(value)) {
      // Zod v3/v4 스키마 — JSON Schema 추출
      properties[key] = zodToJsonSchemaProperty(value);
      if (!isZodOptional(value)) required.push(key);
    } else {
      properties[key] = { type: 'string' };
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
