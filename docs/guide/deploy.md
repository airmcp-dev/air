# Deploy

Step-by-step guide to deploying air MCP servers.

## Build

```bash
# Compile TypeScript
npx tsc

# Check output
ls dist/
# index.js  index.d.ts  ...
```

## Local execution

### stdio (Claude Desktop direct connection)

No process management needed. Claude Desktop starts and stops the server as a child process.

```bash
# Register with Claude Desktop
npx @airmcp-dev/cli connect claude-desktop

# Done. Restart Claude Desktop and the server runs automatically.
```

Generated config:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["tsx", "/path/to/my-server/src/index.ts"]
    }
  }
}
```

### Development mode

```bash
# Default (stdio)
npx @airmcp-dev/cli dev

# SSE + test console
npx @airmcp-dev/cli dev --console -p 3510

# HTTP
npx @airmcp-dev/cli dev --transport http -p 3510
```

Includes hot reload — auto-restarts on `src/` file changes.

### Direct execution

Run with node after build:

```bash
# Default (auto detect)
node dist/index.js

# Specify transport
MCP_TRANSPORT=sse PORT=3510 node dist/index.js
MCP_TRANSPORT=http PORT=3510 node dist/index.js
```

## Remote deployment (SSE / HTTP)

Remote servers need a process manager and (optionally) a reverse proxy.

### PM2

```bash
npm install -g pm2

# Start
pm2 start dist/index.js --name my-server \
  --env NODE_ENV=production \
  --env MCP_TRANSPORT=http \
  --env PORT=3510

# Auto-start on system boot
pm2 startup
pm2 save

# Status / logs / restart / stop
pm2 status
pm2 logs my-server
pm2 restart my-server
pm2 stop my-server
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ dist/

ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV PORT=3510

EXPOSE 3510
CMD ["node", "dist/index.js"]
```

```bash
docker build -t my-mcp-server .
docker run -d -p 3510:3510 --name mcp my-mcp-server

# Pass environment variables
docker run -d -p 3510:3510 \
  -e MCP_API_KEY=your-key \
  --name mcp my-mcp-server
```

### systemd

```ini
[Unit]
Description=My MCP Server
After=network.target

[Service]
Type=simple
User=mcp
WorkingDirectory=/opt/my-server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=MCP_TRANSPORT=http
Environment=PORT=3510

[Install]
WantedBy=multi-user.target
```

```bash
sudo cp my-mcp-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-mcp-server
sudo systemctl start my-mcp-server

# Status / logs
sudo systemctl status my-mcp-server
sudo journalctl -u my-mcp-server -f
```

## Cloud deployment

### AWS (EC2 + Docker)

```bash
# SSH into EC2 instance
sudo yum install -y docker   # Amazon Linux
sudo systemctl start docker

# Build & run
docker build -t my-mcp-server .
docker run -d -p 3510:3510 \
  -e NODE_ENV=production \
  -e MCP_TRANSPORT=http \
  -e MCP_API_KEY=$MCP_API_KEY \
  --restart unless-stopped \
  --name mcp my-mcp-server
```

### AWS (ECS Fargate)

`task-definition.json`:

```json
{
  "family": "mcp-server",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [{
    "name": "mcp",
    "image": "YOUR_ECR_URI/my-mcp-server:latest",
    "portMappings": [{ "containerPort": 3510 }],
    "environment": [
      { "name": "NODE_ENV", "value": "production" },
      { "name": "MCP_TRANSPORT", "value": "http" },
      { "name": "PORT", "value": "3510" }
    ],
    "secrets": [
      { "name": "MCP_API_KEY", "valueFrom": "arn:aws:ssm:REGION:ACCOUNT:parameter/mcp-api-key" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/mcp-server",
        "awslogs-region": "ap-northeast-2",
        "awslogs-stream-prefix": "mcp"
      }
    }
  }]
}
```

```bash
# Push image to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin YOUR_ECR_URI
docker tag my-mcp-server:latest YOUR_ECR_URI/my-mcp-server:latest
docker push YOUR_ECR_URI/my-mcp-server:latest

# Create service
aws ecs create-service \
  --cluster my-cluster \
  --service-name mcp-server \
  --task-definition mcp-server \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### AWS (Lambda + API Gateway)

Run on Lambda via HTTP transport. Pay-per-request pricing makes this ideal for low-traffic servers.

```typescript
// lambda.ts
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'lambda-server',
  transport: { type: 'http' },
  storage: { type: 'memory' },  // Lambda's filesystem is ephemeral — use memory
  tools: [ /* ... */ ],
});

export const handler = async (event: any) => {
  // API Gateway → Lambda proxy integration
  return server.handleLambdaEvent(event);
};
```

::: warning
`FileStore` on Lambda writes to `/tmp`, but data is lost when the instance shuts down. For persistent storage, use DynamoDB or S3 directly.
:::

### Cloudflare Workers

See the [Cloudflare Workers deployment](/guide/deploy-cloudflare) guide.

## Nginx reverse proxy

### HTTP transport

```nginx
server {
    listen 443 ssl;
    server_name mcp.example.com;

    ssl_certificate /etc/ssl/certs/mcp.crt;
    ssl_certificate_key /etc/ssl/private/mcp.key;

    location / {
        proxy_pass http://127.0.0.1:3510;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### SSE transport

SSE requires long-lived connection settings:

```nginx
server {
    listen 443 ssl;
    server_name mcp.example.com;

    location / {
        proxy_pass http://127.0.0.1:3510;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;    # 24 hours
        proxy_send_timeout 86400;
    }
}
```

::: tip
Use `http` transport behind reverse proxies. SSE needs extra config (`proxy_read_timeout 86400`) and some CDNs/proxies may drop SSE connections unexpectedly.
:::

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `production` switches logging to JSON |
| `PORT` | `3510` | HTTP/SSE port (overrides transport.port) |
| `MCP_TRANSPORT` | (auto) | Force transport: `stdio`, `sse`, `http` |
| `AIR_LOG_LEVEL` | `info` | Log level override |

## Health check

HTTP/SSE transports expose server status via `GET /`:

```bash
curl http://localhost:3510/
```

Response:

```json
{
  "name": "my-server",
  "version": "1.0.0",
  "state": "running",
  "uptime": 86400000,
  "toolCount": 5,
  "resourceCount": 0,
  "transport": "http"
}
```

## Production checklist

- Build with `npx tsc` (no type errors)
- Set `NODE_ENV=production` (enables JSON logging)
- Manage API keys via environment variables (never hardcode)
- Use a process manager (PM2, systemd, Docker)
- Set up HTTPS reverse proxy (for remote deployments)
- Register cleanup logic with `onShutdown` (DB connections, etc.)
