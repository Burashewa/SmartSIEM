import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Log } from './log.schema';
import { CreateLogDto } from './log.dto';
import { LogNormalizer } from './log.normalizer';
import { RulesService } from '../rules/rules.service';
import { AuthJwtPayload } from '../auth/auth.types';
import { NormalizedLog } from './log.types';

type AgentIngestionContext = {
  agentId: string;
  name: string;
  userId: string;
};

@Injectable()
export class LogsService {
  constructor(
    @InjectModel(Log.name) private readonly logModel: Model<Log>,
    private readonly normalizer: LogNormalizer,
    private readonly rulesService: RulesService,
  ) {}

  // Ingest log, normalize, store, then run rules
  async ingest(dto: CreateLogDto, agent: AgentIngestionContext): Promise<Log | Log[]> {
    const normalized = this.normalizer
      .normalize(dto)
      .map((log) => this.attachOwnership(log, dto, agent));
    const created = await this.logModel.create(normalized);
    const createdLogs = Array.isArray(created) ? created : [created];

    // Rule engine can be async and best-effort
    await Promise.all(createdLogs.map((log) => this.rulesService.evaluate(log)));

    return Array.isArray(created) ? created : createdLogs[0];
  }

  async list(user: AuthJwtPayload): Promise<Log[]> {
    return this.logModel
      .find(this.buildOwnershipFilter(user))
      .sort({ timestamp: -1 })
      .limit(100)
      .exec();
  }

  // Clear all logs from the database
  async clearAll(user: AuthJwtPayload): Promise<{ deletedCount: number }> {
    const result = await this.logModel.deleteMany(this.buildOwnershipFilter(user));
    return { deletedCount: result.deletedCount ?? 0 };
  }

  async deleteOne(id: string, user: AuthJwtPayload): Promise<{ deletedCount: number }> {
    const ownershipFilter = this.buildOwnershipFilter(user);
    const idFilters: Array<Record<string, unknown>> = [{ event_id: id }];

    if (Types.ObjectId.isValid(id)) {
      idFilters.push({ _id: new Types.ObjectId(id) });
    }

    const result = await this.logModel
      .deleteOne({
        ...ownershipFilter,
        $or: idFilters,
      })
      .exec();

    const deletedCount = result.deletedCount ?? 0;
    if (deletedCount === 0) {
      throw new NotFoundException(`Log ${id} not found`);
    }

    return { deletedCount };
  }

  private attachOwnership(
    log: NormalizedLog,
    dto: CreateLogDto,
    agent: AgentIngestionContext,
  ): NormalizedLog {
    return {
      ...log,
      agentId: agent.agentId,
      userId: agent.userId,
      level: this.readMessagePart(log.level) ?? this.readMessagePart(log.severity) ?? 'info',
      message:
        this.readMessagePart(log.message) ??
        this.readRecordMessage(log.raw) ??
        this.readMessagePart(dto.message) ??
        this.readMessagePart(dto.log) ??
        this.readMessagePart(dto.line) ??
        this.readMessagePart(dto.rawLine) ??
        this.deriveFallbackMessage(log, agent),
    };
  }

  private deriveFallbackMessage(log: NormalizedLog, agent: AgentIngestionContext): string {
    const parts = [log.event, log.action, log.status]
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => value.replace(/_/g, ' '));

    if (parts.length > 0) {
      return parts.join(' ');
    }

    return `Log received from ${agent.name}`;
  }

  private readRecordMessage(raw: unknown): string | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return undefined;
    }

    const rawRecord = raw as Record<string, unknown>;
    return (
      this.readMessagePart(rawRecord.message) ??
      this.readMessagePart(rawRecord.msg) ??
      this.readMessagePart(rawRecord.log)
    );
  }

  private readMessagePart(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }

  private buildOwnershipFilter(user: AuthJwtPayload): Record<string, unknown> {
    if (user.role === 'admin') {
      return {};
    }

    return { userId: new Types.ObjectId(user.sub) };
  }
}
