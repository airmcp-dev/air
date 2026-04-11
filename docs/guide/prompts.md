# Prompts

Prompts are reusable message templates that MCP clients can invoke. They generate structured messages for LLM conversations.

## Tools vs Prompts

| | Tool | Prompt |
|---|---|---|
| **Purpose** | AI executes code on the server | Message template sent to AI |
| **Who invokes** | AI selects and calls automatically | User selects explicitly |
| **Returns** | Execution result (text, image, etc.) | Message array (role + content) |
| **Examples** | Run DB query, create file | "Review this code" template |

Simple rule: **runs code on server → Tool**, **assembles messages for AI → Prompt**.

## Basic prompt

```typescript
import { definePrompt } from '@airmcp-dev/core';

const summarize = definePrompt('summarize', {
  description: 'Summarize content',
  arguments: [
    { name: 'text', description: 'Text to summarize', required: true },
    { name: 'style', description: 'Summary style (brief/detailed)', required: false },
  ],
  handler: async ({ text, style }) => [
    {
      role: 'user',
      content: `Summarize the following in a ${style || 'brief'} style:\n\n${text}`,
    },
  ],
});
```

## definePrompt API

Two calling styles:

```typescript
// Style 1: name + options
definePrompt('summarize', { description, arguments, handler });

// Style 2: single object
definePrompt({ name: 'summarize', description, arguments, handler });
```

### AirPromptDef

```typescript
interface AirPromptDef {
  name: string;
  description?: string;
  arguments?: AirPromptArg[];
  handler: (args: Record<string, string>) => Promise<AirPromptMessage[]> | AirPromptMessage[];
}
```

`handler` can be sync or async.

### AirPromptArg

```typescript
interface AirPromptArg {
  name: string;
  description?: string;
  required?: boolean;    // Default: false
}
```

### AirPromptMessage

```typescript
interface AirPromptMessage {
  role: 'user' | 'assistant';
  content: string;
}
```

Internally converted to `{ role, content: { type: 'text', text: content } }` when registered with MCP SDK.

## Arguments

Prompt arguments are all `string` type (unlike tool params which support typed validation). This is a constraint of the MCP protocol spec.

```typescript
definePrompt('search-help', {
  arguments: [
    { name: 'topic', description: 'Search topic', required: true },
    { name: 'language', description: 'Response language', required: false },
  ],
  handler: ({ topic, language }) => [
    { role: 'user', content: `Explain ${topic} in ${language || 'English'}.` },
  ],
});
```

Prompts without arguments:

```typescript
definePrompt('greeting', {
  description: 'Default greeting message',
  handler: () => [
    { role: 'user', content: 'Hello! How can I help you?' },
  ],
});
```

## Multi-turn prompts

Return multiple messages for a conversation template:

```typescript
definePrompt('code-review', {
  description: 'Review code and suggest improvements',
  arguments: [
    { name: 'code', description: 'Code to review', required: true },
    { name: 'language', description: 'Programming language', required: true },
  ],
  handler: ({ code, language }) => [
    {
      role: 'user',
      content: `Review this ${language} code for bugs and improvements:\n\n\`\`\`${language}\n${code}\n\`\`\``,
    },
    {
      role: 'assistant',
      content: 'I\'ll review for potential bugs, performance issues, and style improvements.',
    },
    {
      role: 'user',
      content: 'Focus on security vulnerabilities if any.',
    },
  ],
});
```

## Practical examples

### Documentation helper

```typescript
definePrompt('write-doc', {
  description: 'API documentation template',
  arguments: [
    { name: 'functionName', required: true },
    { name: 'signature', required: true },
    { name: 'purpose', required: true },
  ],
  handler: ({ functionName, signature, purpose }) => [
    {
      role: 'user',
      content: `Write API documentation for the following function.

Function: ${functionName}
Signature: ${signature}
Purpose: ${purpose}

Include: description, parameter table, return value, usage example, and caveats.`,
    },
  ],
});
```

### SQL query helper

```typescript
definePrompt('sql-help', {
  description: 'SQL query writing assistant',
  arguments: [
    { name: 'tables', description: 'Available table definitions', required: true },
    { name: 'question', description: 'Natural language question', required: true },
  ],
  handler: ({ tables, question }) => [
    {
      role: 'user',
      content: `Write a SQL query based on these tables:\n\n${tables}\n\nQuestion: ${question}\n\nUse PostgreSQL syntax and include an explanation.`,
    },
  ],
});
```

### Error analysis

```typescript
definePrompt('analyze-error', {
  description: 'Analyze error logs and suggest fixes',
  arguments: [
    { name: 'error', description: 'Error message or stack trace', required: true },
    { name: 'context', description: 'Context where error occurred', required: false },
  ],
  handler: ({ error, context }) => [
    {
      role: 'user',
      content: `Analyze this error and suggest fixes:\n\nError:\n${error}${context ? `\n\nContext:\n${context}` : ''}\n\nInclude:\n1. Root cause analysis\n2. Fix (with code)\n3. Prevention measures`,
    },
  ],
});
```

## Register in server

```typescript
defineServer({
  prompts: [
    definePrompt('summarize', {
      description: 'Summarize text',
      arguments: [{ name: 'text', required: true }],
      handler: ({ text }) => [
        { role: 'user', content: `Please summarize:\n\n${text}` },
      ],
    }),
    definePrompt('translate', {
      description: 'Translate text',
      arguments: [
        { name: 'text', required: true },
        { name: 'to', description: 'Target language', required: true },
      ],
      handler: ({ text, to }) => [
        { role: 'user', content: `Translate to ${to}:\n\n${text}` },
      ],
    }),
  ],
});
```
