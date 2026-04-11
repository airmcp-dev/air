# Plugin Manifest

Third-party plugins use `air-plugin.json` to describe themselves. The manifest enables plugin discovery, version compatibility checking, and registry publication.

## air-plugin.json

```json
{
  "name": "air-plugin-postgres",
  "version": "1.0.0",
  "description": "PostgreSQL storage adapter for air",
  "author": "Your Name",
  "license": "MIT",
  "air": {
    "minVersion": "0.1.0",
    "category": "storage",
    "tags": ["database", "postgres", "sql"],
    "entry": "dist/index.js",
    "factory": "postgresPlugin"
  },
  "package": "air-plugin-postgres",
  "homepage": "https://github.com/you/air-plugin-postgres",
  "repository": "https://github.com/you/air-plugin-postgres"
}
```

## Manifest fields

### Required

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Plugin name (can differ from npm package name) |
| `version` | `string` | Semver version |
| `description` | `string` | Short description |
| `author` | `string` | Author name |
| `license` | `string` | SPDX license identifier |
| `air.minVersion` | `string` | Minimum compatible air version |
| `air.category` | `PluginCategory` | Plugin category |

### Optional

| Field | Type | Description |
|-------|------|-------------|
| `air.tags` | `string[]` | Search tags |
| `air.configSchema` | `object` | JSON Schema for plugin options |
| `air.entry` | `string` | Entrypoint file (default: `index.js`) |
| `air.factory` | `string` | Factory function name (default: `default`) |
| `package` | `string` | npm package name |
| `homepage` | `string` | Documentation URL |
| `repository` | `string` | Source code URL |

## Plugin categories

```typescript
type PluginCategory =
  | 'security'
  | 'performance'
  | 'monitoring'
  | 'data'
  | 'network'
  | 'dev'
  | 'storage'
  | 'auth'
  | 'logging'
  | 'other';
```

## Config schema

Describe your plugin's options with JSON Schema so users get validation:

```json
{
  "air": {
    "configSchema": {
      "type": "object",
      "properties": {
        "connectionString": {
          "type": "string",
          "description": "PostgreSQL connection URL"
        },
        "poolSize": {
          "type": "number",
          "default": 10,
          "description": "Connection pool size"
        }
      },
      "required": ["connectionString"]
    }
  }
}
```

## Plugin registry

The air plugin registry at `plugins.airmcp.dev` indexes published plugins.

Default registry URL: `https://plugins.airmcp.dev/api/v1`

### Registry config

```typescript
interface PluginRegistryConfig {
  url: string;       // Registry URL
  apiKey?: string;   // Required for publishing
}
```

In `air.config.ts`:

```typescript
export default {
  registry: {
    url: 'https://plugins.airmcp.dev/api/v1',  // default
    apiKey: process.env.PLUGIN_REGISTRY_KEY,    // only needed for publish
  },
};
```

### Registry entry

Published plugins appear with metadata:

```typescript
interface PluginRegistryEntry {
  manifest: AirPluginManifest;
  downloads: number;      // npm download count
  rating: number;         // Average rating
  verified: boolean;      // Verified by air team
  publishedAt: string;    // ISO 8601
  updatedAt: string;      // Last updated
}
```

### Search

```bash
air plugin search postgres
air plugin search --category storage
air plugin search --tag database
```

### Install

```bash
npm install air-plugin-postgres
```

Then use in your server:

```typescript
import { defineServer } from '@airmcp-dev/core';
import { postgresPlugin } from 'air-plugin-postgres';

defineServer({
  use: [
    postgresPlugin({ connectionString: 'postgres://...' }),
  ],
  // ...
});
```

### Publish

```bash
# 1. Create air-plugin.json in your package root
# 2. Publish to npm
npm publish

# 3. Register with air plugin registry (optional)
air plugin publish --registry-key YOUR_KEY
```

## Example: building a complete plugin package

```
air-plugin-postgres/
├── src/
│   └── index.ts            # Plugin factory
├── air-plugin.json          # Plugin manifest
├── package.json
├── tsconfig.json
└── README.md
```

`src/index.ts`:

```typescript
import type { AirPlugin } from '@airmcp-dev/core';

interface PostgresOptions {
  connectionString: string;
  poolSize?: number;
}

export function postgresPlugin(options: PostgresOptions): AirPlugin {
  return {
    meta: {
      name: 'air-plugin-postgres',
      version: '1.0.0',
      description: 'PostgreSQL storage adapter',
    },
    hooks: {
      onInit: async (ctx) => {
        const pool = createPool(options.connectionString, options.poolSize || 10);
        ctx.state.db = pool;
        ctx.log('info', `PostgreSQL connected (pool: ${options.poolSize || 10})`);
      },
      onStop: async (ctx) => {
        await ctx.state.db?.close();
      },
    },
    tools: [
      {
        name: 'pg_query',
        description: 'Run a SQL query',
        params: {
          sql: { type: 'string', description: 'SQL query' },
        },
        handler: async ({ sql }, context) => {
          return context.state.db.query(sql);
        },
      },
    ],
  };
}
```
