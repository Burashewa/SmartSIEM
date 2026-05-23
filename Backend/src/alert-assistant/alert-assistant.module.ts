import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { AlertAssistantController } from './alert-assistant.controller';
import { AlertAssistantService } from './alert-assistant.service';

@Module({
  imports: [AlertsModule, RecommendationsModule],
  controllers: [AlertAssistantController],
  providers: [AlertAssistantService],
})
export class AlertAssistantModule {}
