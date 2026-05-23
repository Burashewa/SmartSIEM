import { GoogleGenAI } from '@google/genai';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  REPORT_AI_CHAT_SYSTEM_INSTRUCTION,
  ReportAiChatHistoryItem,
} from './report-ai.types';

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;
const MAX_REPORT_CONTEXT_CHARS = 24_000;
const MAX_HISTORY_TURNS = 12;

export type ReportAiChatResult = {
  answer: string;
  reportDate: string | null;
  hasReportContext: boolean;
  suggestedPrompts: string[];
};

@Injectable()
export class ReportAiChatService {
  private readonly logger = new Logger(ReportAiChatService.name);

  constructor(private readonly configService: ConfigService) {}

  async chat(
    message: string,
    history: ReportAiChatHistoryItem[],
    reportMarkdown: string | null,
    reportDate: string | null,
  ): Promise<ReportAiChatResult> {
    const trimmed = message.trim();
    if (!trimmed) {
      return {
        answer: 'Please enter a question about your security reports or alerts.',
        reportDate,
        hasReportContext: Boolean(reportMarkdown),
        suggestedPrompts: this.defaultPrompts(reportDate),
      };
    }

    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured. Add it to SmartSIEM/.env to enable the AI assistant.',
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const contents = this.buildContents(trimmed, history, reportMarkdown, reportDate);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction: REPORT_AI_CHAT_SYSTEM_INSTRUCTION,
          },
        });

        const answer = response.text?.trim();
        if (!answer) {
          throw new Error('Gemini returned an empty response');
        }

        return {
          answer,
          reportDate,
          hasReportContext: Boolean(reportMarkdown),
          suggestedPrompts: this.defaultPrompts(reportDate),
        };
      } catch (e) {
        const detail = this.formatError(e);
        const isLastAttempt = attempt === MAX_RETRIES;
        if (!isLastAttempt) {
          this.logger.warn(
            `Gemini chat attempt ${attempt}/${MAX_RETRIES} failed (${detail}); retrying…`,
          );
          await this.sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
        this.logger.error(`Gemini chat failed after ${MAX_RETRIES} attempts: ${detail}`);
        throw new ServiceUnavailableException(
          'The AI assistant is temporarily unavailable. Please try again shortly.',
        );
      }
    }

    throw new ServiceUnavailableException('The AI assistant is temporarily unavailable.');
  }

  private buildContents(
    message: string,
    history: ReportAiChatHistoryItem[],
    reportMarkdown: string | null,
    reportDate: string | null,
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    const items: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (reportMarkdown) {
      const truncated = this.truncateReport(reportMarkdown);
      const dateLabel = reportDate ?? 'unknown';
      items.push({
        role: 'user',
        parts: [
          {
            text: `Context: daily security report (${dateLabel}). Use this when answering follow-up questions.\n\n---\n\n${truncated}`,
          },
        ],
      });
      items.push({
        role: 'model',
        parts: [
          {
            text: 'Understood. I have the daily security report context and will use it for recommendations and triage guidance.',
          },
        ],
      });
    }

    const recentHistory = history
      .filter((item) => item.content.trim().length > 0)
      .slice(-MAX_HISTORY_TURNS);

    for (const item of recentHistory) {
      items.push({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content.trim() }],
      });
    }

    items.push({
      role: 'user',
      parts: [{ text: message }],
    });

    return items;
  }

  private truncateReport(markdown: string): string {
    if (markdown.length <= MAX_REPORT_CONTEXT_CHARS) return markdown;
    return `${markdown.slice(0, MAX_REPORT_CONTEXT_CHARS)}\n\n[Report truncated for context length]`;
  }

  private defaultPrompts(reportDate: string | null): string[] {
    if (reportDate) {
      return [
        `Summarize the ${reportDate} security report`,
        'What should system administrators do first?',
        'What developer fixes are recommended?',
      ];
    }
    return [
      'How do I get started with SmartSIEM reports?',
      'What should I look for in a daily security report?',
      'How do admin vs developer recommendations differ?',
    ];
  }

  private getApiKey(): string | undefined {
    const fromConfig = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (fromConfig) return fromConfig;
    return process.env.GEMINI_API_KEY?.trim() || undefined;
  }

  private formatError(error: unknown): string {
    if (!(error instanceof Error)) return String(error);
    const parts = [error.message];
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) {
      parts.push(`cause: ${cause.message}`);
    }
    return parts.join(' | ');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
