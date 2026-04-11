import { type FC, useState } from 'react';
import { useLanguage } from '@/hooks';
import { FadeIn, CodeBlock } from '@/components/common';
import { GITHUB_URL } from '@/constants';

const SIDEBAR = [
  { id: 'quickstart', icon: 'fa-rocket' },
  { id: 'server', icon: 'fa-cube' },
  { id: 'plugins', icon: 'fa-puzzle-piece' },
  { id: 'security', icon: 'fa-shield-halved' },
  { id: 'cli', icon: 'fa-terminal' },
  { id: 'transport', icon: 'fa-right-left' },
  { id: 'storage', icon: 'fa-hard-drive' },
  { id: 'packages', icon: 'fa-boxes-stacked' },
] as const;

const CODE_QUICKSTART = `npx @airmcp-dev/cli create my-server
cd my-server
npm install
npx @airmcp-dev/cli dev --console -p 3510`;

const CODE_SERVER = `import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-server',
  version: '0.1.0',
  transport: { type: 'sse', port: 3510 },
  tools: [
    defineTool('greet', {
      description: 'Say hello',
      params: {
        name: { type: 'string', description: 'Name' },
      },
      handler: async ({ name }) => \`Hello, \${name}!\`,
    }),
  ],
});

server.start();`;

const CODE_PLUGINS = `import {
  defineServer,
  timeoutPlugin,
  retryPlugin,
  cachePlugin,
  authPlugin,
} from '@airmcp-dev/core';

defineServer({
  name: 'my-server',
  use: [
    timeoutPlugin(10_000),
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
    authPlugin({ type: 'api-key', keys: ['sk-xxx'] }),
  ],
  tools: [ ... ],
});`;

const CODE_SECURITY = `defineServer({
  shield: {
    enabled: true,
    policies: [
      { name: 'block-admin', target: 'admin_*', action: 'deny', priority: 10 },
    ],
    threatDetection: true,
    rateLimit: {
      perTool: { search: { maxCalls: 100, windowMs: 60_000 } },
    },
    audit: true,
  },
  meter: { classify: true, trackCalls: true },
});`;

const CODE_TRANSPORT = `// stdio -- Claude Desktop direct
transport: { type: 'stdio' }

// SSE -- remote connection
transport: { type: 'sse', port: 3510 }

// Streamable HTTP
transport: { type: 'http', port: 3510 }`;

const CODE_STORAGE = `import { MemoryStore, FileStore, createStorage } from '@airmcp-dev/core';

// Memory (default)
const store = new MemoryStore();

// File-based (JSON + append-only logs)
const store = new FileStore('.air/data');

// Factory
const store = await createStorage({ type: 'file', path: '.air/data' });`;

const CLI_COMMANDS = [
  { cmd: 'create <name>', desc: 'doc.cli.create' },
  { cmd: 'add tool <name>', desc: 'doc.cli.add' },
  { cmd: 'dev [--console]', desc: 'doc.cli.dev' },
  { cmd: 'start', desc: 'doc.cli.start' },
  { cmd: 'stop', desc: 'doc.cli.stop' },
  { cmd: 'status', desc: 'doc.cli.status' },
  { cmd: 'list', desc: 'doc.cli.list' },
  { cmd: 'inspect <tool>', desc: 'doc.cli.inspect' },
  { cmd: 'connect <client>', desc: 'doc.cli.connect' },
  { cmd: 'disconnect <client>', desc: 'doc.cli.disconnect' },
  { cmd: 'check', desc: 'doc.cli.check' },
];

const PLUGIN_LIST = [
  { cat: 'Stability', items: 'timeoutPlugin, retryPlugin, circuitBreakerPlugin, fallbackPlugin' },
  { cat: 'Performance', items: 'cachePlugin, dedupPlugin, queuePlugin' },
  { cat: 'Security', items: 'authPlugin, sanitizerPlugin, validatorPlugin' },
  { cat: 'Network', items: 'corsPlugin, webhookPlugin' },
  { cat: 'Data', items: 'transformPlugin, i18nPlugin' },
  { cat: 'Monitoring', items: 'jsonLoggerPlugin, perUserRateLimitPlugin' },
  { cat: 'Dev/Test', items: 'dryrunPlugin' },
];

