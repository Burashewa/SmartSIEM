import { Injectable } from '@nestjs/common';
import { AlertLike } from './interfaces/recommendation.interface';
import { RecommendationEngineService } from './engine/recommendation-engine.service';

@Injectable()
export class RecommendationsService {
  constructor(private readonly engine: RecommendationEngineService) {}

  getRecommendations(alert: AlertLike): string[] {
    return this.engine.generateRecommendations(alert);
  }
}
