import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuthService } from '../auth/auth.service';
import { SiemRole } from '../auth/auth.types';
import { Agent } from '../agents/agent.schema';
import { Alert } from '../alerts/alert.schema';
import { Log } from '../logs/log.schema';
import { SystemService } from '../system/system.service';
import { RulesService } from '../rules/rules.service';
import { AuthEvent } from '../auth/schemas/auth-event.schema';

type AdminRequestContext = {
  actor: string;
  sourceIp?: string;
  userAgent?: string;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly authService: AuthService,
    private readonly systemService: SystemService,
    private readonly rulesService: RulesService,
    @InjectModel(Agent.name) private readonly agentModel: Model<Agent>,
    @InjectModel(Log.name) private readonly logModel: Model<Log>,
    @InjectModel(Alert.name) private readonly alertModel: Model<Alert>,
    @InjectModel(AuthEvent.name) private readonly authEventModel: Model<AuthEvent>,
  ) {}

  async getOverview() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last24hAuth = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      users,
      systemStatus,
      rules,
      logsLast24h,
      openAlerts,
      alertsBySeverity,
      failedLogins24h,
      totalAgents,
      recentAudit,
    ] = await Promise.all([
      this.authService.countUsersSummary(),
      this.systemService.getStatus(),
      this.rulesService.getRulesWithStats(),
      this.logModel.countDocuments({ timestamp: { $gte: last24h } }),
      this.alertModel.countDocuments({ status: { $ne: 'resolved' } }),
      this.alertModel.aggregate<{ _id: string; count: number }>([
        { $match: { status: { $ne: 'resolved' } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      this.authEventModel.countDocuments({
        action: 'auth.login',
        outcome: 'failure',
        createdAt: { $gte: last24hAuth },
      }),
      this.agentModel.countDocuments(),
      this.authService.listAuditEventsForAdmin({ limit: 10, offset: 0 }),
    ]);

    const enabledRules = rules.filter((r) => r.enabled).length;
    const severityMap: Record<string, number> = {};
    for (const row of alertsBySeverity) {
      severityMap[String(row._id).toLowerCase()] = row.count;
    }

    return {
      generatedAt: now.toISOString(),
      users,
      system: systemStatus,
      ingestion: {
        logsLast24h,
        eps: systemStatus.ingestionRate.eps,
        logsLastMinute: systemStatus.ingestionRate.logsLastMinute,
      },
      alerts: {
        open: openAlerts,
        critical: severityMap.critical ?? 0,
        high: severityMap.high ?? 0,
        medium: severityMap.medium ?? 0,
        low: severityMap.low ?? 0,
        bySeverity: severityMap,
      },
      rules: {
        total: rules.length,
        enabled: enabledRules,
        disabled: rules.length - enabledRules,
      },
      agents: { total: totalAgents },
      security: { failedLogins24h },
      recentAudit: recentAudit.items,
    };
  }

  async listUsers() {
    const users = await this.authService.listUsersForAdmin();
    const agentCounts = await this.agentModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const countByUserId = new Map(agentCounts.map((row) => [String(row._id), row.count]));

    return {
      items: users.map((user) => ({
        ...user,
        agentCount: countByUserId.get(user.id) ?? 0,
      })),
      total: users.length,
    };
  }

  async getUser(username: string) {
    const user = await this.authService.getUserForAdmin(username);
    const agentCount = await this.agentModel.countDocuments({
      userId: new Types.ObjectId(user.id),
    });
    const agents = await this.agentModel
      .find({ userId: new Types.ObjectId(user.id) })
      .select('agentId name createdAt updatedAt apiKeyStorageMode')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return {
      user: { ...user, agentCount },
      agents: agents.map((a) => ({
        agentId: a.agentId,
        name: a.name,
        apiKeyStorageMode: a.apiKeyStorageMode,
        createdAt: a.createdAt?.toISOString(),
        updatedAt: a.updatedAt?.toISOString(),
      })),
    };
  }

  createUser(
    body: { username: string; password: string; role: SiemRole },
    ctx: AdminRequestContext,
  ) {
    return this.authService.createUser({
      username: body.username,
      password: body.password,
      role: body.role,
      actor: ctx.actor,
      sourceIp: ctx.sourceIp,
    });
  }

  updateUser(
    username: string,
    body: { role?: SiemRole; isActive?: boolean },
    ctx: AdminRequestContext,
  ) {
    return this.authService.updateUserAsAdmin({
      username,
      role: body.role,
      isActive: body.isActive,
      actor: ctx.actor,
      sourceIp: ctx.sourceIp,
      userAgent: ctx.userAgent,
    });
  }

  unlockUser(username: string, ctx: AdminRequestContext) {
    return this.authService.unlockUserAsAdmin({
      username,
      actor: ctx.actor,
      sourceIp: ctx.sourceIp,
      userAgent: ctx.userAgent,
    });
  }

  resetPassword(
    username: string,
    password: string,
    ctx: AdminRequestContext,
  ) {
    return this.authService.resetPasswordAsAdmin({
      username,
      password,
      actor: ctx.actor,
      sourceIp: ctx.sourceIp,
      userAgent: ctx.userAgent,
    });
  }

  listAudit(query: {
    limit?: number;
    offset?: number;
    username?: string;
    action?: string;
    since?: string;
    until?: string;
  }) {
    return this.authService.listAuditEventsForAdmin(query);
  }

  async listAllAgents() {
    const agents = await this.agentModel
      .find()
      .select('agentId name userId apiKeyStorageMode createdAt updatedAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const users = await this.authService.listUsersForAdmin();
    const usernameById = new Map(users.map((u) => [u.id, u.username]));

    return {
      items: agents.map((a) => ({
        agentId: a.agentId,
        name: a.name,
        userId: String(a.userId),
        ownerUsername: usernameById.get(String(a.userId)) ?? null,
        apiKeyStorageMode: a.apiKeyStorageMode,
        createdAt: a.createdAt?.toISOString(),
        updatedAt: a.updatedAt?.toISOString(),
      })),
      total: agents.length,
    };
  }
}
