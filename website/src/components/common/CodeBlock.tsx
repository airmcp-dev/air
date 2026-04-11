import { type FC, useState } from 'react';
import { copyToClipboard } from '@/utils';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

const CodeBlock: FC<CodeBlockProps> = ({ code, language = 'typescript', filename }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block group relative">
      {filename && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-surface-3">
          <span className="text-xs text-text-muted font-mono">{filename}</span>
          <span className="text-xs text-text-muted/60 font-mono">{language}</span>
        </div>
      )}
      <div className="relative">
        <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
          <code className="text-text-secondary">{code}</code>
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 px-2 py-1 text-xs font-mono text-text-muted 
                     bg-surface-3/80 rounded border border-surface-4 
                     opacity-0 group-hover:opacity-100 transition-opacity duration-200
                     hover:text-air-500 hover:border-air-500/40"
        >
          {copied ? 'copied!' : 'copy'}
        </button>
      </div>
    </div>
  );
};

export default CodeBlock;
