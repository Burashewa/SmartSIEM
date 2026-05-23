import { Injectable, Logger } from '@nestjs/common';
import { DetectionRule } from '../interfaces/detection-rule.interface';
import { RULE_REGISTRY } from '../registry/rule.registry';

@Injectable()
export class RuleLoaderService {
  private readonly logger = new Logger(RuleLoaderService.name);
  private readonly rules: DetectionRule[];
  private readonly enabledStates: Map<string, boolean>;

  constructor() {
    this.rules = this.loadRules();
    this.enabledStates = new Map(this.rules.map((rule) => [rule.id, rule.enabled ?? true]));
  }

  getRules(): DetectionRule[] {
    return this.rules.map((rule) => ({
      ...rule,
      enabled: this.isRuleEnabled(rule.id),
    }));
  }

  hasRule(id: string): boolean {
    return this.enabledStates.has(id);
  }

  isRuleEnabled(id: string): boolean {
    return this.enabledStates.get(id) ?? false;
  }

  setRuleEnabled(id: string, enabled: boolean): boolean {
    if (!this.hasRule(id)) {
      return false;
    }

    this.enabledStates.set(id, enabled);
    return true;
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
