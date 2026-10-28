import type { Request } from 'express';
import type { AuthSessionContext, AuthenticatedUserContext } from './auth.types';

export interface AuthenticatedRequest extends Request {
  authContext?: AuthenticatedUserContext;
  authSession?: AuthSessionContext;
}
