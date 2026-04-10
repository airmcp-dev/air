# Contributing to air

Thank you for your interest in contributing to air.

## Getting Started

```bash
git clone https://github.com/airmcp-dev/air.git
cd air
pnpm install
npx vitest run
```

## Project Structure

```
packages/
  core/     -- Server, tools, plugins, storage, transport
  cli/      -- CLI commands and templates
  gateway/  -- Multi-server proxy
  logger/   -- Structured logging
  meter/    -- Call tracking and classification
  shield/   -- Enterprise: advanced security (commercial)
  hive/     -- Enterprise: process management (commercial)
examples/
  memo-server/       -- Basic CRUD example
  plugin-showcase/   -- Plugin integration example
```

## Development

```bash
# Run all tests
npx vitest run

# Run specific package tests
npx vitest run packages/core

# Type check
cd packages/core && npx tsc --noEmit

# Build CLI (includes templates)
cd packages/cli && pnpm build
```

## Creating a Plugin

Plugins follow the AirPlugin interface:

```typescript
import type { AirPlugin } from '@airmcp-dev/core';

export function myPlugin(options?: MyOptions): AirPlugin {
  return {
    meta: { name: 'my-plugin', version: '1.0.0' },
    middleware: [{
      name: 'my-plugin',
      before: async (ctx) => { /* pre-processing */ },
      after: async (ctx) => { /* post-processing */ },
      onError: async (ctx, error) => { /* error handling */ },
    }],
  };
}
```

## Plugin Registry

To publish a plugin to the air plugin registry:

1. Create a package named `air-plugin-<name>` or `@<scope>/air-plugin-<name>`
2. Include an `air-plugin.json` manifest (see Plugin Manifest below)
3. Publish to npm
4. Register at https://plugins.airmcp.dev (coming soon)

### Plugin Manifest (air-plugin.json)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": "Your Name",
  "license": "MIT",
  "air": {
    "minVersion": "0.1.0",
    "category": "security|performance|monitoring|data|network|dev",
    "tags": ["auth", "oauth"],
    "configSchema": {
      "type": "object",
      "properties": {
        "apiKey": { "type": "string" }
      }
    }
  }
}
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Run `npx vitest run` and ensure all tests pass
5. Submit a pull request

## Code of Conduct

Be respectful and constructive. We follow the Contributor Covenant.

## License

By contributing to air, you agree that your contributions will be licensed under the Apache-2.0 License.

## Contact

- Issues: https://github.com/airmcp-dev/air/issues
- Discussions: https://github.com/airmcp-dev/air/discussions
- Community: https://community.airmcp.dev
- Email: labs@codepedia.kr
- Foundation: https://foundation.airmcp.dev (coming soon)
