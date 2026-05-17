import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthJwtPayload } from '../auth/auth.types';

type ReqWithUser = { user?: AuthJwtPayload };

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
}
