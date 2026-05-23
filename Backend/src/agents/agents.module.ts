import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Agent, AgentSchema } from './agent.schema';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentApiKeyGuard } from './guards/agent-api-key.guard';

@Module({
  imports: [MongooseModule.forFeature([{ name: Agent.name, schema: AgentSchema }])],
  controllers: [AgentsController],
  providers: [AgentsService, AgentApiKeyGuard],
  exports: [AgentsService, AgentApiKeyGuard, MongooseModule],
})
export class AgentsModule {}
