import { type FC, useState } from 'react';
import { useLanguage } from '@/hooks';
import { Section } from '@/components/ui';
import { copyToClipboard } from '@/utils';

const CODE_EXAMPLE = `import { defineServer, defineTool } from '@airmcp-dev/core';

const server = defineServer({
  name: 'my-api',
  version: '1.0.0',
  transport: { type: 'sse', port: 3510 },
  use: [
    retryPlugin({ maxRetries: 3 }),
    cachePlugin({ ttlMs: 60_000 }),
    authPlugin({ type: 'api-key', keys: [process.env.MCP_API_KEY!] }),
  ],
  tools: [
    defineTool('search', {
      description: 'Search documents',
      params: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', optional: true },
      },
      handler: async ({ query, limit = 10 }) => {
        return { results: [], total: 0 };
      },
    }),
  ],
});

server.start();`;

function highlightLine(line: string, idx: number): JSX.Element {
  // Simple keyword highlighting
  const highlighted = line
    .replace(/(import|from|const|async|return)/g, '<kw>$1</kw>')
    .replace(/('(?:[^'\\]|\\.)*')/g, '<str>$1</str>')
    .replace(/(\/\/.*)/g, '<cmt>$1</cmt>')
    .replace(/(defineServer|defineTool|retryPlugin|cachePlugin|authPlugin|process)/g, '<fn>$1</fn>')
    .replace(/(type|description|name|version|transport|use|tools|params|handler|query|limit|maxRetries|ttlMs|keys|port|optional|results|total)/g, 
             (match) => {
               // Only highlight if it appears as a key (before colon)
               return `<prop>${match}</prop>`;
             });

  return (
    <span
      key={idx}
      className="block"
      dangerouslySetInnerHTML={{
        __html: highlighted
          .replace(/<kw>/g, '<span class="text-violet-400">')
          .replace(/<\/kw>/g, '</span>')
          .replace(/<str>/g, '<span class="text-amber-300">')
          .replace(/<\/str>/g, '</span>')
          .replace(/<cmt>/g, '<span class="text-text-muted italic">')
          .replace(/<\/cmt>/g, '</span>')
          .replace(/<fn>/g, '<span class="text-air-400">')
          .replace(/<\/fn>/g, '</span>')
          .replace(/<prop>/g, '<span class="text-sky-300/80">')
          .replace(/<\/prop>/g, '</span>')
      }}
    />
  );
}

const CodeExample: FC = () => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const lines = CODE_EXAMPLE.split('\n');

  const handleCopy = async () => {
    await copyToClipboard(CODE_EXAMPLE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Section id="code-example" className="relative">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-radial from-air-500/[0.04] via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header area */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-air-500 font-mono text-sm mb-3 flex items-center gap-2">
              <i className="fa-solid fa-code text-xs" />
              {t('code.label')}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-text-primary tracking-tight mb-2">
              {t('code.title')}
            </h2>
            <p className="text-text-secondary text-base max-w-lg">{t('code.subtitle')}</p>
          </div>
          {/* Stats pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: 'fa-cube', label: '7 packages' },
              { icon: 'fa-puzzle-piece', label: '19 plugins' },
              { icon: 'fa-vial', label: '165 tests' },
            ].map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-text-muted font-mono">
                <i className={`fa-solid ${s.icon} text-air-500/50`} />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Code editor */}
        <div className="rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0a0a12] shadow-2xl shadow-black/40">
          {/* Title bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05] bg-white/[0.02]">
            <div className="flex items-center gap-3">
              {/* Traffic lights */}
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              </div>
              {/* Tab */}
              <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.04] rounded-md border border-white/[0.06]">
                <i className="fa-brands fa-js text-amber-400/60 text-xs" />
                <span className="text-xs font-mono text-text-secondary">server.ts</span>
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono
                         text-text-muted hover:text-air-400 hover:bg-white/[0.04]
                         transition-all duration-200"
            >
              <i className={`fa-solid ${copied ? 'fa-check text-air-500' : 'fa-copy'} text-[10px]`} />
              {copied ? 'copied' : 'copy'}
            </button>
          </div>

          {/* Code content */}
          <div className="overflow-x-auto">
            <pre className="px-5 py-5 font-mono text-[13px] leading-[1.7]">
              <code>
                {lines.map((line, i) => (
                  <span key={i} className="flex">
                    <span className="inline-block w-8 text-right mr-5 text-text-muted/30 select-none text-xs leading-[1.7]">
                      {i + 1}
                    </span>
                    {highlightLine(line, i)}
                  </span>
                ))}
              </code>
            </pre>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-5 py-2 border-t border-white/[0.04] bg-white/[0.01]">
            <div className="flex items-center gap-4 text-[10px] font-mono text-text-muted/40">
              <span>TypeScript</span>
              <span>UTF-8</span>
              <span>{lines.length} lines</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted/40">
              <span className="w-1.5 h-1.5 rounded-full bg-air-500/50" />
              air v0.1.3
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
};

export default CodeExample;
