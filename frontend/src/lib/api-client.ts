import type { ApiClient, RequestTransport } from '../types';
export function apiUrl(path: string): string {
  return path;
}

export function createApiClient(fetcher: typeof fetch = (...args) => fetch(...args)): ApiClient {
  const expirationListeners = new Set<() => void>();
  let refreshInFlight: Promise<Response> | null = null;
  let sessionExpired = false;

  function expireSession(): void {
    if (sessionExpired) return;
    sessionExpired = true;
    expirationListeners.forEach((listener) => listener());
  }

  function observeSessionResponse(input: string, response: Response): void {
    if (!response.ok) return;
    if (input === '/api/auth/me') sessionExpired = false;
    if (input === '/api/auth/logout') sessionExpired = true;
  }

  async function authenticatedRequest(input: string, init: RequestInit = {}, transport: RequestTransport = fetcher): Promise<Response> {
    const options: RequestInit = { ...init, credentials: 'same-origin', cache: 'no-store' };
    options.signal?.throwIfAborted();
    const response = await transport(apiUrl(input), options);
    observeSessionResponse(input, response);
    if (response.status !== 401 || sessionExpired) return response;

    if (!refreshInFlight) {
      refreshInFlight = fetcher(apiUrl('/api/auth/refresh'), {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
      }).finally(() => { refreshInFlight = null; });
    }
    let refresh: Response;
    try {
      refresh = await refreshInFlight;
    } catch (error: unknown) {
      expireSession();
      throw error;
    }
    if (!refresh.ok) {
      expireSession();
      return response;
    }

    options.signal?.throwIfAborted();
    const retry = await transport(apiUrl(input), options);
    observeSessionResponse(input, retry);
    if (retry.status === 401) expireSession();
    return retry;
  }

  return {
    authenticatedFetch: authenticatedRequest,
    authenticatedRequest,
    subscribeToSessionExpiration(listener: () => void): () => void {
      expirationListeners.add(listener);
      return () => { expirationListeners.delete(listener); };
    },
  };
}

export const { authenticatedFetch, authenticatedRequest, subscribeToSessionExpiration } = createApiClient();
