import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Alert } from './alert.schema';

@Injectable()
export class AlertsService {
  constructor(@InjectModel(Alert.name) private readonly alertModel: Model<Alert>) {}

  async create(data: Partial<Alert>): Promise<Alert> {
    return this.alertModel.create(data);
  }

  async list(): Promise<Alert[]> {
    return this.alertModel.find().sort({ triggeredAt: -1 }).exec();
  }

  async findById(id: string): Promise<Alert> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Alert not found');
    }
    const doc = await this.alertModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('Alert not found');
    }
    return doc;
  }

  // Clear all alerts from the database
  async clearAll(): Promise<{ deletedCount: number }> {
    const result = await this.alertModel.deleteMany({});
    return { deletedCount: result.deletedCount ?? 0 };
  }
}
