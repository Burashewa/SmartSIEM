import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthJwtPayload, SiemRole } from '../auth/auth.types';
import { AdminService } from './admin.service';

type AdminRequest = {
  ip?: string;
  headers?: Record<string, string>;
  user?: AuthJwtPayload;
};

@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private ctx(request: AdminRequest) {
    return {
      actor: request.user?.username ?? 'admin',
      sourceIp: request.ip ?? '',
      userAgent: request.headers?.['user-agent'] ?? '',
    };
  }

  /** GET /api/admin/overview */
  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  /** GET /api/admin/users */
  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  /** GET /api/admin/users/:username */
  @Get('users/:username')
  getUser(@Param('username') username: string) {
    return this.adminService.getUser(username);
  }

  /** POST /api/admin/users */
  @Post('users')
  createUser(
    @Body() body: { username: string; password: string; role: SiemRole },
    @Req() request: AdminRequest,
  ) {
    return this.adminService.createUser(body, this.ctx(request));
  }

  /** PATCH /api/admin/users/:username */
  @Patch('users/:username')
  updateUser(
    @Param('username') username: string,
    @Body() body: { role?: SiemRole; isActive?: boolean },
    @Req() request: AdminRequest,
  ) {
    return this.adminService.updateUser(username, body, this.ctx(request));
  }

  /** POST /api/admin/users/:username/unlock */
  @Post('users/:username/unlock')
  unlockUser(@Param('username') username: string, @Req() request: AdminRequest) {
    return this.adminService.unlockUser(username, this.ctx(request));
  }

  /** POST /api/admin/users/:username/reset-password */
  @Post('users/:username/reset-password')
  resetPassword(
    @Param('username') username: string,
    @Body() body: { password: string },
    @Req() request: AdminRequest,
  ) {
    return this.adminService.resetPassword(username, body.password, this.ctx(request));
  }

  /** GET /api/admin/audit */
  @Get('audit')
  listAudit(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('username') username?: string,
    @Query('action') action?: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
  ) {
    return this.adminService.listAudit({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      username,
      action,
      since,
      until,
    });
  }

  /** GET /api/admin/agents */
  @Get('agents')
  listAgents() {
    return this.adminService.listAllAgents();
  }
}
