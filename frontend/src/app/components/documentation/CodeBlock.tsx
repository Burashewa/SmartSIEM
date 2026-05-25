import { CheckCircle, Copy } from 'lucide-react';

export function CodeBlock({
  code,
  language,
  id,
  copyCode,
  copiedCode,
}: {
  code: string;
  language: string;
  id: string;
  copyCode: (code: string, id: string) => void;
  copiedCode: string | null;
}) {
  return (
    <div className="relative rounded-xl bg-[#1a1a24] border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs text-gray-400">{language}</span>
        <button
          type="button"
          onClick={() => copyCode(code, id)}
          className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2 text-xs"
        >
          {copiedCode === id ? (
            <>
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto">
        <code className="text-gray-300">{code}</code>
      </pre>
    </div>
  );
}
