import { Injectable, Logger } from '@nestjs/common';
import { AlertLike, Recommendation } from '../interfaces/recommendation.interface';
import { RecommendationRegistry } from '../registry/recommendation.registry';

@Injectable()
export class RecommendationEngineService {
  private readonly logger = new Logger(RecommendationEngineService.name);
  private readonly recommendations: Recommendation[];

  constructor() {
    this.recommendations = RecommendationRegistry;
  }

  generateRecommendations(alert: AlertLike): string[] {
    if (!alert?.ruleId) {
      this.logger.warn('Recommendation engine received alert without ruleId');
      return [];
    }

    const recommendation = this.recommendations.find((item) => item.ruleId === alert.ruleId);
    if (!recommendation) {
      this.logger.debug(`No recommendation found for ruleId=${alert.ruleId}`);
      return [];
    }

    return recommendation.generate(alert);
  }
}
