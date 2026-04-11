# AI Context Document

A context document for AI coding assistants to accurately use the air framework. Include this file in your project so AI understands air's APIs.

## Usage

### Claude

**Claude Desktop — Add to Project Knowledge:**

Create a project and upload the context file to Knowledge. The AI will use accurate air APIs in that project.

**Claude Code — Add to project:**

Copy the content below and save as `CLAUDE.md` in your project root. Claude Code automatically reads this file.

### Cursor

Copy the content below and save as `.cursorrules` in your project root. Cursor automatically includes this file in context.

### GitHub Copilot

Copy the content below and save to `.github/copilot-instructions.md`.

### Other AI assistants

Works with Windsurf, Cline, Aider, and most AI coding tools. Save according to each tool's context file convention, or paste the content at the start of your conversation.

## Context document content

Copy the content below and use as needed.

::: details View full content (click to expand)

<<< @/public/air-context.md

:::

## What's included

- defineServer, defineTool, defineResource, definePrompt full API
- All 19 built-in plugin signatures and recommended order
- StorageAdapter full methods (set/get/delete/list/entries/append/query)
- Middleware authoring (before/after/onError)
- McpErrors factory complete
- CLI commands and supported client list
- Gateway config
- Custom plugin structure
- Gotchas (ESM, stdio logging, TTL units, etc.)