const PACKAGES_TABLE = [
  { name: '@airmcp-dev/core', license: 'Apache-2.0', desc: 'doc.pkg.core' },
  { name: '@airmcp-dev/cli', license: 'Apache-2.0', desc: 'doc.pkg.cli' },
  { name: '@airmcp-dev/gateway', license: 'Apache-2.0', desc: 'doc.pkg.gateway' },
  { name: '@airmcp-dev/logger', license: 'Apache-2.0', desc: 'doc.pkg.logger' },
  { name: '@airmcp-dev/meter', license: 'Apache-2.0', desc: 'doc.pkg.meter' },
  { name: '@airmcp-dev/shield', license: 'Commercial', desc: 'doc.pkg.shield' },
  { name: '@airmcp-dev/hive', license: 'Commercial', desc: 'doc.pkg.hive' },
];

const Docs: FC = () => {
  const { t } = useLanguage();
  const [active, setActive] = useState('quickstart');

  const scrollTo = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex">
      {/* Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-16 bottom-0 w-56 border-r border-white/[0.04] overflow-y-auto py-8 px-4">
        <nav className="space-y-1">
          {SIDEBAR.map(({ id, icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition-colors duration-200
                ${active === id ? 'text-air-400 bg-air-500/[0.06]' : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.03]'}`}
            >
              <i className={`fa-solid ${icon} text-[10px] w-4 text-center`} />
              {t(`doc.nav.${id}`)}
            </button>
          ))}
        </nav>
        <div className="mt-6 pt-4 border-t border-white/[0.04]">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-2 px-3 py-2 text-[12px] text-text-muted hover:text-text-secondary transition-colors">
            <i className="fa-brands fa-github text-xs" /> GitHub
            <i className="fa-solid fa-arrow-up-right-from-square text-[8px] ml-auto text-text-muted/30" />
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-56 pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-6 sm:px-10">

          {/* Header */}
          <FadeIn>
            <p className="font-mono text-[11px] text-text-muted tracking-wider uppercase mb-4">Documentation</p>
            <h1 className="font-display text-[1.5rem] sm:text-[1.8rem] font-extrabold text-text-primary tracking-tight mb-3">
              {t('doc.title')}
            </h1>
            <p className="text-text-secondary text-sm leading-relaxed mb-12">{t('doc.subtitle')}</p>
          </FadeIn>

          {/* Quick Start */}
          <section id="quickstart" className="mb-16 scroll-mt-24">
            <FadeIn>
              <h2 className="font-display text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                <i className="fa-solid fa-rocket text-air-500/50 text-sm" />
                {t('doc.nav.quickstart')}
              </h2>
              <p className="text-text-secondary text-sm mb-4">{t('doc.qs.desc')}</p>
              <CodeBlock code={CODE_QUICKSTART} language="bash" filename="terminal" />
            </FadeIn>
          </section>

          {/* Server */}
          <section id="server" className="mb-16 scroll-mt-24">
            <FadeIn>
              <h2 className="font-display text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                <i className="fa-solid fa-cube text-air-500/50 text-sm" />
                {t('doc.nav.server')}
              </h2>
              <p className="text-text-secondary text-sm mb-4">{t('doc.server.desc')}</p>
              <CodeBlock code={CODE_SERVER} language="typescript" filename="server.ts" />
            </FadeIn>
          </section>

          {/* Plugins */}
          <section id="plugins" className="mb-16 scroll-mt-24">
            <FadeIn>
              <h2 className="font-display text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                <i className="fa-solid fa-puzzle-piece text-air-500/50 text-sm" />
                {t('doc.nav.plugins')}
              </h2>
              <p className="text-text-secondary text-sm mb-4">{t('doc.plugins.desc')}</p>
              <CodeBlock code={CODE_PLUGINS} language="typescript" filename="server.ts" />

              <div className="mt-6 rounded-xl border border-white/[0.04] overflow-hidden">
                {PLUGIN_LIST.map(({ cat, items }, i) => (
                  <div key={cat} className={`flex gap-4 px-4 py-2.5 text-[13px] ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                    <span className="text-air-400/70 font-medium w-24 flex-shrink-0">{cat}</span>
                    <span className="text-text-muted font-mono text-[12px]">{items}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          </section>

          {/* Security */}
          <section id="security" className="mb-16 scroll-mt-24">
            <FadeIn>
              <h2 className="font-display text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-air-500/50 text-sm" />
                {t('doc.nav.security')}
              </h2>
              <p className="text-text-secondary text-sm mb-4">{t('doc.security.desc2')}</p>
              <CodeBlock code={CODE_SECURITY} language="typescript" filename="server.ts" />
              <p className="text-text-muted text-[12px] mt-3 font-mono">
                {t('doc.security.note')}
              </p>
            </FadeIn>
          </section>

          {/* CLI */}
          <section id="cli" className="mb-16 scroll-mt-24">
            <FadeIn>
              <h2 className="font-display text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                <i className="fa-solid fa-terminal text-air-500/50 text-sm" />
                {t('doc.nav.cli')}
              </h2>
              <p className="text-text-secondary text-sm mb-4">{t('doc.cli.desc2')}</p>

              <div className="rounded-xl border border-white/[0.04] overflow-hidden">
                {CLI_COMMANDS.map(({ cmd, desc }, i) => (
                  <div key={cmd} className={`flex items-start gap-4 px-4 py-2.5 ${i % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                    <code className="font-mono text-[12px] text-air-400/80 w-48 flex-shrink-0">airmcp-dev {cmd}</code>
                    <span className="text-text-muted text-[12px]">{t(desc)}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          </section>

          {/* Transport */}
          <section id="transport" className="mb-16 scroll-mt-24">
            <FadeIn>
              <h2 className="font-display text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                <i className="fa-solid fa-right-left text-air-500/50 text-sm" />
                {t('doc.nav.transport')}
              </h2>
              <p className="text-text-secondary text-sm mb-4">{t('doc.transport.desc2')}</p>
              <CodeBlock code={CODE_TRANSPORT} language="typescript" filename="server.ts" />
            </FadeIn>
          </section>

          {/* Storage */}
          <section id="storage" className="mb-16 scroll-mt-24">
            <FadeIn>
              <h2 className="font-display text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                <i className="fa-solid fa-hard-drive text-air-500/50 text-sm" />
                {t('doc.nav.storage')}
              </h2>
              <p className="text-text-secondary text-sm mb-4">{t('doc.storage.desc')}</p>
              <CodeBlock code={CODE_STORAGE} language="typescript" filename="storage.ts" />
            </FadeIn>
          </section>

          {/* Packages */}
          <section id="packages" className="mb-16 scroll-mt-24">
            <FadeIn>
              <h2 className="font-display text-lg font-bold text-text-primary mb-2 flex items-center gap-2">
                <i className="fa-solid fa-boxes-stacked text-air-500/50 text-sm" />
                {t('doc.nav.packages')}
              </h2>
              <div className="mt-4 rounded-xl border border-white/[0.04] overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_2fr] gap-0 bg-white/[0.02] px-4 py-2.5 border-b border-white/[0.04]">
                  <span className="font-mono text-[10px] text-text-muted/40 uppercase">Package</span>
                  <span className="font-mono text-[10px] text-text-muted/40 uppercase px-4">License</span>
                  <span className="font-mono text-[10px] text-text-muted/40 uppercase">Description</span>
                </div>
                {PACKAGES_TABLE.map(({ name, license, desc }, i) => (
                  <div key={name} className={`grid grid-cols-[1fr_auto_2fr] gap-0 px-4 py-2.5 items-center
                    ${i % 2 === 0 ? '' : 'bg-white/[0.015]'} border-b border-white/[0.03]`}>
                    <span className="font-mono text-[12px] text-air-400/80">{name}</span>
                    <span className={`font-mono text-[10px] px-4 ${license === 'Apache-2.0' ? 'text-air-500/50' : 'text-amber-400/50'}`}>{license}</span>
                    <span className="text-text-muted text-[12px]">{t(desc)}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          </section>

        </div>
      </main>
    </div>
  );
};

export default Docs;
