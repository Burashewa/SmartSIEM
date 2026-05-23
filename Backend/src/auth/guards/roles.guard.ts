import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { SiemRole } from '../auth.types';

const roleWeight: Record<SiemRole, number> = {
  security_analyst: 20,
  admin: 40,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SiemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: { role?: SiemRole } }>();
    const currentRole = request.user?.role;
    if (!currentRole) {
      throw new ForbiddenException('Role is required');
    }

    const allowed = requiredRoles.some((requiredRole) => roleWeight[currentRole] >= roleWeight[requiredRole]);
    if (!allowed) {
      throw new ForbiddenException('Insufficient privileges');
    }
    return true;
  }
}
