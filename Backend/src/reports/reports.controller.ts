import { Body, Controller, Post, Req } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthJwtPayload } from '../auth/auth.types';

type ReqWithUser = { user?: AuthJwtPayload };

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
