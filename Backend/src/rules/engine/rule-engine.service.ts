import { Injectable, Logger } from '@nestjs/common';
import { Log } from '../../logs/log.schema';
import { DetectionRule } from '../interfaces/detection-rule.interface';
import { RuleContextService } from './rule-context.service';
import { RuleLoaderService } from './rule-loader.service';

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(
    private readonly ruleLoader: RuleLoaderService,
    private readonly contextService: RuleContextService,
  ) {}

  async evaluate(log: Log): Promise<void> {
    const rules = this.ruleLoader.getRules();
    await Promise.all(rules.map((rule) => this.evaluateRule(rule, log)));
  }

  private async evaluateRule(rule: DetectionRule, log: Log): Promise<void> {
    if (rule.enabled === false) return;
    if (rule.matches && !rule.matches(log)) return;

    const context = this.contextService.build(rule.id);

    try {
      await rule.evaluate(log, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Rule ${rule.id} failed: ${message}`, stack);
    }
  }
}
