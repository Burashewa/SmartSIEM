import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AuthJwtPayload } from '../auth/auth.types';
import { Roles } from '../auth/decorators/roles.decorator';

type AuthenticatedRequest = {
  user?: AuthJwtPayload;
};

@Controller('agents')
@Roles('security_analyst')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  async createAgent(
    @Body() body: { name: string; storeApiKey?: boolean; allowedIps?: string[] },
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

  @Put(':agentId')
  async updateAgent(
    @Param('agentId') agentId: string,
    @Body() body: { name?: string; allowedIps?: string[] },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.agentsService.updateAgent(request.user!.sub, agentId, body);
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
