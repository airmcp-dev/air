# Resources & Prompts Reference

## defineResource

```typescript
// Style 1: URI + options
defineResource('config://app', { name: 'config', handler: async () => ({}) });

// Style 2: Single object
defineResource({ uri: 'config://app', name: 'config', handler: async () => ({}) });
```

### AirResourceDef

```typescript
interface AirResourceDef {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;            // Default: 'text/plain'
  handler: (uri: string, context: AirResourceContext) => Promise<AirResourceContent>;
}

interface AirResourceContext { requestId: string; serverName: string; }

type AirResourceContent =
  | string
  | { text: string; mimeType?: string }
  | { blob: string; mimeType: string };
```

## Template helpers

### extractTemplateVars(uri)

```typescript
extractTemplateVars('db:///{database}/{table}'); // → ['database', 'table']
```

### matchTemplate(template, uri)

Internal: `{var}` → `(?<var>[^/]+)` regex.

```typescript
matchTemplate('user:///{id}/profile', 'user:///42/profile'); // → { id: '42' }
matchTemplate('user:///{id}/profile', 'user:///42/settings'); // → null
```

## definePrompt

```typescript
definePrompt('summarize', {
  arguments: [{ name: 'text', required: true }],
  handler: ({ text }) => [{ role: 'user', content: `Summarize: ${text}` }],
});
```

### AirPromptDef

```typescript
interface AirPromptDef {
  name: string;
  description?: string;
  arguments?: AirPromptArg[];
  handler: (args: Record<string, string>) => Promise<AirPromptMessage[]> | AirPromptMessage[];
}

interface AirPromptArg { name: string; description?: string; required?: boolean; }
interface AirPromptMessage { role: 'user' | 'assistant'; content: string; }
```

::: info
Prompt arguments are always `string` type (MCP protocol constraint).
:::
