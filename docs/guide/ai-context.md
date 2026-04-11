# AI Context Document

A context document for AI coding assistants to accurately use the air framework. Include this file in your project so AI understands air's APIs.

## Usage

### Claude

**Claude Desktop — Add to Project Knowledge:**

Create a project and upload the context file to Knowledge. The AI will use accurate air APIs in that project.

**Claude Code — Add to project:**

```bash
curl -o CLAUDE.md https://raw.githubusercontent.com/airmcp-dev/air/main/CONTEXT.md
```

Claude Code automatically reads `CLAUDE.md` from the project root.

### Cursor

Save as `.cursorrules` in your project root:

```bash
curl -o .cursorrules https://raw.githubusercontent.com/airmcp-dev/air/main/CONTEXT.md
```

Cursor automatically includes `.cursorrules` in context.

### GitHub Copilot

Save to `.github/copilot-instructions.md`:

```bash
mkdir -p .github
curl -o .github/copilot-instructions.md https://raw.githubusercontent.com/airmcp-dev/air/main/CONTEXT.md
```

### Other AI assistants

Works with Windsurf, Cline, Aider, and most AI coding tools. Save according to each tool's context file convention, or paste the content at the start of your conversation.

## Download

[Download from GitHub →](https://raw.githubusercontent.com/airmcp-dev/air/main/CONTEXT.md)

## Context document content

Below is the full content to provide to AI. Copy and use as needed.

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
