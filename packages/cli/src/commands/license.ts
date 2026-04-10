// air CLI — commands/license.ts
//
// air license --machine-id     머신 ID 출력 (라이선스 발급 시 필요)
// air license --status         현재 라이선스 상태 확인
// air license --activate <f>   라이선스 파일 활성화

import { Command } from 'commander';
import { createHash } from 'node:crypto';
import { hostname, cpus, networkInterfaces, platform, arch } from 'node:os';
import { readFile } from 'node:fs/promises';
import { printer } from '../utils/printer.js';

function generateMachineId(): string {
  const parts: string[] = [];
  const cpu = cpus();
  if (cpu.length > 0) parts.push(cpu[0].model);
  parts.push(`${cpu.length}cores`);
  parts.push(hostname());
  parts.push(`${platform()}-${arch()}`);
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (!net.internal && net.mac !== '00:00:00:00:00:00') {
        parts.push(net.mac);
        break;
      }
    }
    if (parts.length > 4) break;
  }
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

export const licenseCommand = new Command('license')
  .description('Manage enterprise license')
  .option('--machine-id', 'Show machine ID for license binding')
  .option('--status', 'Show current license status')
  .option('--activate <file>', 'Activate license from file')
  .action(async (opts: { machineId?: boolean; status?: boolean; activate?: string }) => {
    printer.blank();

    if (opts.machineId) {
      const id = generateMachineId();
      printer.kv('Machine ID', id);
      printer.blank();
      printer.info('Send this ID when purchasing an enterprise license.');
      printer.info('https://airmcp.dev/pricing');
      printer.blank();
      return;
    }

    if (opts.status) {
      const paths = [
        process.env.AIR_LICENSE_FILE,
        process.env.AIR_LICENSE_KEY,
        '.air/license.json',
      ].filter(Boolean);

      let found = false;
      for (const p of paths) {
        try {
          const raw = p!.startsWith('{') ? p! : await readFile(p!, 'utf-8');
          const key = JSON.parse(raw!);
          const now = Date.now();
          const until = new Date(key.validUntil).getTime();
          const days = Math.ceil((until - now) / 86_400_000);

          printer.kv('License ID', key.id);
          printer.kv('Organization', key.organization);
          printer.kv('Product', key.product);
          printer.kv('Valid Until', key.validUntil);
          printer.kv('Days Left', days > 0 ? `${days}` : 'EXPIRED');
          printer.kv('Max Servers', `${key.maxServers}`);
          printer.kv('Features', key.features.join(', ') || 'all');
          if (key.machineId) printer.kv('Bound To', key.machineId.slice(0, 8) + '...');
          found = true;
          break;
        } catch {
          continue;
        }
      }

      if (!found) {
        printer.info('No license found.');
        printer.blank();
        printer.info('Set AIR_LICENSE_KEY or place .air/license.json');
        printer.info('Purchase: https://airmcp.dev/pricing');
      }
      printer.blank();
      return;
    }

    if (opts.activate) {
      try {
        const raw = await readFile(opts.activate, 'utf-8');
        const key = JSON.parse(raw);
        const { mkdir, writeFile } = await import('node:fs/promises');
        await mkdir('.air', { recursive: true });
        await writeFile('.air/license.json', JSON.stringify(key, null, 2));
        printer.success(`License activated: ${key.id}`);
        printer.kv('Organization', key.organization);
        printer.kv('Product', key.product);
        printer.kv('Valid Until', key.validUntil);
      } catch (err: any) {
        printer.error(`Failed to activate: ${err.message}`);
      }
      printer.blank();
      return;
    }

    // 기본: help
    printer.info('Usage:');
    printer.blank();
    printer.info('  air license --machine-id     Show machine ID');
    printer.info('  air license --status         Show license status');
    printer.info('  air license --activate <f>   Activate from file');
    printer.blank();
  });
