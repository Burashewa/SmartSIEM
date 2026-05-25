import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Alert, AlertSchema } from '../alerts/alert.schema';
import { Log, LogSchema } from '../logs/log.schema';
import { Agent, AgentSchema } from '../agents/agent.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Log.name, schema: LogSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
