# 배포

air MCP 서버를 배포하는 방법을 단계별로 설명합니다.

## 빌드

```bash
# TypeScript 컴파일
npx tsc

# 출력 확인
ls dist/
# index.js  index.d.ts  ...
```

## 로컬 실행

### stdio (Claude Desktop 직접 연결)

프로세스 관리가 필요 없습니다. Claude Desktop이 서버를 자식 프로세스로 시작하고 종료까지 관리합니다.

```bash
# Claude Desktop에 등록
npx @airmcp-dev/cli connect claude-desktop

# 끝. Claude Desktop을 재시작하면 자동으로 서버가 실행됩니다.
```

등록되는 설정:

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

### 개발 모드

```bash
# 기본 (stdio)
npx @airmcp-dev/cli dev

# SSE + 테스트 콘솔
npx @airmcp-dev/cli dev --console -p 3510

# HTTP
npx @airmcp-dev/cli dev --transport http -p 3510
```

핫 리로드 포함 — `src/` 파일 변경 시 자동 재시작.

### 직접 실행

빌드 후 node로 직접 실행:

```bash
# 기본 (auto detect)
node dist/index.js

# 트랜스포트 지정
MCP_TRANSPORT=sse PORT=3510 node dist/index.js
MCP_TRANSPORT=http PORT=3510 node dist/index.js
```

## 원격 배포 (SSE / HTTP)

원격 서버에서 실행할 때는 프로세스 관리자와 (선택적) 리버스 프록시가 필요합니다.

### PM2

```bash
npm install -g pm2

# 시작
pm2 start dist/index.js --name my-server \
  --env NODE_ENV=production \
  --env MCP_TRANSPORT=http \
  --env PORT=3510

# 시스템 시작 시 자동 실행
pm2 startup
pm2 save

# 상태 확인
pm2 status

# 로그
pm2 logs my-server

# 재시작
pm2 restart my-server

# 중지
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
# 빌드
docker build -t my-mcp-server .

# 실행
docker run -d -p 3510:3510 --name mcp my-mcp-server

# 환경변수 전달
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
# 서비스 등록
sudo cp my-mcp-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable my-mcp-server
sudo systemctl start my-mcp-server

# 상태 확인
sudo systemctl status my-mcp-server

# 로그
sudo journalctl -u my-mcp-server -f
```

## 클라우드 배포

### AWS (EC2 + Docker)

```bash
# EC2 인스턴스에 SSH 접속 후
sudo yum install -y docker   # Amazon Linux
sudo systemctl start docker

# 이미지 빌드 & 실행
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
# ECR에 이미지 push
aws ecr get-login-password | docker login --username AWS --password-stdin YOUR_ECR_URI
docker tag my-mcp-server:latest YOUR_ECR_URI/my-mcp-server:latest
docker push YOUR_ECR_URI/my-mcp-server:latest

# 서비스 생성
aws ecs create-service \
  --cluster my-cluster \
  --service-name mcp-server \
  --task-definition mcp-server \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### AWS (Lambda + API Gateway)

HTTP 트랜스포트로 Lambda에서 실행. 요청당 과금이므로 호출량이 적은 서버에 적합합니다.

```typescript
// lambda.ts
import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'lambda-server',
  transport: { type: 'http' },
  storage: { type: 'memory' },  // Lambda는 파일시스템이 임시이므로 memory 권장
  tools: [ /* ... */ ],
});

export const handler = async (event: any) => {
  return server.handleLambdaEvent(event);
};
```

::: warning
Lambda에서는 `FileStore`를 사용하면 `/tmp`에 저장되지만 인스턴스가 종료되면 소멸합니다. 영속 스토리지가 필요하면 DynamoDB나 S3를 직접 사용하세요.
:::

### Cloudflare Workers

[Cloudflare Workers 배포](/ko/guide/deploy-cloudflare) 가이드를 참고하세요.

## Nginx 리버스 프록시

### HTTP 트랜스포트

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

### SSE 트랜스포트

SSE는 장기 연결이므로 추가 설정이 필요합니다:

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
        proxy_read_timeout 86400;    # 24시간
        proxy_send_timeout 86400;
    }
}
```

::: tip
리버스 프록시 뒤에서는 `http` 트랜스포트를 권장합니다. SSE는 `proxy_read_timeout 86400` 등 별도 설정이 필요하고, 일부 CDN/프록시에서 SSE 연결이 예기치 않게 끊길 수 있습니다.
:::

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|-------|------|
| `NODE_ENV` | `development` | `production` 시 로깅이 JSON 형식으로 전환 |
| `PORT` | `3510` | HTTP/SSE 포트 (transport.port 대체) |
| `MCP_TRANSPORT` | (auto) | 트랜스포트 강제 지정: `stdio`, `sse`, `http` |
| `AIR_LOG_LEVEL` | `info` | 로그 레벨 오버라이드 |

## 상태 확인

HTTP/SSE 트랜스포트는 `GET /`으로 서버 상태를 확인할 수 있습니다:

```bash
curl http://localhost:3510/
```

응답:

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

## 프로덕션 체크리스트

- `npx tsc`로 빌드 확인 (타입 에러 없음)
- `NODE_ENV=production` 설정 (JSON 로깅 활성화)
- API 키는 환경변수로 관리 (코드에 하드코딩 금지)
- 프로세스 관리자(PM2, systemd, Docker) 사용
- HTTPS 리버스 프록시 설정 (원격 배포 시)
- `onShutdown`으로 DB 연결 등 정리 로직 등록
