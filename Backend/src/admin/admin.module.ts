import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { SystemModule } from '../system/system.module';
import { RulesModule } from '../rules/rules.module';
import { Agent, AgentSchema } from '../agents/agent.schema';
import { Log, LogSchema } from '../logs/log.schema';
import { Alert, AlertSchema } from '../alerts/alert.schema';
import { AuthEvent, AuthEventSchema } from '../auth/schemas/auth-event.schema';

@Module({
  imports: [
    AuthModule,
    SystemModule,
    RulesModule,
    MongooseModule.forFeature([
      { name: Agent.name, schema: AgentSchema },
      { name: Log.name, schema: LogSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: AuthEvent.name, schema: AuthEventSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
