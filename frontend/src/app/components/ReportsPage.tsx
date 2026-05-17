import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  FileDown,
  FileText,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
} from 'lucide-react';
import {
  generateDailySecurityReport,
  getDailyReport,
  listDailyReports,
  type DailyReportDetail,
  type DailyReportListItem,
  type DailySecurityReportResponse,
} from '../api/reports';
import { DailyReportMarkdown } from './DailyReportMarkdown';
import { downloadMarkdownAsPdf } from '../lib/downloadReportPdf';

function formatReportDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ReportsPage() {
  const [recentReports, setRecentReports] = useState<DailyReportListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<DailyReportDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [dailyReportLoading, setDailyReportLoading] = useState(false);
  const [dailyReportError, setDailyReportError] = useState<string | null>(null);
  const [dailyReportResult, setDailyReportResult] = useState<DailySecurityReportResponse | null>(null);

  const loadRecentReports = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const reports = await listDailyReports();
      setRecentReports(reports);
    } catch (e) {
      setRecentReports([]);
      setListError(e instanceof Error ? e.message : 'Failed to load recent reports');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecentReports();
  }, [loadRecentReports]);

  const openReport = async (date: string) => {
    setSelectedDate(date);
    setViewLoading(true);
    setDailyReportError(null);
    try {
      const detail = await getDailyReport(date);
      setActiveReport(detail);
    } catch (e) {
      setActiveReport(null);
      setDailyReportError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setViewLoading(false);
    }
  };

  const handleGenerateDailySecurityReport = async () => {
    setDailyReportLoading(true);
    setDailyReportError(null);
    try {
      const res = await generateDailySecurityReport();
      setDailyReportResult(res);
      setSelectedDate(res.reportDate);
      setActiveReport({
        date: res.reportDate,
        fileName: res.filePath.split(/[/\\]/).pop() ?? `daily-security-${res.reportDate}.md`,
        markdown: res.markdown,
        alertCount: res.alertCount,
        hasAiInsights: res.aiInsights !== null,
      });
      await loadRecentReports();
    } catch (e) {
      setDailyReportResult(null);
      setDailyReportError(e instanceof Error ? e.message : 'Failed to generate report');
    } finally {
      setDailyReportLoading(false);
    }
  };

  const displayMarkdown = activeReport?.markdown ?? dailyReportResult?.markdown ?? null;
  const displayDate = activeReport?.date ?? dailyReportResult?.reportDate ?? selectedDate;
  const displayAlertCount = activeReport?.alertCount ?? dailyReportResult?.alertCount ?? null;
  const displayHasAi = activeReport?.hasAiInsights ?? dailyReportResult?.aiInsights !== null;

  const downloadPdf = () => {
    if (!displayMarkdown || !displayDate) return;
    downloadMarkdownAsPdf(displayMarkdown, `daily-security-report-${displayDate}.pdf`);
  };

  const downloadMarkdown = () => {
    if (!displayMarkdown || !displayDate) return;
    const blob = new Blob([displayMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-security-report-${displayDate}.md`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl text-white mb-2">Security Reports</h1>
        <p className="text-gray-400">
          Generate daily alert summaries with AI insights, browse your history, and export as PDF.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Recent reports sidebar */}
        <aside className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-4 h-fit lg:sticky lg:top-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-white flex items-center gap-2">
              <Calendar className="size-4 text-[#a5b4fc]" />
              Recent reports
            </h2>
            <button
              type="button"
              onClick={() => void loadRecentReports()}
              disabled={listLoading}
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#1a1a24] disabled:opacity-50"
              title="Refresh list"
            >
              <RefreshCw className={`size-4 ${listLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {listError ? <p className="text-xs text-[#fca5a5] mb-3">{listError}</p> : null}

          {listLoading && recentReports.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : null}

          {!listLoading && recentReports.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No saved reports yet. Generate your first report.</p>
          ) : null}

          <ul className="space-y-1 max-h-[420px] overflow-y-auto">
            {recentReports.map((report) => {
              const isActive = selectedDate === report.date;
              return (
                <li key={report.date}>
                  <button
                    type="button"
                    onClick={() => void openReport(report.date)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors border ${
                      isActive
                        ? 'bg-[#4f46e5]/15 border-[#4f46e5]/40 text-white'
                        : 'border-transparent text-gray-300 hover:bg-[#1a1a24] hover:border-[#2a2a3a]'
                    }`}
                  >
                    <p className="text-sm font-medium">{formatReportDate(report.date)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {report.alertCount !== null ? `${report.alertCount} alerts` : 'Report'}
                      {report.hasAiInsights ? (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[#a5b4fc]">
                          <Sparkles className="size-3" />
                          AI
                        </span>
                      ) : null}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Main panel */}
        <div className="space-y-6">
          <div className="bg-[#0f0f17] border border-[#1f1f2e] rounded-lg p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-3">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#4f46e5]/20 border border-[#4f46e5]/30">
                  <Shield className="size-5 text-[#a5b4fc]" />
                </div>
                <div>
                  <h2 className="text-xl text-white font-medium">Daily security report</h2>
                  <p className="text-sm text-gray-400 mt-1 max-w-xl">
                    Pulls alerts from the last 24 hours, groups them by rule, adds remediation
                    guidance, and enriches with Gemini AI insights when configured.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleGenerateDailySecurityReport()}
                  disabled={dailyReportLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-white text-sm font-medium"
                >
                  {dailyReportLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileText className="size-4" />
                  )}
                  {dailyReportLoading ? 'Generating…' : 'Generate today\'s report'}
                </button>
                {displayMarkdown ? (
                  <>
                    <button
                      type="button"
                      onClick={downloadPdf}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-[#1a1a24] border border-[#2a2a3a] hover:border-[#4f46e5] text-gray-200 text-sm"
                    >
                      <FileDown className="size-4" />
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={downloadMarkdown}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded bg-[#1a1a24] border border-[#2a2a3a] hover:border-[#4f46e5] text-gray-200 text-sm"
                    >
                      <FileDown className="size-4" />
                      .md
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {dailyReportError ? (
              <p className="mt-4 text-sm text-[#fca5a5]">{dailyReportError}</p>
            ) : null}

            {viewLoading ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="size-4 animate-spin" />
                Loading report…
              </div>
            ) : null}

            {!viewLoading && displayMarkdown ? (
              <div className="mt-4 space-y-4">
                <div className="rounded border border-[#2a2a3a] bg-[#0a0a0f] p-4 text-sm text-gray-300 flex flex-wrap gap-x-6 gap-y-2">
                  {displayDate ? (
                    <p>
                      <span className="text-gray-500">Report date:</span>{' '}
                      <span className="text-white">{formatReportDate(displayDate)}</span>
                    </p>
                  ) : null}
                  {displayAlertCount !== null ? (
                    <p>
                      <span className="text-gray-500">Alerts:</span>{' '}
                      <span className="font-mono text-white">{displayAlertCount}</span>
                    </p>
                  ) : null}
                  {displayHasAi ? (
                    <p className="text-[#a5b4fc] flex items-center gap-1">
                      <Sparkles className="size-3.5" />
                      AI insights included
                    </p>
                  ) : (
                    <p className="text-gray-500">No AI insights on this report</p>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-medium text-gray-400">Report preview</h3>
                  <DailyReportMarkdown markdown={displayMarkdown} />
                </div>
              </div>
            ) : null}

            {!viewLoading && !displayMarkdown && !dailyReportLoading ? (
              <p className="mt-6 text-sm text-gray-500">
                Select a report from the list or generate today&apos;s report to preview it here.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
