import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ReportAiChatService } from './report-ai-chat.service';
import { ReportAiChatHistoryItem } from './report-ai.types';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthJwtPayload } from '../auth/auth.types';

type ReqWithUser = { user?: AuthJwtPayload };

interface ReportAiChatRequest {
  message?: string;
  reportDate?: string;
  history?: ReportAiChatHistoryItem[];
}

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportAiChatService: ReportAiChatService,
  ) {}

  /**
   * GET /api/reports/daily/list — recent daily reports for the signed-in user (newest first).
   */
  @Get('daily/list')
  @Roles('security_analyst')
  async listDaily(@Req() request: ReqWithUser) {
    const user = request.user!;
    const reports = await this.reportsService.listDailyReports(user);
    return { reports };
  }

  /**
   * GET /api/reports/daily/:date — fetch a saved report (yyyy-mm-dd).
   */
  @Get('daily/:date')
  @Roles('security_analyst')
  async getDaily(@Req() request: ReqWithUser, @Param('date') date: string) {
    const user = request.user!;
    return this.reportsService.getDailyReport(user, date);
  }

  /**
   * POST /api/reports/daily
   * Body optional: { "hours": 24 } — reserved for future; currently always last 24h from now.
   */
  @Post('daily')
  @Roles('security_analyst')
  async generateDaily(@Req() request: ReqWithUser, @Body() _body?: { hours?: number }) {
    const user = request.user!;
    return this.reportsService.generateDailySecurityReport(user);
  }

  /**
   * POST /api/reports/ai/chat — conversational Gemini assistant with optional daily report context.
   */
  @Post('ai/chat')
  @Roles('security_analyst')
  async chat(@Req() request: ReqWithUser, @Body() body: ReportAiChatRequest) {
    const user = request.user!;
    const { reportDate, markdown } = await this.reportsService.getReportContextForChat(
      user,
      body.reportDate,
    );
    return this.reportAiChatService.chat(
      body.message ?? '',
      body.history ?? [],
      markdown,
      reportDate,
    );
  }
}
