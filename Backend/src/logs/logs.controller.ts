import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { CreateLogDto } from './log.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AgentApiKeyGuard } from '../agents/guards/agent-api-key.guard';
import { AuthJwtPayload } from '../auth/auth.types';

type AuthenticatedRequest = {
  user?: AuthJwtPayload;
  agent?: {
    agentId: string;
    name: string;
    userId: string;
  };
};

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  // POST /api/logs
  @Public()
  @Post()
  @UseGuards(AgentApiKeyGuard)
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
  @Delete()
  @Roles('security_analyst')
  async clear(@Req() request: AuthenticatedRequest) {
    return this.logsService.clearAll(request.user!);
  }
}
