import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AuthSession extends Document {
  @Prop({ type: Types.ObjectId, ref: 'AuthUser', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true, index: true })
  sessionId!: string;

  @Prop({ type: String, required: true })
  refreshTokenHash!: string;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date })
  revokedAt?: Date;

  @Prop({ type: String, default: '' })
  sourceIp!: string;

  @Prop({ type: String, default: '' })
  userAgent!: string;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);
