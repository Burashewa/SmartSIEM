import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AuthJwtPayload } from '../auth/auth.types';

type AuthenticatedRequest = {
  user?: AuthJwtPayload;
};

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  async createAgent(
    @Body() body: { name: string; storeApiKey?: boolean },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.agentsService.createAgent(request.user!.sub, body);
  }

  @Get()
  async listAgents(@Req() request: AuthenticatedRequest) {
    return this.agentsService.listAgents(request.user!.sub);
  }

  @Get(':agentId/api-key')
  async revealApiKey(
    @Param('agentId') agentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.agentsService.revealApiKey(request.user!.sub, agentId);
  }

  @Post(':agentId/regenerate')
  async regenerateApiKey(
    @Param('agentId') agentId: string,
    @Body() body: { storeApiKey?: boolean },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.agentsService.regenerateApiKey(request.user!.sub, agentId, body);
  }
}
