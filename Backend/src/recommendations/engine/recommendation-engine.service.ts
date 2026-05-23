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
    const alertRuleId = alert?.ruleId ?? (alert as { rule_id?: string })?.rule_id;
    if (!alertRuleId) {
      this.logger.warn('Recommendation engine received alert without ruleId/rule_id');
      return [];
    }

    const recommendation = this.recommendations.find((item) => item.ruleId === alertRuleId);
    if (!recommendation) {
      this.logger.debug(`No recommendation found for ruleId=${alertRuleId}`);
      return [];
    }

    return recommendation.generate(alert);
  }
}
