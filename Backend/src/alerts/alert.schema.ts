import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AlertStatus = 'open' | 'investigating' | 'resolved';

@Schema({ timestamps: true })
export class Alert extends Document {
  @Prop({ type: String, required: false, index: true })
  agentId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false, index: true })
  userId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  ruleId!: string;

  @Prop({ type: String, required: true })
  message!: string;

  @Prop({ type: String, required: true, index: true })
  severity!: string;

  @Prop({ type: String, required: false, index: true })
  ip?: string;

  @Prop({
    type: String,
    required: true,
    index: true,
    enum: ['open', 'investigating', 'resolved'],
    default: 'open',
  })
  status!: AlertStatus;

  @Prop({ type: Date, required: true })
  triggeredAt!: Date;

  @Prop({ type: Object, required: false })
  context?: Record<string, unknown>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);
