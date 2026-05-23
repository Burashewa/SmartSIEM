import { useMemo, useState, type FormEvent } from 'react';
import { Bot, Loader2, MessageSquare, Send, ShieldAlert, X } from 'lucide-react';
import {
  sendAlertAssistantMessage,
  type AlertAssistantResponse,
} from '../api/alertAssistant';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  matchedAlert?: AlertAssistantResponse['matchedAlert'];
  prompts?: string[];
}

const starterPrompts = [
  'Which alert should I handle first?',
  'Show me critical alert recommendations',
  'How should I triage open alerts?',
];

export function AlertRecommendationChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Ask me about alert triage, containment, or the next recommended response. I use the current SIEM alerts and built-in recommendation rules.',
      prompts: starterPrompts,
    },
  ]);

  const latestAssistantPrompts = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    return lastAssistant?.prompts ?? starterPrompts;
  }, [messages]);

  const sendMessage = async (value: string) => {
    const message = value.trim();
    if (!message || isSending) return;

    setInput('');
    setIsSending(true);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
    };
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await sendAlertAssistantMessage(message);
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        matchedAlert: response.matchedAlert,
        prompts: response.suggestedPrompts,
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'Unable to reach alert assistant';
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: `${fallback}. Check that the backend is running and try again.`,
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
    <div className="fixed bottom-5 right-5 z-40">
      {isOpen ? (
        <div className="w-[min(28rem,calc(100vw-2.5rem))] h-[min(42rem,calc(100vh-2.5rem))] bg-[#0f0f17] border border-[#2a2a3a] shadow-2xl flex flex-col">
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#1f1f2e]">
            <div className="flex items-center gap-3">
              <div className="size-9 bg-[#4f46e5] flex items-center justify-center">
                <Bot className="size-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-white">Alert Recommendation Assistant</h2>
                <p className="text-xs text-gray-400">Free local rule-based chatbot</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1a1a24]"
              aria-label="Close alert assistant"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] border px-4 py-3 text-sm ${
                    message.role === 'user'
                      ? 'bg-[#4f46e5] border-[#4f46e5] text-white'
                      : 'bg-[#15151f] border-[#252536] text-gray-200'
                  }`}
                >
                  {message.matchedAlert ? (
                    <div className="mb-3 flex items-center gap-2 text-xs text-[#fbbf24]">
                      <ShieldAlert className="size-4" />
                      <span>
                        {message.matchedAlert.severity.toUpperCase()} · {message.matchedAlert.title}
                      </span>
                    </div>
                  ) : null}
                  <div className="whitespace-pre-line leading-relaxed">{message.content}</div>
                </div>
              </div>
            ))}
            {isSending ? (
              <div className="flex justify-start">
                <div className="bg-[#15151f] border border-[#252536] px-4 py-3 text-sm text-gray-300 flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Checking alerts
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {latestAssistantPrompts.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void sendMessage(prompt)}
                className="border border-[#2a2a3a] bg-[#15151f] px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:border-[#4f46e5]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-[#1f1f2e] flex gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask for alert recommendations..."
              className="min-w-0 flex-1 bg-[#0a0a0f] border border-[#2a2a3a] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#4f46e5]"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="size-10 bg-[#4f46e5] text-white flex items-center justify-center hover:bg-[#4338ca] disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send alert assistant message"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="size-14 bg-[#4f46e5] text-white shadow-2xl flex items-center justify-center hover:bg-[#4338ca]"
          aria-label="Open alert recommendation assistant"
        >
          <MessageSquare className="size-6" />
        </button>
      )}
    </div>
  );
}
