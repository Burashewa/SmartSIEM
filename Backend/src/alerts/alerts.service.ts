import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Alert } from './alert.schema';
import { AuthJwtPayload } from '../auth/auth.types';

@Injectable()
export class AlertsService {
  constructor(@InjectModel(Alert.name) private readonly alertModel: Model<Alert>) {}

  async create(data: Partial<Alert>): Promise<Alert> {
    return this.alertModel.create(data);
  }

  async list(user: AuthJwtPayload): Promise<Alert[]> {
    return this.alertModel
      .find(this.buildOwnershipFilter(user))
      .sort({ triggeredAt: -1 })
      .exec();
  }

  async findById(id: string, user: AuthJwtPayload): Promise<Alert> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Alert not found');
    }
    const doc = await this.alertModel
      .findOne({ _id: id, ...this.buildOwnershipFilter(user) })
      .exec();
    if (!doc) {
      throw new NotFoundException('Alert not found');
    }
    return doc;
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
}
