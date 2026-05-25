import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AgentIngestRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly configService: ConfigService) {}

  assertAllowed(agentId: string, clientIp: string): void {
    const windowMs = 60 * 60 * 1000;
    const now = Date.now();
    const maxPerAgent = Number(
      this.configService.get<string>('AGENT_INGEST_MAX_PER_HOUR_PER_AGENT') ?? 5000,
    );
    const maxPerIp = Number(
      this.configService.get<string>('AGENT_INGEST_MAX_PER_HOUR_PER_IP') ?? 500,
    );

    this.assertBucket(`agent:${agentId}`, maxPerAgent, windowMs, now);
    this.assertBucket(`ip:${clientIp}`, maxPerIp, windowMs, now);
  }

  private assertBucket(
    bucketKey: string,
    max: number,
    windowMs: number,
    now: number,
  ): void {
    const recent = (this.hits.get(bucketKey) ?? []).filter((ts) => now - ts < windowMs);
    if (recent.length >= max) {
      throw new HttpException(
        'Too many log ingest requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(bucketKey, recent);
  }
}
