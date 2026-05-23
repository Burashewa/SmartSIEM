import { SetMetadata } from '@nestjs/common';
import { SiemRole } from '../auth.types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: SiemRole[]) => SetMetadata(ROLES_KEY, roles);
