export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  pictureUrl: string | null;
}

export type AuthenticationStatus = 'loading' | 'authenticated' | 'anonymous';

export interface SessionSnapshot {
  status: AuthenticationStatus;
  user: AuthenticatedUser | null;
}

export interface SessionStore {
  getSnapshot: () => SessionSnapshot;
  getServerSnapshot: () => SessionSnapshot;
  subscribe: (listener: () => void) => () => void;
  updateUser: (user: AuthenticatedUser | null) => void;
  initialize: () => Promise<void>;
}

export interface SessionContextValue extends SessionSnapshot {
  updateUser: (user: AuthenticatedUser | null) => void;
  logout: () => Promise<void>;
}
