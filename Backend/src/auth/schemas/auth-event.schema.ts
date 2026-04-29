import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AuthEvent extends Document {
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: false, index: true })
  userId?: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  username!: string;

  @Prop({ type: String, required: true, index: true })
  action!: string;

  @Prop({ type: String, required: true, index: true })
  outcome!: 'success' | 'failure';

  @Prop({ type: String, default: '' })
  reason!: string;

  @Prop({ type: String, default: '' })
  sourceIp!: string;

  @Prop({ type: String, default: '' })
  userAgent!: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const AuthEventSchema = SchemaFactory.createForClass(AuthEvent);
