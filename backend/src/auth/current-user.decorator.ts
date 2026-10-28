import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth-request.types';
import type { AuthenticatedUserContext } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUserContext => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authContext) {
      throw new UnauthorizedException('La sesión no está autenticada.');
    }
    return request.authContext;
  },
);
