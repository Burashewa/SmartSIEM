import { Module } from '@nestjs/common';
import { RecommendationEngineService } from './engine/recommendation-engine.service';
import { RecommendationsService } from './recommendations.service';

@Module({
  providers: [RecommendationEngineService, RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
