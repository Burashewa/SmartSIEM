import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { Alert } from '../alerts/alert.schema';
import { AlertsService } from '../alerts/alerts.service';
import { AuthJwtPayload } from '../auth/auth.types';
import { humanizeRuleId } from '../alerts/alert-rule-labels';
import { RecommendationsService } from '../recommendations/recommendations.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly alertsService: AlertsService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  /**
   * Builds a Markdown report of alerts in the last 24h (relative to `until`) and writes
   * `reports/daily-security-{userId}-{date}.md` under the process cwd.
   */
  async generateDailySecurityReport(user: AuthJwtPayload): Promise<{
    filePath: string;
    alertCount: number;
    markdown: string;
  }> {
    const until = new Date();
    const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
    const alerts = await this.alertsService.findTriggeredInRange(user, since, until);
    const md = this.buildMarkdown(user, since, until, alerts);

    const dir = join(process.cwd(), 'reports');
    await mkdir(dir, { recursive: true });
    const safeUser = user.sub.replace(/[^a-z0-9_-]/gi, '_');
    const fname = `daily-security-${safeUser}-${until.toISOString().slice(0, 10)}.md`;
    const filePath = join(dir, fname);
    await writeFile(filePath, md, 'utf8');
    this.logger.log(`Daily report written: ${filePath} (alerts=${alerts.length})`);
    return { filePath, alertCount: alerts.length, markdown: md };
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
        lines.push(`- **${ts}** | ${a.severity ?? '?'} | IP: ${a.ip ?? '—'} | ${a.message ?? ''}`);
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
