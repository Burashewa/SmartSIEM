import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type IngestRequestLike,
  getClientIp,
  isIpAllowed,
  isSecureRequest,
  parseAllowedIpList,
} from './agent-security.utils';
import { AgentIngestRateLimiter } from './agent-ingest-rate-limiter.service';

@Injectable()
export class AgentIngestSecurityService {
  private readonly globalAllowedIps: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimiter: AgentIngestRateLimiter,
  ) {
    this.globalAllowedIps = parseAllowedIpList(
      this.configService.get<string>('AGENT_INGEST_ALLOWED_IPS'),
    );
  }

  assertTransportAllowed(request: IngestRequestLike): void {
    const requireHttps =
      (this.configService.get<string>('AGENT_INGEST_REQUIRE_HTTPS') ?? 'false').toLowerCase() ===
      'true';

    if (requireHttps && !isSecureRequest(request)) {
      throw new ForbiddenException(
        'Agent ingest requires HTTPS. Use https:// for your SIEM API URL.',
      );
    }

    const clientIp = getClientIp(request);
    if (!isIpAllowed(clientIp, this.globalAllowedIps)) {
      throw new ForbiddenException('Agent ingest is not allowed from this IP address');
    }
  }

  assertAgentPolicyAllowed(
    request: IngestRequestLike,
    agent: { agentId: string; allowedIps?: string[] },
  ): void {
    const clientIp = getClientIp(request);
    const agentIps = (agent.allowedIps ?? []).map((ip) => ip.trim()).filter(Boolean);

    if (agentIps.length > 0 && !isIpAllowed(clientIp, agentIps)) {
      throw new ForbiddenException(
        'This agent is not allowed to ingest logs from your current IP address',
      );
    }

    this.rateLimiter.assertAllowed(agent.agentId, clientIp);
  }
}
