import DefaultTheme from 'vitepress/theme';
import './custom.css';

if (typeof window !== 'undefined') {
  const banner = [
    '%c ✈ air %c MCP Server Framework %c',
    'background:#00d4aa;color:#fff;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px;',
    'background:#1a1a2e;color:#00d4aa;font-weight:bold;padding:4px 8px;border-radius:0 4px 4px 0;',
    '',
  ];

  const info = [
    '\n%cBuild MCP servers with TypeScript.\n' +
    '%c19 built-in plugins • stdio/SSE/HTTP • 7-Layer Meter\n\n' +
    '%c📖 Docs     %chttps://docs.airmcp.dev\n' +
    '%c💻 GitHub   %chttps://github.com/airmcp-dev/air\n' +
    '%c📦 npm      %chttps://www.npmjs.com/org/airmcp-dev\n\n' +
    '%c© CodePedia Labs — Apache-2.0',
    'color:#888;font-size:13px;',
    'color:#666;font-size:11px;',
    'color:#00d4aa;font-size:11px;font-weight:bold;',
    'color:#888;font-size:11px;',
    'color:#00d4aa;font-size:11px;font-weight:bold;',
    'color:#888;font-size:11px;',
    'color:#00d4aa;font-size:11px;font-weight:bold;',
    'color:#888;font-size:11px;',
    'color:#555;font-size:10px;',
  ];

  console.log(...banner);
  console.log(...info);
}

export default DefaultTheme;
