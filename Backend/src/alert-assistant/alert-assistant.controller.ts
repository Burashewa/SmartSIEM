import { Body, Controller, Post, Req } from '@nestjs/common';
import { AlertAssistantService } from './alert-assistant.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthJwtPayload } from '../auth/auth.types';

type AuthenticatedRequest = {
  user?: AuthJwtPayload;
};

interface ChatRequest {
  message?: string;
  alertId?: string;
}

@Controller('alert-assistant')
export class AlertAssistantController {
  constructor(private readonly assistantService: AlertAssistantService) {}

  @Post('chat')
  @Roles('security_analyst')
  async chat(@Req() request: AuthenticatedRequest, @Body() body: ChatRequest) {
    return this.assistantService.chat(request.user!, body ?? {});
  }
}
