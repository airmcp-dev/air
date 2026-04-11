# 예제: 시스템 모니터링

서버 상태를 실시간으로 모니터링하는 MCP 서버. CPU, 메모리, 디스크, 프로세스 정보를 제공하고 이상 감지 시 알림을 보냅니다.

## 전체 코드

```typescript
// src/index.ts
import {
  defineServer, defineTool, definePrompt, createStorage, onShutdown,
  cachePlugin, webhookPlugin, jsonLoggerPlugin,
} from '@airmcp-dev/core';
import { execSync } from 'node:child_process';
import os from 'node:os';

const store = await createStorage({ type: 'file', path: '.air/monitor' });
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK;  // Slack/Discord 웹훅 URL (선택)

// 시스템 정보 수집
function getSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg();

  // CPU 사용률 계산
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0) / cpus.length;

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: Math.floor(os.uptime()),
    cpu: {
      model: cpus[0]?.model || 'unknown',
      cores: cpus.length,
      usagePercent: Math.round(cpuUsage * 10) / 10,
      loadAvg: { '1m': loadAvg[0], '5m': loadAvg[1], '15m': loadAvg[2] },
    },
    memory: {
      totalMb: Math.round(totalMem / 1024 / 1024),
      usedMb: Math.round(usedMem / 1024 / 1024),
      freeMb: Math.round(freeMem / 1024 / 1024),
      usagePercent: Math.round((usedMem / totalMem) * 1000) / 10,
    },
    nodeVersion: process.version,
    pid: process.pid,
  };
}

// 디스크 정보 (Linux/macOS)
function getDiskInfo(): Array<{ mount: string; totalGb: number; usedGb: number; usagePercent: number }> {
  try {
    const output = execSync("df -h --output=target,size,used,pcent 2>/dev/null || df -h", {
      encoding: 'utf-8',
      timeout: 5000,
    });
    const lines = output.trim().split('\n').slice(1);
    return lines
      .filter(line => line.startsWith('/'))
      .map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          mount: parts[0],
          totalGb: parseFloat(parts[1]) || 0,
          usedGb: parseFloat(parts[2]) || 0,
          usagePercent: parseInt(parts[parts.length - 1]) || 0,
        };
      })
      .slice(0, 5);
  } catch {
    return [{ mount: '/', totalGb: 0, usedGb: 0, usagePercent: 0 }];
  }
}

const plugins = [
  cachePlugin({ ttlMs: 5_000, exclude: ['monitor_alert', 'monitor_snapshot'] }),
  jsonLoggerPlugin({ output: 'stderr' }),
];

if (ALERT_WEBHOOK) {
  plugins.push(webhookPlugin({
    url: ALERT_WEBHOOK,
    events: ['tool.error', 'tool.slow'],
    slowThresholdMs: 10_000,
  }));
}

const server = defineServer({
  name: 'system-monitor',
  version: '1.0.0',
  description: '시스템 모니터링 MCP 서버',

  transport: { type: 'sse', port: 3510 },
  use: plugins,

  tools: [
    defineTool('monitor_status', {
      description: '현재 시스템 상태를 반환합니다 (CPU, 메모리, 디스크)',
      layer: 1,
      handler: async () => {
        const sys = getSystemInfo();
        const disks = getDiskInfo();
        return { system: sys, disks };
      },
    }),

    defineTool('monitor_process', {
      description: '실행 중인 프로세스 목록을 반환합니다 (CPU/메모리 사용량 기준 정렬)',
      layer: 2,
      params: {
        sortBy: { type: 'string', description: '"cpu" 또는 "memory" (기본: cpu)', optional: true },
        limit: { type: 'number', description: '최대 개수 (기본: 10)', optional: true },
      },
      handler: async ({ sortBy, limit }) => {
        try {
          const cmd = sortBy === 'memory'
            ? 'ps aux --sort=-%mem 2>/dev/null || ps aux'
            : 'ps aux --sort=-%cpu 2>/dev/null || ps aux';
          const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
          const lines = output.trim().split('\n');
          const header = lines[0];
          const processes = lines.slice(1, (limit || 10) + 1).map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              user: parts[0],
              pid: parts[1],
              cpuPercent: parseFloat(parts[2]) || 0,
              memPercent: parseFloat(parts[3]) || 0,
              command: parts.slice(10).join(' ').substring(0, 80),
            };
          });
          return { sortBy: sortBy || 'cpu', processes };
        } catch {
          return { error: '프로세스 목록을 가져올 수 없습니다' };
        }
      },
    }),

    defineTool('monitor_snapshot', {
      description: '현재 상태를 스냅샷으로 저장합니다',
      layer: 1,
      handler: async () => {
        const sys = getSystemInfo();
        const snapshot = {
          ...sys,
          disks: getDiskInfo(),
          timestamp: new Date().toISOString(),
        };
        await store.append('snapshots', snapshot);
        return { message: '스냅샷 저장됨', timestamp: snapshot.timestamp };
      },
    }),

    defineTool('monitor_history', {
      description: '저장된 스냅샷 이력을 조회합니다',
      layer: 2,
      params: {
        limit: { type: 'number', description: '최대 개수 (기본: 10)', optional: true },
        hours: { type: 'number', description: '최근 N시간 (기본: 24)', optional: true },
      },
      handler: async ({ limit, hours }) => {
        const since = new Date(Date.now() - (hours || 24) * 60 * 60 * 1000);
        const snapshots = await store.query('snapshots', {
          limit: limit || 10,
          since,
        });
        return {
          count: snapshots.length,
          period: `${hours || 24}시간`,
          snapshots: snapshots.map((s: any) => ({
            timestamp: s.timestamp,
            cpuUsage: s.cpu?.usagePercent,
            memUsage: s.memory?.usagePercent,
            uptime: s.uptime,
          })),
        };
      },
    }),

    defineTool('monitor_alert', {
      description: '임계값을 초과한 항목을 확인합니다',
      layer: 4,
      params: {
        cpuThreshold: { type: 'number', description: 'CPU 임계값 % (기본: 80)', optional: true },
        memThreshold: { type: 'number', description: '메모리 임계값 % (기본: 85)', optional: true },
        diskThreshold: { type: 'number', description: '디스크 임계값 % (기본: 90)', optional: true },
      },
      handler: async ({ cpuThreshold, memThreshold, diskThreshold }) => {
        const sys = getSystemInfo();
        const disks = getDiskInfo();
        const alerts: string[] = [];

        const cpuLimit = cpuThreshold || 80;
        const memLimit = memThreshold || 85;
        const diskLimit = diskThreshold || 90;

        if (sys.cpu.usagePercent > cpuLimit) {
          alerts.push(`CPU 사용률 ${sys.cpu.usagePercent}% > ${cpuLimit}%`);
        }
        if (sys.memory.usagePercent > memLimit) {
          alerts.push(`메모리 사용률 ${sys.memory.usagePercent}% > ${memLimit}%`);
        }
        for (const disk of disks) {
          if (disk.usagePercent > diskLimit) {
            alerts.push(`디스크 ${disk.mount} 사용률 ${disk.usagePercent}% > ${diskLimit}%`);
          }
        }

        const status = alerts.length > 0 ? 'WARNING' : 'OK';
        if (alerts.length > 0) {
          await store.append('alerts', { alerts, timestamp: new Date().toISOString() });
        }

        return { status, alerts, thresholds: { cpu: cpuLimit, memory: memLimit, disk: diskLimit } };
      },
    }),
  ],

  prompts: [
    definePrompt('daily_report', {
      description: '일일 시스템 리포트 생성을 위한 프롬프트',
      handler: () => [{
        role: 'user',
        content: `시스템 모니터링 일일 리포트를 작성해주세요.
