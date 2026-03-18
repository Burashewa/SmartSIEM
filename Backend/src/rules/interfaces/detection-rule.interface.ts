import { Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { AlertsService } from '../../alerts/alerts.service';
import { Log } from '../../logs/log.schema';

export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AlertEnrichment {
  ipReputation?: {
    classification: 'internal' | 'unknown';
    source: string;
  };
  geo?: {
    latitude: number;
    longitude: number;
    source: string;
  };
  previousAlertsFromIp?: number;
  userRiskScore?: number;
}

export interface AlertInput {
  ruleId: string;
  message: string;
  severity: RuleSeverity | string;
  ip?: string;
  triggeredAt?: Date;
  context?: Record<string, unknown>;
}

export interface RuleContext {
  logModel: Model<Log>;
  alertsService: AlertsService;
  logger: Logger;
  emitAlert: (input: AlertInput, log: Log) => Promise<void>;
}

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  severity: RuleSeverity;
  tags?: string[];
  enabled?: boolean;
  matches?: (log: Log) => boolean;
  evaluate: (log: Log, context: RuleContext) => Promise<void>;
}
