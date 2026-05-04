import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, context.getHandler()) ??
      Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, context.getClass()) ??
      [];

    if (!requiredPermissions.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const user = request.user;

    if (!user?.role) {
      throw new ForbiddenException('User does not have a role.');
    }

    if (user.role.name.toLowerCase() === 'master') {
      return true;
    }

    const userPermissions = new Set(
      user.role.permissions.map((permission) => permission.name),
    );

    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.has(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('User does not have permission.');
    }

    return true;
  }
}
