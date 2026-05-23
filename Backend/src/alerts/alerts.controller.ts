import { Body, Controller, Delete, Get, Param, Patch, Req, Res } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AlertsService } from './alerts.service';
import { Alert } from './alert.schema';
import { ANALYST_ALERT_STATUSES, isAnalystAlertStatus } from './alert-status';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthJwtPayload } from '../auth/auth.types';

type AuthenticatedRequest = {
  user?: AuthJwtPayload;
};

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
  ) {}

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

  // PATCH /api/alerts/:id/status
  @Patch(':id/status')
  @Roles('security_analyst')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status?: string },
    @Req() request: AuthenticatedRequest,
    @Res() response: any,
  ) {
    const status = body?.status?.trim();

    if (!Types.ObjectId.isValid(id) || !status || !isAnalystAlertStatus(status)) {
      return response.status(400).json({
        error: 'Invalid status',
        allowed: [...ANALYST_ALERT_STATUSES],
      });
    }

    try {
      const user = request.user!;
      const ownershipFilter =
        user.role === 'admin' ? {} : { userId: new Types.ObjectId(user.sub) };
      const updated = await this.alertModel
        .findOneAndUpdate(
          { _id: id, ...ownershipFilter },
          { $set: { status } },
          { new: true },
        )
        .exec();

      if (!updated) {
        return response.status(404).json({ error: 'Alert not found' });
      }

      return response.status(200).json(updated);
    } catch {
      return response.status(500).json({ error: 'Failed to update status' });
    }
  }

  // DELETE /api/alerts
  @Delete()
  @Roles('security_analyst')
  async clear(@Req() request: AuthenticatedRequest) {
    return this.alertsService.clearAll(request.user!);
  }
}
