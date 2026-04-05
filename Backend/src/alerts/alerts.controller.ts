import { Controller, Delete, Get, Param } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  // GET /api/alerts
  @Get()
  async list() {
    return this.alertsService.list();
  }

  // GET /api/alerts/:id
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.alertsService.findById(id);
  }

  // DELETE /api/alerts
  @Delete()
  async clear() {
    return this.alertsService.clearAll();
  }
}
