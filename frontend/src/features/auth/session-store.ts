import type { AuthenticatedUser, SessionSnapshot, SessionStore } from '../../types';

const initialSnapshot: SessionSnapshot = { status: 'loading', user: null };

export function createSessionStore(loadUser: () => Promise<AuthenticatedUser | null>): SessionStore {
  let snapshot = initialSnapshot;
  let initialization: Promise<void> | null = null;
  let version = 0;
  const listeners = new Set<() => void>();

  function updateUser(user: AuthenticatedUser | null): void {
    version += 1;
    snapshot = { status: user ? 'authenticated' : 'anonymous', user };
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    updateUser,
    initialize(): Promise<void> {
      if (!initialization) {
        const requestedVersion = version;
        initialization = Promise.resolve().then(loadUser).catch(() => null).then((user) => {
          if (requestedVersion === version) updateUser(user);
        });
      }
      return initialization;
    },
  };
}
