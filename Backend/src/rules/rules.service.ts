import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Log } from '../logs/log.schema';
import { Alert } from '../alerts/alert.schema';
import { RuleEngineService } from './engine/rule-engine.service';
import { RuleLoaderService } from './engine/rule-loader.service';

@Injectable()
export class RulesService {
  constructor(
    private readonly ruleEngine: RuleEngineService,
    private readonly ruleLoader: RuleLoaderService,
    @InjectModel(Alert.name) private alertModel: Model<Alert>,
  ) {}

  // Evaluate rules for a newly ingested log
  async evaluate(newLog: Log): Promise<void> {
    await this.ruleEngine.evaluate(newLog);
  }

  async getRulesWithStats() {
    const rules = this.ruleLoader.getRules().map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      enabled: rule.enabled ?? true,
      severity: rule.severity,
      category: rule.tags?.[0] || 'General',
    }));

    // Get stats for each rule
    const statsPromises = rules.map(async (rule) => {
      const alerts = await this.alertModel.find({ ruleId: rule.id }).sort({ createdAt: -1 });
      const triggerCount = alerts.length;
      const lastTriggered = alerts.length > 0 && alerts[0].createdAt ? alerts[0].createdAt.toISOString() : null;
      return { ...rule, triggerCount, lastTriggered };
    });

    return Promise.all(statsPromises);
  }

  async toggleRule(id: string, enabled: boolean) {
    const updated = this.ruleLoader.setRuleEnabled(id, enabled);

    if (!updated) {
      throw new NotFoundException(`Rule ${id} was not found`);
    }

    return { id, enabled };
  }
}
