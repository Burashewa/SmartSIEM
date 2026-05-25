import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AgentIngestSecurityService } from '../agent-ingest-security.service';
import type { IngestRequestLike } from '../agent-security.utils';

type AgentRequest = IngestRequestLike & {
  agent?: {
    agentId: string;
    name: string;
    userId: string;
    allowedIps?: string[];
  };
};

@Injectable()
export class AgentIngestPolicyGuard implements CanActivate {
  constructor(private readonly security: AgentIngestSecurityService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    if (!request.agent) {
      return true;
    }
    this.security.assertAgentPolicyAllowed(request, request.agent);
    return true;
  }
}
