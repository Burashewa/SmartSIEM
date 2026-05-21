import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Alert, AlertSchema } from '../alerts/alert.schema';
import { AlertsModule } from '../alerts/alerts.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { ReportsController } from './reports.controller';
import { ReportAiChatService } from './report-ai-chat.service';
import { ReportAiEnrichmentService } from './report-ai-enrichment.service';
import { ReportsService } from './reports.service';
import { ReportsSchedulerService } from './reports.scheduler';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Alert.name, schema: AlertSchema }]),
    AlertsModule,
    RecommendationsModule,
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportsSchedulerService,
    ReportAiEnrichmentService,
    ReportAiChatService,
  ],
})
export class ReportsModule {}