1. monitor_status로 현재 상태를 확인하세요
2. monitor_history로 최근 24시간 이력을 조회하세요
3. monitor_alert로 이상 항목을 확인하세요
4. 결과를 요약하고 권장 사항을 제시하세요`,
      }],
    }),
  ],
});

onShutdown(async () => { await store.close(); });
server.start();
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|-------|------|
| `ALERT_WEBHOOK` | (없음) | Slack/Discord 웹훅 URL. 설정하면 에러/느린 호출 알림 |

## 사용 예시

- "현재 서버 상태 보여줘"
- "CPU 많이 쓰는 프로세스 상위 5개 보여줘"
- "현재 상태 스냅샷 찍어줘"
- "최근 12시간의 스냅샷 이력 보여줘"
- "CPU 70%, 메모리 80% 기준으로 알림 체크해줘"
- daily_report 프롬프트 사용 → AI가 자동으로 상태/이력/알림 조합

## 특징

- `cachePlugin` — 5초 캐시로 빈번한 상태 조회 부하 감소
- `webhookPlugin` — 에러 발생이나 10초 이상 느린 호출을 Slack에 알림
- `jsonLoggerPlugin` — 모든 호출을 JSON으로 기록 (ELK 연동 가능)
- `store.append` + `store.query` — 스냅샷과 알림 이력을 시계열 로그로 관리
- `definePrompt` — AI가 여러 도구를 조합하는 워크플로우를 프롬프트로 제공
