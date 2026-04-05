import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Severity } from './log.types';

@Schema({ timestamps: false })
export class Log extends Document {
  @Prop({ type: Date, required: true })
  timestamp!: Date;

  @Prop({ type: String, required: true, index: true })
  source!: string;

  @Prop({ type: String, required: true, index: true })
  severity!: Severity;

  @Prop({ type: String, required: true, index: true })
  event!: string;

  @Prop({ type: String, required: false, index: true })
  action?: string;

  @Prop({ type: String, required: false, index: true })
  status?: string;

  @Prop({ type: String, required: false, index: true })
  user?: string;

  @Prop({ type: String, required: false, index: true })
  role?: string;

  @Prop({ type: String, required: false, index: true })
  ip?: string;

  @Prop({ type: String, required: false, index: true })
  deviceId?: string;

  @Prop({ type: String, required: false, index: true })
  sessionId?: string;

  @Prop({ type: String, required: false, index: true })
  endpoint?: string;

  @Prop({ type: String, required: false, index: true })
  method?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  resource?: string | null;

  @Prop({ type: Object, required: false })
  payload?: Record<string, unknown>;

  @Prop({ type: String, required: false })
  userAgent?: string;

  @Prop({ type: Number, required: false, index: true })
  latitude?: number;

  @Prop({ type: Number, required: false, index: true })
  longitude?: number;

  @Prop({ type: [String], required: false, index: true })
  tags?: string[];

  @Prop({ type: Object, required: false })
  metadata?: Record<string, unknown>;

  @Prop({ type: Object, required: false })
  raw?: Record<string, unknown>;
}

export const LogSchema = SchemaFactory.createForClass(Log);

LogSchema.index({ ip: 1, timestamp: -1 });
LogSchema.index({ user: 1, event: 1, timestamp: -1 });
LogSchema.index({ latitude: 1, longitude: 1, timestamp: -1 });
LogSchema.index({ sessionId: 1, timestamp: -1 });
LogSchema.index({ endpoint: 1, method: 1, timestamp: -1 });
