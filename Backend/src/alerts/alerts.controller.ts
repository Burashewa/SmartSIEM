import { Controller, Delete, Get, Param, Req } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthJwtPayload } from '../auth/auth.types';

type AuthenticatedRequest = {
  user?: AuthJwtPayload;
};

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  // GET /api/alerts
  @Get()
  @Roles('security_analyst')
  async list(@Req() request: AuthenticatedRequest) {
    return this.alertsService.list(request.user!);
  }

  // GET /api/alerts/:id
  @Get(':id')
  @Roles('security_analyst')
  async getOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.alertsService.findById(id, request.user!);
  }

  // DELETE /api/alerts
  @Delete()
  @Roles('security_analyst')
  async clear(@Req() request: AuthenticatedRequest) {
    return this.alertsService.clearAll(request.user!);
  }
}
