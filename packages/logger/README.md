# @airmcp-dev/logger

Structured logging for air MCP servers. JSON and pretty formats, file rotation, remote transport.

## Install

```bash
npm install @airmcp-dev/logger
```

## Quick Example

```typescript
import { createLogger } from '@airmcp-dev/logger';

const logger = createLogger({
  level: 'info',
  format: 'json',
  output: 'stderr',
});

logger.info('Server started', { port: 3510 });
logger.error('Connection failed', { error: 'ECONNREFUSED' });
```

## Features

- **JSON / Pretty** formats
- **File rotation** with size and date limits
- **Log levels** — debug, info, warn, error, silent
- **MCP-safe** — outputs to stderr (stdout reserved for MCP protocol)

## Documentation

Full docs: **[docs.airmcp.dev](https://docs.airmcp.dev)**

## License

Apache-2.0 — [GitHub](https://github.com/airmcp-dev/air)
