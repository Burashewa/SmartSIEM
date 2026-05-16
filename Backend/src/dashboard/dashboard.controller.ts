import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthJwtPayload } from '../auth/auth.types';

type AuthenticatedRequest = {
  user?: AuthJwtPayload;
};

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles('security_analyst')
  async getSummary(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.getSummary(request.user!);
  }

  /** KPI counts only — fast for realtime dashboard header (no chart queries). */
  @Get('kpi')
  @Roles('security_analyst')
  async getKpi(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.getKpi(request.user!);
  }
}
