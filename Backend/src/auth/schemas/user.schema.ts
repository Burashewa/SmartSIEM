import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SIEM_ROLES, SiemRole } from '../auth.types';

export type AuthProvider = 'local' | 'google';

@Schema({ timestamps: true })
export class AuthUser extends Document {
  @Prop({ type: String, required: true, unique: true, index: true, lowercase: true, trim: true })
  username!: string;

  @Prop({ type: String })
  passwordHash?: string;

  @Prop({ type: String, enum: ['local', 'google'], required: true, default: 'local' })
  authProvider!: AuthProvider;

  @Prop({ type: String, sparse: true, unique: true, index: true })
  googleId?: string;

  @Prop({ type: String, lowercase: true, trim: true, index: true })
  email?: string;

  @Prop({ type: Boolean, default: false })
  emailVerified?: boolean;

  /** Single-use token id in verification link (?verify=...). */
  @Prop({ type: String, sparse: true, index: true })
  emailVerificationId?: string;

  @Prop({ type: Date })
  emailVerificationExpires?: Date;

  @Prop({ type: Date })
  emailVerifiedAt?: Date;

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

  /** High-entropy single-use id embedded in reset link (?reset=...). */
  @Prop({ type: String, sparse: true, index: true })
  passwordResetId?: string;

  @Prop({ type: Date })
  passwordResetExpires?: Date;
}

export const AuthUserSchema = SchemaFactory.createForClass(AuthUser);
