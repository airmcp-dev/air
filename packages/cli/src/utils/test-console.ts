// air CLI — utils/test-console.ts
//
// 내장 인터랙티브 테스트 콘솔.
// air dev 실행 시 서버에 MCP 클라이언트로 연결하여
// 도구를 직접 호출하고 결과를 확인할 수 있다.
//
// 명령어:
//   tools          — 도구 목록
//   call <name> [key=value ...]  — 도구 호출
//   resources      — 리소스 목록
//   status         — 서버 상태
//   help           — 도움말
//   quit           — 종료

import { createInterface } from 'node:readline';
import { printer } from './printer.js';

interface TestConsoleOptions {
  serverUrl: string;
  onQuit: () => void;
}

/** 파라미터 파싱: "key=value key2=value2" → { key: value, key2: value2 } */
function parseArgs(tokens: string[]): Record<string, any> {
  const args: Record<string, any> = {};
  for (const token of tokens) {
    const eqIdx = token.indexOf('=');
    if (eqIdx === -1) continue;
    const key = token.slice(0, eqIdx);
    let value: any = token.slice(eqIdx + 1);

    // 숫자 변환
    if (/^\d+(\.\d+)?$/.test(value)) value = Number(value);
    // boolean
    else if (value === 'true') value = true;
    else if (value === 'false') value = false;
    // 따옴표 제거
    else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    args[key] = value;
  }
  return args;
}

/** SSE 클라이언트로 서버에 연결하여 테스트 콘솔 제공 */
export async function startTestConsole(options: TestConsoleOptions): Promise<void> {
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');

  let client: InstanceType<typeof Client> | null = null;

  // SSE 연결 시도 (서버가 준비될 때까지 재시도)
  async function connect(): Promise<boolean> {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const transport = new SSEClientTransport(new URL(`${options.serverUrl}/sse`));
        client = new Client({ name: 'air-dev-console', version: '1.0.0' });
        await client.connect(transport);
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    return false;
  }

  console.log('\n  \x1b[36mair dev console\x1b[0m — type "help" for commands\n');
  console.log('  Connecting to server...');

  const connected = await connect();
  if (!connected || !client) {
    console.log('  \x1b[31mCould not connect to server\x1b[0m');
    console.log('  Make sure the server is running with SSE transport.\n');
    return;
  }

  console.log('  \x1b[32mConnected!\x1b[0m\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '  \x1b[36mair>\x1b[0m ',
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    const [cmd, ...rest] = trimmed.split(/\s+/);

    try {
      switch (cmd) {
        case 'help':
        case 'h':
        case '?': {
          console.log(`
  \x1b[1mCommands:\x1b[0m
    tools                         List all tools
    call <name> [key=value ...]   Call a tool with arguments
    resources                     List resources
    prompts                       List prompts
    status                        Server status
    help                          Show this help
    quit                          Exit console
`);
          break;
        }

        case 'tools':
        case 't': {
          const result = await client!.listTools();
          console.log(`\n  Tools (${result.tools.length}):\n`);
          for (const tool of result.tools) {
            const params = tool.inputSchema?.properties
              ? Object.keys(tool.inputSchema.properties).join(', ')
              : 'none';
            console.log(`    \x1b[33m${tool.name}\x1b[0m (${params})`);
            if (tool.description) console.log(`      ${tool.description}`);
          }
          console.log();
          break;
        }

        case 'call':
        case 'c': {
          if (rest.length === 0) {
            console.log('  Usage: call <tool_name> [key=value ...]');
            break;
          }
          const toolName = rest[0];
          const args = parseArgs(rest.slice(1));

          console.log(`  → ${toolName}(${JSON.stringify(args)})`);
          const start = Date.now();

          const result = await client!.callTool({ name: toolName, arguments: args });
          const elapsed = Date.now() - start;

          const content = result.content as Array<{ type: string; text?: string }>;
          for (const item of content) {
            if (item.text) {
              console.log(`  \x1b[32m←\x1b[0m ${item.text} \x1b[90m(${elapsed}ms)\x1b[0m`);
            }
          }
          if ((result as any).isError) {
            console.log(`  \x1b[31mError response\x1b[0m`);
          }
          console.log();
          break;
        }

        case 'resources':
        case 'r': {
          const result = await client!.listResources();
          console.log(`\n  Resources (${result.resources.length}):\n`);
          for (const res of result.resources) {
            console.log(`    ${res.name}: ${res.uri}`);
          }
          console.log();
          break;
        }

        case 'prompts':
        case 'p': {
          const result = await client!.listPrompts();
          console.log(`\n  Prompts (${result.prompts.length}):\n`);
          for (const p of result.prompts) {
            console.log(`    ${p.name}: ${p.description || ''}`);
          }
          console.log();
          break;
        }

        case 'status':
        case 's': {
          try {
            const res = await fetch(options.serverUrl);
            const data = await res.json();
            console.log(`\n  Server Status:\n`);
            for (const [k, v] of Object.entries(data as Record<string, any>)) {
              console.log(`    ${k}: ${v}`);
            }
            console.log();
          } catch {
            console.log('  Could not fetch server status.\n');
          }
          break;
        }

        case 'quit':
        case 'q':
        case 'exit': {
          rl.close();
          if (client) await client.close();
          options.onQuit();
          return;
        }

        default:
          console.log(`  Unknown command: "${cmd}". Type "help" for available commands.\n`);
      }
    } catch (err: any) {
      console.log(`  \x1b[31m  ${err.message}\x1b[0m\n`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    if (client) client.close().catch(() => {});
  });
}
