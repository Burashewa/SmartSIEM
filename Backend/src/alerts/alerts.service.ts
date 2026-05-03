import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Alert } from './alert.schema';
import { AuthJwtPayload } from '../auth/auth.types';
import { IpGeoLocation, IpGeolocationService } from '../geo/ip-geolocation.service';

export type AlertResponse = Record<string, unknown> & {
  _id?: unknown;
  id?: unknown;
  ruleId?: string;
  message?: string;
  severity?: string;
  ip?: string;
  status?: string;
  triggeredAt?: string | Date;
  context?: Record<string, unknown>;
  geo?: IpGeoLocation;
  attackerLocation?: string;
};

@Injectable()
export class AlertsService {
  constructor(
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
    private readonly ipGeolocation: IpGeolocationService,
  ) {}

  async create(data: Partial<Alert>): Promise<Alert> {
    return this.alertModel.create(data);
  }

  async list(user: AuthJwtPayload): Promise<AlertResponse[]> {
    const alerts = await this.alertModel
      .find(this.buildOwnershipFilter(user))
      .sort({ triggeredAt: -1 })
      .exec();
    return Promise.all(alerts.map((alert) => this.enrichWithGeo(alert)));
  }

  async findById(id: string, user: AuthJwtPayload): Promise<AlertResponse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Alert not found');
    }
    const doc = await this.alertModel
      .findOne({ _id: id, ...this.buildOwnershipFilter(user) })
      .exec();
    if (!doc) {
      throw new NotFoundException('Alert not found');
    }
    return this.enrichWithGeo(doc);
  }

  // Clear all alerts from the database
  async clearAll(user: AuthJwtPayload): Promise<{ deletedCount: number }> {
    const result = await this.alertModel.deleteMany(this.buildOwnershipFilter(user));
    return { deletedCount: result.deletedCount ?? 0 };
  }

  private buildOwnershipFilter(user: AuthJwtPayload): Record<string, unknown> {
    if (user.role === 'admin') {
      return {};
    }

    return { userId: new Types.ObjectId(user.sub) };
  }

  private async enrichWithGeo(alert: Alert): Promise<AlertResponse> {
    const plain = alert.toObject({ virtuals: true }) as AlertResponse;
    const context = alert.context;
    const geo = await this.ipGeolocation.locate(alert.ip, context);

    return {
      ...plain,
      geo,
      attackerLocation: this.formatLocation(geo),
    };
  }

  private formatLocation(geo?: IpGeoLocation): string | undefined {
    if (!geo) return undefined;
    const parts = [geo.city, geo.region, geo.country].filter(
      (value): value is string => Boolean(value),
    );
    if (parts.length > 0) return parts.join(', ');
    if (geo.source === 'private') return 'Private network';
    return undefined;
  }
}
