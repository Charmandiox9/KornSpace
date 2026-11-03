'use client';

import type { SessionContextValue, SessionProviderProps } from '@/types';

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { authenticatedFetch, subscribeToSessionExpiration } from '@/lib/api-client';
import { isAuthenticatedUser } from './is-authenticated-user';
import { createSessionStore } from './session-store';

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: SessionProviderProps) {
  const router = useRouter();
  const [store] = useState(() => createSessionStore(async () => {
    const response = await authenticatedFetch('/api/auth/me');
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return isAuthenticatedUser(payload) ? payload : null;
  }));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  useEffect(() => {
    const unsubscribe = subscribeToSessionExpiration(() => {
      const wasAuthenticated = store.getSnapshot().status === 'authenticated';
      store.updateUser(null);
      if (wasAuthenticated) router.replace('/login');
    });
    void store.initialize();
    return unsubscribe;
  }, [router, store]);

  const value = useMemo<SessionContextValue>(() => ({
    ...snapshot,
    updateUser: store.updateUser,
    async logout() {
      const response = await authenticatedFetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok && response.status !== 401) throw new Error('Logout failed');
      store.updateUser(null);
      router.replace('/login');
    },
  }), [router, snapshot, store]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used within SessionProvider');
  return session;
}
