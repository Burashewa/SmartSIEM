import ReactMarkdown from 'react-markdown';

type DailyReportMarkdownProps = {
  markdown: string;
};

const AI_INSIGHTS_HEADING = '## 🤖 SmartSIEM AI Insights';

export function DailyReportMarkdown({ markdown }: DailyReportMarkdownProps) {
  const hasAiInsights = markdown.includes(AI_INSIGHTS_HEADING);

  return (
    <article
      className={`daily-report-markdown max-h-[32rem] overflow-y-auto rounded border border-[#2a2a3a] bg-[#0a0a0f] p-5 text-sm leading-relaxed text-gray-300 ${
        hasAiInsights ? 'daily-report-markdown--ai' : ''
      }`}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 text-xl font-semibold text-white border-b border-[#2a2a3a] pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => {
            const text = String(children);
            const isAi = text.includes('SmartSIEM AI Insights');
            return (
              <h2
                className={`mt-6 mb-3 text-base font-semibold ${
                  isAi
                    ? 'text-[#a5b4fc] border-l-2 border-[#4f46e5] pl-3'
                    : 'text-white'
                }`}
              >
                {children}
              </h2>
            );
          },
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 text-sm font-medium text-gray-200">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3 text-gray-300">{children}</p>,
          ul: ({ children }) => <ul className="mb-4 ml-4 list-disc space-y-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 ml-4 list-decimal space-y-1.5">{children}</ol>,
          li: ({ children }) => <li className="text-gray-300">{children}</li>,
          strong: ({ children }) => <strong className="font-medium text-gray-100">{children}</strong>,
          em: ({ children }) => <em className="text-gray-400">{children}</em>,
          code: ({ children }) => (
            <code className="rounded bg-[#1a1a24] px-1 py-0.5 font-mono text-xs text-[#c4b5fd]">
              {children}
            </code>
          ),
          hr: () => <hr className="my-6 border-[#2a2a3a]" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
