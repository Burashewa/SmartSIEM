import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { AuthUser } from '../auth/schemas/user.schema';

export type AgentApiKeyStorageMode = 'one_time' | 'stored';

@Schema({ timestamps: true })
export class Agent extends Document {
  @Prop({ type: String, required: true, unique: true, index: true, default: () => randomUUID() })
  agentId!: string;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  apiKeyId!: string;

  @Prop({ type: String, required: true, select: false })
  apiKeyHash!: string;

  @Prop({ type: String, required: true, select: false })
  apiKeySalt!: string;

  @Prop({
    type: String,
    required: true,
    enum: ['one_time', 'stored'],
    default: 'one_time',
    index: true,
  })
  apiKeyStorageMode!: AgentApiKeyStorageMode;

  @Prop({ type: String, required: false, select: false })
  encryptedApiKeyCiphertext?: string;

  @Prop({ type: String, required: false, select: false })
  encryptedApiKeyIv?: string;

  @Prop({ type: String, required: false, select: false })
  encryptedApiKeyAuthTag?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: AuthUser.name,
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);

AgentSchema.index({ userId: 1, name: 1 });
