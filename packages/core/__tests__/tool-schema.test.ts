// @airmcp-dev/core — __tests__/tool-schema.test.ts

import { describe, it, expect } from 'vitest';
import { paramsToZodSchema, paramsToJsonSchema } from '../src/tool/tool-schema.js';

describe('paramsToZodSchema', () => {
  it('should convert string shorthand to zod schema', () => {
    const schema = paramsToZodSchema({
      name: 'string',
      age: 'number',
    });

    expect(schema).toBeDefined();
    expect(schema!.shape).toBeDefined();
  });

  it('should convert object param definition to zod schema', () => {
    const schema = paramsToZodSchema({
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results' },
    });

    expect(schema).toBeDefined();
  });

  it('should return undefined for empty params', () => {
    const schema = paramsToZodSchema(undefined);
    expect(schema).toBeUndefined();
  });
});

describe('paramsToJsonSchema', () => {
  it('should produce valid JSON schema structure', () => {
    const jsonSchema = paramsToJsonSchema({
      name: { type: 'string', description: 'Your name' },
    });

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema!.type).toBe('object');
    expect(jsonSchema!.properties).toBeDefined();
  });
});
