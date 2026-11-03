export interface ApiClient {
  authenticatedFetch: (input: string, init?: RequestInit) => Promise<Response>;
  authenticatedRequest: (input: string, init: RequestInit, transport: RequestTransport) => Promise<Response>;
  subscribeToSessionExpiration: (listener: () => void) => () => void;
}

export type RequestTransport = (input: string, init: RequestInit) => Promise<Response>;
