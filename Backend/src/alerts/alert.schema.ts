import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AlertStatus = 'open' | 'investigating' | 'resolved';

@Schema({ timestamps: true })
export class Alert extends Document {
  @Prop({ type: String, required: false, index: true })
  agentId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: false, index: true })
  userId?: MongooseSchema.Types.ObjectId;

  /** Matches MongoDB index `rule_id_1_ip_1_dedup_bucket_1` (legacy / external SIEM collections). */
  @Prop({ type: String, required: true, index: true })
  rule_id!: string;

  /**
   * Stable storage id per alert row (remains unique). Logical dedup grouping uses {@link dedupeGroupKey}.
   */
  @Prop({ type: String, required: true, index: true })
  dedup_bucket!: string;

  /**
   * Groups emissions for deduplication: same user, rule_id, normalized IP, agent, and time bucket window.
   */
  @Prop({ type: String, required: false, index: true })
  dedupeGroupKey?: string;

  @Prop({ type: Number, required: false, default: 1 })
  occurrenceCount?: number;

  @Prop({ type: Date, required: false })
  firstTriggeredAt?: Date;

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

/** At most one open alert per group (user + dedupe window + rule + IP + agent). */
AlertSchema.index(
  { userId: 1, dedupeGroupKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'open',
      dedupeGroupKey: { $exists: true, $type: 'string' },
    },
  },
);
