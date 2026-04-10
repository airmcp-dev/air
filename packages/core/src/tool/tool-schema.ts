// @airmcp-dev/core — tool/tool-schema.ts
// ParamShorthand → zod 스키마 자동 변환

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
      const isOptional = value.endsWith('?');
      const baseType = value.replace('?', '');
      properties[key] = { type: baseType === 'object' ? 'object' : baseType };
      if (!isOptional) required.push(key);
    } else {
      // zod 스키마 → JSON schema 변환 (간이)
      properties[key] = { type: 'string' };
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
