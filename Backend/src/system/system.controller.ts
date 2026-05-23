import { Controller, Get } from '@nestjs/common';
import { SystemService } from './system.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Public()
  @Get('status')
  async getStatus() {
    return this.systemService.getStatus();
  }
}
