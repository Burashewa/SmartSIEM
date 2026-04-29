import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SIEM_ROLES, SiemRole } from '../auth.types';

@Schema({ timestamps: true })
export class AuthUser extends Document {
  @Prop({ type: String, required: true, unique: true, index: true, lowercase: true, trim: true })
  username!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: String, enum: SIEM_ROLES, required: true, default: 'security_analyst', index: true })
  role!: SiemRole;

  @Prop({ type: Boolean, required: true, default: true })
  isActive!: boolean;

  @Prop({ type: Number, required: true, default: 0 })
  failedLoginAttempts!: number;

  @Prop({ type: Date })
  lockedUntil?: Date;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ type: Date })
  passwordChangedAt?: Date;
}

export const AuthUserSchema = SchemaFactory.createForClass(AuthUser);
