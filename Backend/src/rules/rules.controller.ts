import { Controller, Get, Put, Param, Body } from '@nestjs/common';
import { RulesService } from './rules.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  @Roles('security_analyst')
  async getRules() {
    return this.rulesService.getRulesWithStats();
  }

  @Put(':id/toggle')
  @Roles('security_analyst')
  async toggleRule(@Param('id') id: string, @Body() body: { enabled: boolean }) {
    return this.rulesService.toggleRule(id, body.enabled);
  }
}