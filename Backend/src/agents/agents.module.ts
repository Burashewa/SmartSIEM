import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Agent, AgentSchema } from './agent.schema';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentApiKeyGuard } from './guards/agent-api-key.guard';
import { AgentTransportGuard } from './guards/agent-transport.guard';
import { AgentIngestPolicyGuard } from './guards/agent-ingest-policy.guard';
import { AgentIngestSecurityService } from './agent-ingest-security.service';
import { AgentIngestRateLimiter } from './agent-ingest-rate-limiter.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Agent.name, schema: AgentSchema }])],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    AgentApiKeyGuard,
    AgentTransportGuard,
    AgentIngestPolicyGuard,
    AgentIngestSecurityService,
    AgentIngestRateLimiter,
  ],
  exports: [
    AgentsService,
    AgentApiKeyGuard,
    AgentTransportGuard,
    AgentIngestPolicyGuard,
    AgentIngestSecurityService,
    AgentIngestRateLimiter,
    MongooseModule,
  ],
})
export class AgentsModule {}
