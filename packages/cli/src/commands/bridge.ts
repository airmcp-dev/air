// air CLI — commands/bridge.ts
//
// air bridge --gateway <url> [--gateway <url> ...] [--token <t>]
//
// stdio MCP 서버로 동작하며 요청을 게이트웨이로 전달한다. 게이트웨이를 여러 개 주면
// 현재 것이 죽었을 때 다음으로 넘어가고, 우선순위가 높은 것이 복구되면 되돌아간다.
// Claude Desktop·Cursor처럼 주소 하나만 받는 클라이언트에 게이트웨이 HA를 붙이는 용도.
//
// @example
//   air bridge --gateway http://gw1:4000 --gateway http://gw2:4000 --token $TOKEN
//   air connect claude-desktop --gateway http://gw1:4000 --gateway http://gw2:4000

import { Command } from 'commander';
import { GatewayBridge } from '../utils/bridge.js';

export const bridgeCommand = new Command('bridge')
  .description('Run a stdio MCP bridge to one or more gateways (client-side failover)')
  .requiredOption('-g, --gateway <url...>', 'Gateway base URL (repeat for failover order)')
  .option('--token <token>', 'Bearer token sent to the gateway')
  .option('--timeout <ms>', 'Per-request timeout in ms', '60000')
  .option('--failback-probe <ms>', 'How often to probe higher-priority gateways for failback', '10000')
  .action((opts: { gateway: string[]; token?: string; timeout: string; failbackProbe: string }) => {
    // stdout은 MCP 전용 — 로그는 stderr
    const bridge = new GatewayBridge(
      {
        gateways: opts.gateway,
        token: opts.token,
        timeoutMs: Number(opts.timeout),
        failbackProbeMs: Number(opts.failbackProbe),
      },
      process.stdin,
      process.stdout,
    );
    process.stderr.write(`[air:bridge] gateways: ${opts.gateway.join(', ')}\n`);
    bridge.start();
    process.stdin.resume();
  });
