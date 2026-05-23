import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AgentsService } from '../agents.service';

type AgentRequest = {
  headers: Record<string, string | undefined>;
  agent?: {
    agentId: string;
    name: string;
    userId: string;
  };
};

@Injectable()
export class AgentApiKeyGuard implements CanActivate {
  constructor(private readonly agentsService: AgentsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AgentRequest>();
    const authHeader = request.headers.authorization ?? '';
    const [scheme, apiKey] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !apiKey) {
      throw new UnauthorizedException('Missing agent API key');
    }

    request.agent = await this.agentsService.resolveAgentByApiKey(apiKey);
    return true;
  }
}
