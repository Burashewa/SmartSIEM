import { Injectable, Logger } from '@nestjs/common';
import { DetectionRule } from '../interfaces/detection-rule.interface';
import { RULE_REGISTRY } from '../registry/rule.registry';

@Injectable()
export class RuleLoaderService {
  private readonly logger = new Logger(RuleLoaderService.name);
  private readonly rules: DetectionRule[];

  constructor() {
    this.rules = this.loadRules();
  }

  getRules(): DetectionRule[] {
    return this.rules;
  }

  private loadRules(): DetectionRule[] {
    const seenIds = new Set<string>();
    const deduped: DetectionRule[] = [];

    for (const rule of RULE_REGISTRY) {
      if (!rule?.id) {
        this.logger.warn('Skipping rule with missing id');
        continue;
      }

      if (seenIds.has(rule.id)) {
        this.logger.warn(`Duplicate rule id detected: ${rule.id}. Skipping duplicate.`);
        continue;
      }

      seenIds.add(rule.id);
      deduped.push(rule);
    }

    return deduped;
  }
}
