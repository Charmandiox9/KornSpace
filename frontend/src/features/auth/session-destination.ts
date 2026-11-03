import type { AuthenticationStatus } from '../../types';

export function getSessionDestination(
  authenticationStatus: AuthenticationStatus,
  hasUsername: boolean,
): '/login' | '/onboarding' | '/files' | null {
  if (authenticationStatus === 'loading') return null;
  if (authenticationStatus === 'anonymous') return '/login';
  return hasUsername ? '/files' : '/onboarding';
}
