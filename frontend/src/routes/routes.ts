export const routePaths = {
  login: '/login',
  onboarding: '/onboarding',
  files: '/files',
} as const;

export type AppRoute = (typeof routePaths)[keyof typeof routePaths];
export type AuthenticationStatus = 'loading' | 'authenticated' | 'anonymous';

export function resolveAppRoute(
  authenticationStatus: AuthenticationStatus,
  hasUsername: boolean,
): AppRoute | null {
  if (authenticationStatus === 'loading') return null;
  if (authenticationStatus === 'anonymous') return routePaths.login;
  return hasUsername ? routePaths.files : routePaths.onboarding;
}
