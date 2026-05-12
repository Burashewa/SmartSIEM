import type { Alert, LogEntry } from './api.types';

export type WsEventType = 'alert.new' | 'log.new' | 'stats.update';

export interface WsEnvelope<TType extends WsEventType, TData> {
  type: TType;
  data: TData;
}

export type AlertEvent = WsEnvelope<'alert.new', Alert>;
export type LogEvent = WsEnvelope<'log.new', LogEntry>;
export type StatsEvent = WsEnvelope<'stats.update', Record<string, unknown>>;

export type WsEvent = AlertEvent | LogEvent | StatsEvent;
