import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AgentIngestSecurityService } from '../agent-ingest-security.service';
import type { IngestRequestLike } from '../agent-security.utils';

@Injectable()
export class AgentTransportGuard implements CanActivate {
  constructor(private readonly security: AgentIngestSecurityService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<IngestRequestLike>();
    this.security.assertTransportAllowed(request);
    return true;
  }
}
