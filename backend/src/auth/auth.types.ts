export interface AuthenticatedUserContext {
  userId: string;
}

export interface AuthSessionRecord {
  userId: string;
  jwtId: string;
  createdAt: number;
}

export interface AuthSessionContext extends AuthSessionRecord {
  sessionId: string;
  sessionKey: string;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  jti: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export interface PublicUserResponse {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
}

export interface GoogleLoginResult {
  sessionId: string;
  accessToken: string;
  sessionTtlSeconds: number;
  accessTtlSeconds: number;
}

export interface OAuthStateRecord {
  nonce: string;
  codeVerifier: string;
  createdAt: number;
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
}
