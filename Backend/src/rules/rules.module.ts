import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RulesService } from './rules.service';
import { Log, LogSchema } from '../logs/log.schema';
import { AlertsModule } from '../alerts/alerts.module';
import { Alert, AlertSchema } from '../alerts/alert.schema';
import { RuleEngineService } from './engine/rule-engine.service';
import { RuleLoaderService } from './engine/rule-loader.service';
import { RuleContextService } from './engine/rule-context.service';
import { RecommendationsModule } from '../recommendations/recommendations.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Log.name, schema: LogSchema },
      { name: Alert.name, schema: AlertSchema },
    ]),
    AlertsModule,
    RecommendationsModule,
  ],
  providers: [RulesService, RuleEngineService, RuleLoaderService, RuleContextService],
  exports: [RulesService],
})
export class RulesModule {}
