import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { join, normalize } from 'path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Alert } from '../alerts/alert.schema';
import { AlertsService } from '../alerts/alerts.service';
import { AuthJwtPayload } from '../auth/auth.types';
import { formatAlertStatusLabel } from '../alerts/alert-status';
import { humanizeRuleId } from '../alerts/alert-rule-labels';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { ReportAiEnrichmentService } from './report-ai-enrichment.service';
import { ReportAiInsights } from './report-ai.types';

export type DailyReportListItem = {
  date: string;
  fileName: string;
  generatedAt: string | null;
  alertCount: number | null;
  hasAiInsights: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly alertsService: AlertsService,
    private readonly recommendationsService: RecommendationsService,
    private readonly reportAiEnrichmentService: ReportAiEnrichmentService,
  ) {}

  /**
   * Builds a Markdown report of alerts in the last 24h (relative to `until`) and writes
   * `reports/daily-security-{userId}-{date}.md` under the process cwd.
   */
  async generateDailySecurityReport(user: AuthJwtPayload): Promise<{
    filePath: string;
    reportDate: string;
    alertCount: number;
    markdown: string;
    aiInsights: ReportAiInsights | null;
  }> {
    const until = new Date();
    const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
    const alerts = await this.alertsService.findTriggeredInRange(user, since, until);
    const baseMarkdown = this.buildMarkdown(user, since, until, alerts);
    const aiInsights = await this.reportAiEnrichmentService.enrichMarkdownReport(baseMarkdown);
    const markdown = aiInsights
      ? this.reportAiEnrichmentService.insertAiSection(
          baseMarkdown,
          this.reportAiEnrichmentService.formatAiInsightsMarkdown(aiInsights),
        )
      : baseMarkdown;

    const reportDate = until.toISOString().slice(0, 10);
    const filePath = await this.writeDailyReportFile(user, reportDate, markdown);
    this.logger.log(
      `Daily report written: ${filePath} (alerts=${alerts.length}, ai=${aiInsights ? 'yes' : 'no'})`,
    );
    return { filePath, reportDate, alertCount: alerts.length, markdown, aiInsights };
  }

  async listDailyReports(user: AuthJwtPayload): Promise<DailyReportListItem[]> {
    const dir = this.getReportsDir();
    const prefix = this.reportFilePrefix(user);
    let names: string[];
    try {
      names = await readdir(dir);
    } catch {
      return [];
    }

    const items: DailyReportListItem[] = [];
    for (const name of names) {
      if (!name.startsWith(prefix) || !name.endsWith('.md')) continue;
      const date = name.slice(prefix.length, -3);
      if (!DATE_PATTERN.test(date)) continue;
      const parsed = await this.parseReportMetadata(join(dir, name), date, name);
      items.push(parsed);
    }

    return items.sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Loads report markdown only when the client explicitly passes a report date. */
  async getReportContextForChat(
    user: AuthJwtPayload,
    preferredDate?: string,
  ): Promise<{ reportDate: string | null; markdown: string | null }> {
    if (!preferredDate || !DATE_PATTERN.test(preferredDate)) {
      return { reportDate: null, markdown: null };
    }

    try {
      const report = await this.getDailyReport(user, preferredDate);
      return { reportDate: report.date, markdown: report.markdown };
    } catch {
      return { reportDate: null, markdown: null };
    }
  }

  async getDailyReport(
    user: AuthJwtPayload,
    date: string,
  ): Promise<{
    date: string;
    fileName: string;
    markdown: string;
    alertCount: number | null;
    hasAiInsights: boolean;
  }> {
    if (!DATE_PATTERN.test(date)) {
      throw new NotFoundException('Report not found');
    }
    const filePath = this.resolveReportPath(user, date);
    let markdown: string;
    try {
      markdown = await readFile(filePath, 'utf8');
    } catch {
      throw new NotFoundException(`No report found for ${date}`);
    }
    const fileName = `${this.reportFilePrefix(user)}${date}.md`;
    const meta = await this.parseReportMetadata(filePath, date, fileName);
    return {
      date,
      fileName,
      markdown,
      alertCount: meta.alertCount,
      hasAiInsights: meta.hasAiInsights,
    };
  }

  private getReportsDir(): string {
    return join(process.cwd(), 'reports');
  }

  private reportFilePrefix(user: AuthJwtPayload): string {
    const safeUser = user.sub.replace(/[^a-z0-9_-]/gi, '_');
    return `daily-security-${safeUser}-`;
  }

  private resolveReportPath(user: AuthJwtPayload, date: string): string {
    const fileName = `${this.reportFilePrefix(user)}${date}.md`;
    const filePath = normalize(join(this.getReportsDir(), fileName));
    const reportsDir = normalize(this.getReportsDir());
    if (!filePath.startsWith(reportsDir)) {
      throw new NotFoundException('Report not found');
    }
    return filePath;
  }

  private async writeDailyReportFile(
    user: AuthJwtPayload,
    reportDate: string,
    markdown: string,
  ): Promise<string> {
    const dir = this.getReportsDir();
    await mkdir(dir, { recursive: true });
    const filePath = this.resolveReportPath(user, reportDate);
    await writeFile(filePath, markdown, 'utf8');
    return filePath;
  }

  private async parseReportMetadata(
    filePath: string,
    date: string,
    fileName: string,
  ): Promise<DailyReportListItem> {
    let content = '';
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      return {
        date,
        fileName,
        generatedAt: null,
        alertCount: null,
        hasAiInsights: false,
      };
    }
    const alertMatch = content.match(/\*\*Total alerts:\*\*\s*(\d+)/);
    const genMatch = content.match(/\*\*Generated:\*\*\s*(.+)/);
    return {
      date,
      fileName,
      generatedAt: genMatch?.[1]?.trim() ?? null,
      alertCount: alertMatch ? Number.parseInt(alertMatch[1], 10) : null,
      hasAiInsights: content.includes('## 🤖 SmartSIEM AI Insights'),
    };
  }

  private buildMarkdown(
    user: AuthJwtPayload,
    since: Date,
    until: Date,
    alerts: Alert[],
  ): string {
    const lines: string[] = [];
    lines.push('# SmartSIEM — Daily security report');
    lines.push('');
    lines.push(`- **Generated:** ${until.toISOString()}`);
    lines.push(`- **Window:** ${since.toISOString()} → ${until.toISOString()}`);
    lines.push(`- **Tenant user:** ${user.username} (${user.sub}), role ${user.role}`);
    lines.push(`- **Total alerts:** ${alerts.length}`);
    lines.push('');

    const bySeverity: Record<string, number> = {};
    for (const a of alerts) {
      const s = (a.severity ?? 'unknown').toLowerCase();
      bySeverity[s] = (bySeverity[s] ?? 0) + 1;
    }
    lines.push('## Summary by severity');
    lines.push('');
    for (const [sev, n] of Object.entries(bySeverity).sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${sev}:** ${n}`);
    }
    lines.push('');

    const byStatus: Record<string, number> = {};
    for (const a of alerts) {
      const st = (a.status ?? 'open').toLowerCase();
      const label = formatAlertStatusLabel(st);
      byStatus[label] = (byStatus[label] ?? 0) + 1;
    }
    lines.push('## Summary by investigation status');
    lines.push('');
    for (const [label, n] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${label}:** ${n}`);
    }
    const confirmedThreats = alerts.filter((a) => (a.status ?? '').toLowerCase() === 'threat').length;
    if (confirmedThreats > 0) {
      lines.push('');
      lines.push(
        `> **${confirmedThreats}** alert(s) were analyst-confirmed as **real threats** during this period.`,
      );
    }
    lines.push('');

    const byRule = new Map<string, Alert[]>();
    for (const a of alerts) {
      const k = a.rule_id ?? 'unknown-rule';
      if (!byRule.has(k)) byRule.set(k, []);
      byRule.get(k)!.push(a);
    }

    lines.push('## Findings and recommendations');
    lines.push('');

    const sortedRules = [...byRule.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [ruleId, items] of sortedRules) {
      const label = humanizeRuleId(ruleId);
      lines.push(`### ${label} (\`${ruleId}\`) — ${items.length} alert(s)`);
      lines.push('');

      const sample = items.slice(0, 5);
      for (const a of sample) {
        const ts = a.triggeredAt instanceof Date ? a.triggeredAt.toISOString() : String(a.triggeredAt);
        const statusLabel = formatAlertStatusLabel((a.status ?? 'open').toLowerCase());
        lines.push(
          `- **${ts}** | ${a.severity ?? '?'} | ${statusLabel} | IP: ${a.ip ?? '—'} | ${a.message ?? ''}`,
        );
      }
      if (items.length > sample.length) {
        lines.push(`- _… and ${items.length - sample.length} more (deduped in UI)._`);
      }
      lines.push('');

      const first = items[0];
      const recs = this.recommendationsService.getRecommendations({
        ruleId,
        rule_id: ruleId,
        severity: first?.severity,
        ip: first?.ip,
        context: first?.context,
      });
      if (recs.length > 0) {
        lines.push('**Recommendations:**');
        for (const r of recs) {
          lines.push(`1. ${r}`);
        }
        lines.push('');
      }
    }

    if (alerts.length === 0) {
      lines.push('_No alerts in this period._');
    }

    lines.push('---');
    lines.push('');
    lines.push('*This file is generated automatically. Configure malicious IPs via `MALICIOUS_IPS` and tune DoS/error thresholds in `rules.constants.ts` as needed.*');
    lines.push('');
    return lines.join('\n');
  }
}
