import { GoogleGenAI, Type } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REPORT_AI_SYSTEM_INSTRUCTION, ReportAiInsights } from './report-ai.types';

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

const REPORT_AI_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ai_executive_summary: {
      type: Type.STRING,
      description:
        "A 3-sentence high-level narrative summarizing the day's events and threat scenario",
    },
    admin_recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        description:
          'Concrete infrastructure, firewall, network, or account actions for SOC/administrators',
      },
    },
    developer_recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
        description:
          'Concrete code-level fixes, query validation, and security patches for engineering',
      },
    },
  },
  required: ['ai_executive_summary', 'admin_recommendations', 'developer_recommendations'],
  propertyOrdering: [
    'ai_executive_summary',
    'admin_recommendations',
    'developer_recommendations',
  ],
};

@Injectable()
export class ReportAiEnrichmentService {
  private readonly logger = new Logger(ReportAiEnrichmentService.name);

  constructor(private readonly configService: ConfigService) {}

  async enrichMarkdownReport(baseMarkdown: string): Promise<ReportAiInsights | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is not set; skipping AI report enrichment (check SmartSIEM/.env)',
      );
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analyze the following Markdown daily security report and return structured insights.\n\n---\n\n${baseMarkdown}`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction: REPORT_AI_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseJsonSchema: REPORT_AI_JSON_SCHEMA,
          },
        });

        const raw = response.text?.trim();
        if (!raw) {
          this.logger.warn('Gemini returned an empty AI enrichment response');
          return null;
        }

        const parsed = JSON.parse(raw) as ReportAiInsights;
        if (
          typeof parsed.ai_executive_summary !== 'string' ||
          !Array.isArray(parsed.admin_recommendations) ||
          !Array.isArray(parsed.developer_recommendations)
        ) {
          this.logger.warn('Gemini response did not match the expected AI insights schema');
          return null;
        }

        return {
          ai_executive_summary: parsed.ai_executive_summary.trim(),
          admin_recommendations: parsed.admin_recommendations
            .map((item) => String(item).trim())
            .filter(Boolean),
          developer_recommendations: parsed.developer_recommendations
            .map((item) => String(item).trim())
            .filter(Boolean),
        };
      } catch (e) {
        const detail = this.formatError(e);
        const isLastAttempt = attempt === MAX_RETRIES;
        if (!isLastAttempt) {
          this.logger.warn(
            `Gemini enrichment attempt ${attempt}/${MAX_RETRIES} failed (${detail}); retrying…`,
          );
          await this.sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
        this.logger.error(`Gemini report enrichment failed after ${MAX_RETRIES} attempts: ${detail}`);
        return null;
      }
    }

    return null;
  }

  formatAiInsightsMarkdown(insights: ReportAiInsights): string {
    const lines: string[] = [
      '## 🤖 SmartSIEM AI Insights',
      '',
      '### Executive Threat Summary',
      insights.ai_executive_summary,
      '',
      '### System Administrator Action Items',
    ];

    for (const item of insights.admin_recommendations) {
      lines.push(`- ${item}`);
    }

    lines.push('');
    lines.push('### Application Developer Fixes');

    for (const item of insights.developer_recommendations) {
      lines.push(`- ${item}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  insertAiSection(baseMarkdown: string, aiSection: string): string {
    const findingsMarker = '\n## Findings and recommendations';
    const findingsIdx = baseMarkdown.indexOf(findingsMarker);
    if (findingsIdx !== -1) {
      return `${baseMarkdown.slice(0, findingsIdx)}\n${aiSection}${baseMarkdown.slice(findingsIdx)}`;
    }

    const footerMarker = '\n---\n';
    const footerIdx = baseMarkdown.indexOf(footerMarker);
    if (footerIdx !== -1) {
      return `${baseMarkdown.slice(0, footerIdx)}\n${aiSection}${baseMarkdown.slice(footerIdx)}`;
    }

    return `${baseMarkdown.trimEnd()}\n\n${aiSection}`;
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
      const code = (cause as NodeJS.ErrnoException).code;
      if (code) parts.push(`code: ${code}`);
    }
    return parts.join(' | ');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
