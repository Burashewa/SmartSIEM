import { Module } from '@nestjs/common';
import { MaliciousIpService } from './malicious-ip.service';

@Module({
  providers: [MaliciousIpService],
  exports: [MaliciousIpService],
})
export class ThreatIntelModule {}
