import { Injectable } from '@nestjs/common';
import { Log } from '../logs/log.schema';
import { RuleEngineService } from './engine/rule-engine.service';

@Injectable()
export class RulesService {
  constructor(private readonly ruleEngine: RuleEngineService) {}

  // Evaluate rules for a newly ingested log
  async evaluate(newLog: Log): Promise<void> {
    await this.ruleEngine.evaluate(newLog);
  }
}
