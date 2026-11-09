import { createHash, randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { SignJWT, jwtVerify } from 'jose';
import type { Config } from './config.js';
import { HttpError } from './errors.js';

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
}
export interface GoogleVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

export function makeGoogleVerifier(clientId: string | string[]): GoogleVerifier {
  const audiences = (Array.isArray(clientId) ? clientId : clientId.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  const google = new OAuth2Client(audiences[0]);
  return {
    async verify(idToken) {
      const ticket = await google.verifyIdToken({ idToken, audience: audiences });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email || !payload.email_verified)
        throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'Google sign-in failed');
      return { sub: payload.sub, email: payload.email, name: payload.name ?? null };
    },
  };
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
export function newRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}
export async function signAccessToken(userId: string, config: Config): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(config.JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(config.JWT_SECRET));
}
export function requireAuth(config: Config): RequestHandler {
  return async (req, _res, next) => {
    try {
      const token = /^Bearer (.+)$/.exec(req.get('authorization') ?? '')?.[1];
      if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required');
      const { payload } = await jwtVerify(token, new TextEncoder().encode(config.JWT_SECRET), {
        issuer: config.JWT_ISSUER,
        algorithms: ['HS256'],
      });
      if (!payload.sub) throw new Error('Missing subject');
      req.userId = payload.sub;
      next();
    } catch {
      next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
    }
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}
