import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import { Model, Types } from 'mongoose';
import { Agent, AgentApiKeyStorageMode } from './agent.schema';

type AgentLookupResult = {
  agentId: string;
  name: string;
  userId: string;
};

type CreateAgentResult = {
  agentId: string;
  name: string;
  apiKey: string;
  apiKeyStorageMode: AgentApiKeyStorageMode;
  storedApiKeyAvailable: boolean;
  apiKeyPreview: string;
};

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name) private readonly agentModel: Model<Agent>,
    private readonly configService: ConfigService,
  ) {}

  async createAgent(
    userId: string,
    input: { name: string; storeApiKey?: boolean },
  ): Promise<CreateAgentResult> {
    const name = input.name.trim();
    const storageMode = input.storeApiKey ? 'stored' : 'one_time';
    if (!name) {
      throw new BadRequestException('Agent name is required');
    }

    const nextState = this.createApiKeyState(storageMode);
    const created = await this.agentModel.create({
      name,
      userId: new Types.ObjectId(userId),
      apiKeyId: nextState.apiKeyId,
      apiKeyHash: nextState.apiKeyHash,
      apiKeySalt: nextState.apiKeySalt,
      apiKeyStorageMode: nextState.apiKeyStorageMode,
      encryptedApiKeyCiphertext: nextState.encryptedApiKeyCiphertext,
      encryptedApiKeyIv: nextState.encryptedApiKeyIv,
      encryptedApiKeyAuthTag: nextState.encryptedApiKeyAuthTag,
    });

    return {
      agentId: created.agentId,
      name: created.name,
      apiKey: nextState.rawApiKey,
      apiKeyStorageMode: storageMode,
      storedApiKeyAvailable: storageMode === 'stored',
      apiKeyPreview: this.buildApiKeyPreview(created.apiKeyId),
    };
  }

  async listAgents(userId: string): Promise<
    Array<{
      agentId: string;
      name: string;
      apiKeyStorageMode: AgentApiKeyStorageMode;
      storedApiKeyAvailable: boolean;
      apiKeyPreview: string;
      createdAt?: Date;
      updatedAt?: Date;
    }>
  > {
    const agents = await this.agentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return agents.map((agent) => ({
      agentId: agent.agentId,
      name: agent.name,
      apiKeyStorageMode: agent.apiKeyStorageMode ?? 'one_time',
      storedApiKeyAvailable: (agent.apiKeyStorageMode ?? 'one_time') === 'stored',
      apiKeyPreview: this.buildApiKeyPreview(agent.apiKeyId),
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    }));
  }

  async revealApiKey(
    userId: string,
    agentId: string,
  ): Promise<{ agentId: string; name: string; apiKey: string }> {
    const agent = await this.findOwnedAgent(userId, agentId, true);
    if ((agent.apiKeyStorageMode ?? 'one_time') !== 'stored') {
      throw new BadRequestException(
        'This agent uses one-time-only API keys. Regenerate the key and choose stored mode to reveal it later.',
      );
    }

    return {
      agentId: agent.agentId,
      name: agent.name,
      apiKey: this.decryptStoredApiKey(agent),
    };
  }

  async regenerateApiKey(
    userId: string,
    agentId: string,
    input: { storeApiKey?: boolean },
  ): Promise<CreateAgentResult> {
    const agent = await this.findOwnedAgent(userId, agentId, true);
    const storageMode =
      typeof input.storeApiKey === 'boolean'
        ? input.storeApiKey
          ? 'stored'
          : 'one_time'
        : (agent.apiKeyStorageMode ?? 'one_time');

    const nextState = this.createApiKeyState(storageMode);
    agent.apiKeyId = nextState.apiKeyId;
    agent.apiKeyHash = nextState.apiKeyHash;
    agent.apiKeySalt = nextState.apiKeySalt;
    agent.apiKeyStorageMode = storageMode;
    agent.encryptedApiKeyCiphertext = nextState.encryptedApiKeyCiphertext;
    agent.encryptedApiKeyIv = nextState.encryptedApiKeyIv;
    agent.encryptedApiKeyAuthTag = nextState.encryptedApiKeyAuthTag;
    await agent.save();

    return {
      agentId: agent.agentId,
      name: agent.name,
      apiKey: nextState.rawApiKey,
      apiKeyStorageMode: storageMode,
      storedApiKeyAvailable: storageMode === 'stored',
      apiKeyPreview: this.buildApiKeyPreview(agent.apiKeyId),
    };
  }

  async resolveAgentByApiKey(apiKey: string): Promise<AgentLookupResult> {
    const parsed = this.parseApiKey(apiKey);
    const agent = await this.agentModel
      .findOne({ apiKeyId: parsed.apiKeyId })
      .select('+apiKeyHash +apiKeySalt agentId name userId apiKeyId')
      .exec();

    if (!agent) {
      throw new UnauthorizedException('Invalid agent API key');
    }

    const incomingHash = this.hashApiKey(apiKey, agent.apiKeySalt);
    const expectedHash = Buffer.from(agent.apiKeyHash, 'hex');
    const actualHash = Buffer.from(incomingHash, 'hex');
    const isValid =
      expectedHash.length === actualHash.length &&
      timingSafeEqual(expectedHash, actualHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid agent API key');
    }

    return {
      agentId: agent.agentId,
      name: agent.name,
      userId: String(agent.userId),
    };
  }

  private async findOwnedAgent(
    userId: string,
    agentId: string,
    includeSecrets = false,
  ): Promise<Agent> {
    const query = this.agentModel.findOne({
      userId: new Types.ObjectId(userId),
      agentId,
    });

    if (includeSecrets) {
      query.select(
        '+apiKeyHash +apiKeySalt +encryptedApiKeyCiphertext +encryptedApiKeyIv +encryptedApiKeyAuthTag',
      );
    }

    const agent = await query.exec();
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return agent;
  }

  private createApiKeyState(storageMode: AgentApiKeyStorageMode): {
    apiKeyId: string;
    apiKeyHash: string;
    apiKeySalt: string;
    apiKeyStorageMode: AgentApiKeyStorageMode;
    encryptedApiKeyCiphertext?: string;
    encryptedApiKeyIv?: string;
    encryptedApiKeyAuthTag?: string;
    rawApiKey: string;
  } {
    const apiKeyId = randomBytes(8).toString('hex');
    const apiKeySecret = randomBytes(32).toString('hex');
    const apiKey = `agent_${apiKeyId}.${apiKeySecret}`;
    const apiKeySalt = randomBytes(16).toString('hex');
    const apiKeyHash = this.hashApiKey(apiKey, apiKeySalt);

    const encryption =
      storageMode === 'stored'
        ? this.encryptApiKey(apiKey)
        : {
            encryptedApiKeyCiphertext: undefined,
            encryptedApiKeyIv: undefined,
            encryptedApiKeyAuthTag: undefined,
          };

    return {
      apiKeyId,
      apiKeyHash,
      apiKeySalt,
      apiKeyStorageMode: storageMode,
      encryptedApiKeyCiphertext: encryption.encryptedApiKeyCiphertext,
      encryptedApiKeyIv: encryption.encryptedApiKeyIv,
      encryptedApiKeyAuthTag: encryption.encryptedApiKeyAuthTag,
      rawApiKey: apiKey,
    };
  }

  private parseApiKey(apiKey: string): { apiKeyId: string } {
    const trimmed = apiKey.trim();
    const [prefixAndId, secret] = trimmed.split('.');
    if (!prefixAndId || !secret || !prefixAndId.startsWith('agent_')) {
      throw new UnauthorizedException('Invalid agent API key');
    }

    const apiKeyId = prefixAndId.slice('agent_'.length);
    if (!apiKeyId) {
      throw new UnauthorizedException('Invalid agent API key');
    }

    return { apiKeyId };
  }

  private hashApiKey(apiKey: string, salt: string): string {
    return scryptSync(apiKey, salt, 64).toString('hex');
  }

  private buildApiKeyPreview(apiKeyId: string): string {
    return `agent_${apiKeyId}.****************`;
  }

  private encryptApiKey(apiKey: string): {
    encryptedApiKeyCiphertext: string;
    encryptedApiKeyIv: string;
    encryptedApiKeyAuthTag: string;
  } {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedApiKeyCiphertext: ciphertext.toString('hex'),
      encryptedApiKeyIv: iv.toString('hex'),
      encryptedApiKeyAuthTag: authTag.toString('hex'),
    };
  }

  private decryptStoredApiKey(agent: Agent): string {
    if (
      !agent.encryptedApiKeyCiphertext ||
      !agent.encryptedApiKeyIv ||
      !agent.encryptedApiKeyAuthTag
    ) {
      throw new BadRequestException('Stored API key is unavailable for this agent');
    }

    const key = this.getEncryptionKey();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(agent.encryptedApiKeyIv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(agent.encryptedApiKeyAuthTag, 'hex'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(agent.encryptedApiKeyCiphertext, 'hex')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  }

  private getEncryptionKey(): Buffer {
    const secret = this.configService.get<string>('AGENT_API_KEY_ENCRYPTION_SECRET')?.trim();
    if (!secret) {
      throw new BadRequestException(
        'Stored API keys are unavailable until AGENT_API_KEY_ENCRYPTION_SECRET is configured.',
      );
    }

    return scryptSync(secret, 'agent-api-key-encryption', 32);
  }
}
