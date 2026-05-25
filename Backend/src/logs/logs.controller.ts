import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { CreateLogDto } from './log.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AgentApiKeyGuard } from '../agents/guards/agent-api-key.guard';
import { AgentTransportGuard } from '../agents/guards/agent-transport.guard';
import { AgentIngestPolicyGuard } from '../agents/guards/agent-ingest-policy.guard';
import { AuthJwtPayload } from '../auth/auth.types';

type AuthenticatedRequest = {
  user?: AuthJwtPayload;
  agent?: {
    agentId: string;
    name: string;
    userId: string;
    allowedIps?: string[];
  };
};

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  // POST /api/logs
  @Public()
  @Post()
  @UseGuards(AgentTransportGuard, AgentApiKeyGuard, AgentIngestPolicyGuard)
  async ingest(@Body() dto: CreateLogDto, @Req() request: AuthenticatedRequest) {
    return this.logsService.ingest(dto, request.agent!);
  }

  // GET /api/logs
  @Get()
  @Roles('security_analyst')
  async list(@Req() request: AuthenticatedRequest) {
    return this.logsService.list(request.user!);
  }

  // DELETE /api/logs
  @Delete(':id')
  @Roles('security_analyst')
  async remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.logsService.deleteOne(id, request.user!);
  }

  // DELETE /api/logs
  @Delete()
  @Roles('security_analyst')
  async clear(@Req() request: AuthenticatedRequest) {
    return this.logsService.clearAll(request.user!);
  }
}
