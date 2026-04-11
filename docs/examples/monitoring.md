# Example: System Monitoring

Real-time server monitoring MCP server. Provides CPU, memory, disk, process info and anomaly detection with optional webhook alerts.

## Full code

```typescript
// src/index.ts
import {
  defineServer, defineTool, definePrompt, createStorage, onShutdown,
  cachePlugin, webhookPlugin, jsonLoggerPlugin,
} from '@airmcp-dev/core';
import { execSync } from 'node:child_process';
import os from 'node:os';

const store = await createStorage({ type: 'file', path: '.air/monitor' });
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK;

function getSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    return acc + ((total - cpu.times.idle) / total) * 100;
  }, 0) / cpus.length;

  return {
    hostname: os.hostname(), platform: os.platform(), uptime: Math.floor(os.uptime()),
    cpu: { model: cpus[0]?.model, cores: cpus.length, usagePercent: Math.round(cpuUsage * 10) / 10, loadAvg: os.loadavg() },
    memory: {
      totalMb: Math.round(totalMem / 1024 / 1024), usedMb: Math.round((totalMem - freeMem) / 1024 / 1024),
      freeMb: Math.round(freeMem / 1024 / 1024), usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10,
    },
    nodeVersion: process.version, pid: process.pid,
  };
}

function getDiskInfo() {
  try {
    const output = execSync("df -h --output=target,size,used,pcent 2>/dev/null || df -h", { encoding: 'utf-8', timeout: 5000 });
    return output.trim().split('\n').slice(1)
      .filter(l => l.startsWith('/'))
      .map(l => { const p = l.trim().split(/\s+/); return { mount: p[0], totalGb: parseFloat(p[1]) || 0, usedGb: parseFloat(p[2]) || 0, usagePercent: parseInt(p[p.length - 1]) || 0 }; })
      .slice(0, 5);
  } catch { return []; }
}

const plugins: any[] = [
  cachePlugin({ ttlMs: 5_000, exclude: ['monitor_alert', 'monitor_snapshot'] }),
  jsonLoggerPlugin({ output: 'stderr' }),
];
if (ALERT_WEBHOOK) plugins.push(webhookPlugin({ url: ALERT_WEBHOOK, events: ['tool.error', 'tool.slow'], slowThresholdMs: 10_000 }));

const server = defineServer({
  name: 'system-monitor', version: '1.0.0',
  transport: { type: 'sse', port: 3510 },
  use: plugins,

  tools: [
    defineTool('monitor_status', {
      description: 'Current system status (CPU, memory, disk)', layer: 1,
      handler: async () => ({ system: getSystemInfo(), disks: getDiskInfo() }),
    }),

    defineTool('monitor_process', {
      description: 'Top processes by CPU or memory', layer: 2,
      params: { sortBy: { type: 'string', description: '"cpu" or "memory"', optional: true }, limit: { type: 'number', optional: true } },
      handler: async ({ sortBy, limit }) => {
        try {
          const cmd = sortBy === 'memory' ? 'ps aux --sort=-%mem' : 'ps aux --sort=-%cpu';
          const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
          const lines = output.trim().split('\n');
          return { sortBy: sortBy || 'cpu', processes: lines.slice(1, (limit || 10) + 1).map(l => {
            const p = l.trim().split(/\s+/);
            return { user: p[0], pid: p[1], cpuPercent: parseFloat(p[2]), memPercent: parseFloat(p[3]), command: p.slice(10).join(' ').substring(0, 80) };
          }) };
        } catch { return { error: 'Could not get process list' }; }
      },
    }),

    defineTool('monitor_snapshot', {
      description: 'Save current state as a snapshot', layer: 1,
      handler: async () => {
        const snapshot = { ...getSystemInfo(), disks: getDiskInfo(), timestamp: new Date().toISOString() };
        await store.append('snapshots', snapshot);
        return { message: 'Snapshot saved', timestamp: snapshot.timestamp };
      },
    }),

    defineTool('monitor_history', {
      description: 'View saved snapshot history', layer: 2,
      params: { limit: { type: 'number', optional: true }, hours: { type: 'number', description: 'Last N hours', optional: true } },
      handler: async ({ limit, hours }) => {
        const since = new Date(Date.now() - (hours || 24) * 3600000);
        const snapshots = await store.query('snapshots', { limit: limit || 10, since });
        return { count: snapshots.length, snapshots: snapshots.map((s: any) => ({
          timestamp: s.timestamp, cpuUsage: s.cpu?.usagePercent, memUsage: s.memory?.usagePercent,
        })) };
      },
    }),

    defineTool('monitor_alert', {
      description: 'Check for threshold violations', layer: 4,
      params: {
        cpuThreshold: { type: 'number', optional: true },
        memThreshold: { type: 'number', optional: true },
        diskThreshold: { type: 'number', optional: true },
      },
      handler: async ({ cpuThreshold, memThreshold, diskThreshold }) => {
        const sys = getSystemInfo(); const disks = getDiskInfo(); const alerts: string[] = [];
        const cpuLimit = cpuThreshold || 80, memLimit = memThreshold || 85, diskLimit = diskThreshold || 90;
        if (sys.cpu.usagePercent > cpuLimit) alerts.push(`CPU ${sys.cpu.usagePercent}% > ${cpuLimit}%`);
        if (sys.memory.usagePercent > memLimit) alerts.push(`Memory ${sys.memory.usagePercent}% > ${memLimit}%`);
        for (const d of disks) if (d.usagePercent > diskLimit) alerts.push(`Disk ${d.mount} ${d.usagePercent}% > ${diskLimit}%`);
        if (alerts.length > 0) await store.append('alerts', { alerts, timestamp: new Date().toISOString() });
        return { status: alerts.length > 0 ? 'WARNING' : 'OK', alerts };
      },
    }),
  ],

  prompts: [
    definePrompt('daily_report', {
      description: 'Generate a daily system report',
      handler: () => [{ role: 'user', content: 'Generate a daily system report:\n1. Check current status with monitor_status\n2. Get 24h history with monitor_history\n3. Check alerts with monitor_alert\n4. Summarize findings and recommendations' }],
    }),
  ],
});

onShutdown(async () => { await store.close(); });
server.start();
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ALERT_WEBHOOK` | (none) | Slack/Discord webhook URL for error/slow alerts |

## Usage

- "Show current server status"
- "Top 5 processes by memory"
- "Take a snapshot"
- "Show snapshot history for last 12 hours"
- "Check alerts with CPU threshold 70%"
- Use `daily_report` prompt → AI combines status + history + alerts
