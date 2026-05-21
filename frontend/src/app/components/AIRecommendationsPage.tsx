import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import { listDailyReports, type DailyReportListItem } from '../api/reports';
import {
  sendReportAiChatMessage,
  type ReportAiChatHistoryItem,
  type ReportAiChatResponse,
} from '../api/reportAiChat';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const WELCOME_MESSAGE =
  'Ask general security and SIEM questions anytime. To discuss a specific daily report, choose one from the report context dropdown below.';

const generalPrompts = [
  'How should I triage high-severity alerts?',
  'What are best practices for responding to brute force attacks?',
  'Explain the difference between admin and developer security recommendations',
];

const reportPrompts = (dateLabel: string) => [
  `Summarize the ${dateLabel} security report`,
  'What should system administrators do first?',
  'What developer fixes are recommended?',
];

function formatReportDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AIRecommendationsPage() {
  const [reports, setReports] = useState<DailyReportListItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedReportDate, setSelectedReportDate] = useState<string>('');
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState(generalPrompts);
  const [contextReportDate, setContextReportDate] = useState<string | null>(null);
  const [hasReportContext, setHasReportContext] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const items = await listDailyReports();
      setReports(items);
    } catch {
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (selectedReportDate) {
      setSuggestedPrompts(reportPrompts(formatReportDate(selectedReportDate)));
    } else {
      setSuggestedPrompts(generalPrompts);
    }
  }, [selectedReportDate]);

  const chatHistory = useMemo<ReportAiChatHistoryItem[]>(
    () =>
      messages
        .filter((message) => message.id !== 'welcome')
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages],
  );

  const applyResponseMeta = (response: ReportAiChatResponse) => {
    setContextReportDate(response.reportDate);
    setHasReportContext(response.hasReportContext);
    if (response.suggestedPrompts.length > 0) {
      setSuggestedPrompts(response.suggestedPrompts);
    }
  };

  const sendMessage = async (value: string) => {
    const message = value.trim();
    if (!message || isSending) return;

    setInput('');
    setIsSending(true);
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', content: message },
    ]);

    try {
      const response = await sendReportAiChatMessage(message, {
        reportDate: selectedReportDate || undefined,
        history: chatHistory,
      });
      applyResponseMeta(response);
      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: response.answer },
      ]);
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : 'Unable to reach the AI assistant';
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: `${fallback}. Generate a report on the Reports page or check that GEMINI_API_KEY is set in SmartSIEM/.env.`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[32rem] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl text-white">AI Recommendations</h1>
          <p className="text-gray-400">
            General security guidance by default. Optionally attach a daily report for tailored answers.
          </p>
        </div>
        <div className="flex items-center gap-2 border border-[#4f46e5]/30 bg-[#4f46e5]/20 px-4 py-2">
          <Sparkles className="size-5 text-[#4f46e5]" />
          <span className="text-sm font-medium text-[#4f46e5]">Powered by Gemini</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="report-context" className="text-gray-400">
          Report context (optional)
        </label>
        <select
          id="report-context"
          value={selectedReportDate}
          onChange={(event) => setSelectedReportDate(event.target.value)}
          disabled={reportsLoading}
          className="min-w-[14rem] border border-[#2a2a3a] bg-[#1a1a24] px-3 py-2 text-white focus:border-[#4f46e5] focus:outline-none"
        >
          <option value="">General questions (no report)</option>
          {reports.map((report) => (
            <option key={report.date} value={report.date}>
              {formatReportDate(report.date)}
              {report.hasAiInsights ? ' · AI insights' : ''}
            </option>
          ))}
        </select>
        {selectedReportDate && contextReportDate && hasReportContext ? (
          <span className="text-[#10b981]">
            Using report {formatReportDate(contextReportDate)}
          </span>
        ) : selectedReportDate ? (
          <span className="text-[#f59e0b]">Report selected — will attach on next message</span>
        ) : (
          <span className="text-gray-500">General mode — no report attached</span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col border border-[#1f1f2e] bg-[#0f0f17]">
        <div className="flex h-14 items-center gap-3 border-b border-[#1f1f2e] px-4">
          <div className="flex size-9 items-center justify-center bg-[#4f46e5]">
            <Bot className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-white">Security Report Assistant</h2>
            <p className="text-xs text-gray-400">
              {selectedReportDate
                ? `Gemini · report ${formatReportDate(selectedReportDate)}`
                : 'Gemini · general mode'}
            </p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] border px-4 py-3 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'border-[#4f46e5] bg-[#4f46e5] text-white'
                    : 'border-[#252536] bg-[#15151f] text-gray-200'
                }`}
              >
                <div className="whitespace-pre-line">{message.content}</div>
              </div>
            </div>
          ))}
          {isSending ? (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 border border-[#252536] bg-[#15151f] px-4 py-3 text-sm text-gray-300">
                <Loader2 className="size-4 animate-spin" />
                Gemini is thinking…
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[#1f1f2e] px-4 py-3">
          {suggestedPrompts.slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => void sendMessage(prompt)}
              disabled={isSending}
              className="border border-[#2a2a3a] bg-[#15151f] px-3 py-1.5 text-xs text-gray-300 hover:border-[#4f46e5] hover:text-white disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-[#1f1f2e] p-4">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a general security question, or select a report for specific guidance…"
            className="min-w-0 flex-1 border border-[#2a2a3a] bg-[#0a0a0f] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-[#4f46e5] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="flex size-10 items-center justify-center bg-[#4f46e5] text-white hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
