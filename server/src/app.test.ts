import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { tokenHash } from './auth.js';
import type { Config } from './config.js';
import type { PrismaClient } from '@prisma/client';

const config: Config = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  PORT: 4000,
  CORS_ORIGINS: 'http://localhost:8081',
  GOOGLE_CLIENT_ID: 'test-client-id',
  JWT_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789',
  JWT_ISSUER: 'solace-test',
  GEMINI_API_KEY: '',
  GEMINI_MODEL: 'gemini-2.5-flash',
};
const user = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  googleId: 'google-1',
  email: 'person@example.com',
  name: 'Person',
  nickname: null,
  companionName: null,
  timezone: 'UTC',
};
function fixture(ready = true) {
  type Session = {
    id: string;
    userId: string;
    tokenHash: string;
    revokedAt: Date | null;
    expiresAt: Date;
    user: typeof user;
  };
  const sessions = new Map<string, Session>();
  const db = {
    $queryRaw: async () => {
      if (!ready) throw Error('database down');
      return [1];
    },
    user: { upsert: async () => user, findUnique: async () => user },
    refreshSession: {
      create: async ({
        data,
      }: {
        data: { userId: string; tokenHash: string; expiresAt: Date };
      }) => {
        const session: Session = { ...data, id: String(sessions.size + 1), revokedAt: null, user };
        sessions.set(data.tokenHash, session);
        return session;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        sessions.get(where.tokenHash) ?? null,
      updateMany: async ({ where }: { where: { id: string; revokedAt: null } }) => {
        const session = [...sessions.values()].find(
          (x) => x.id === where.id && x.revokedAt === where.revokedAt,
        );
        if (!session) return { count: 0 };
        session.revokedAt = new Date();
        return { count: 1 };
      },
    },
  };
  const app = createApp(config, db as unknown as PrismaClient, {
    verify: async () => ({ sub: user.googleId, email: user.email, name: user.name }),
  });
  return { app, sessions };
}
describe('foundation API', () => {
  it('reports health and database readiness separately', async () => {
    const { app } = fixture(false);
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/ready')).status).toBe(503);
  });
  it('rejects malformed input and missing authentication with standard errors', async () => {
    const { app } = fixture();
    expect((await request(app).post('/auth/google').send({ idToken: 'bad' })).body.error.code).toBe(
      'VALIDATION_ERROR',
    );
    expect((await request(app).get('/me')).body.error.code).toBe('UNAUTHORIZED');
  });
  it('rejects malformed JSON and invalid Google identities', async () => {
    const { app } = fixture();
    expect(
      (
        await request(app)
          .post('/auth/google')
          .set('Content-Type', 'application/json')
          .send('{oops')
      ).body.error.code,
    ).toBe('VALIDATION_ERROR');
    const rejected = createApp(
      config,
      { $queryRaw: async () => [1], user: {}, refreshSession: {} } as unknown as PrismaClient,
      {
        verify: async () => {
          throw Error('invalid');
        },
      },
    );
    const response = await request(rejected)
      .post('/auth/google')
      .send({ idToken: 'invalid-token-with-enough-length' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_GOOGLE_TOKEN');
  });
  it('rotates refresh tokens and rejects reuse', async () => {
    const { app, sessions } = fixture();
    const login = await request(app)
      .post('/auth/google')
      .send({ idToken: 'valid-test-token-with-enough-length' });
    expect(login.status).toBe(200);
    expect(sessions.has(tokenHash(login.body.refreshToken))).toBe(true);
    expect(
      (await request(app).get('/me').set('Authorization', `Bearer ${login.body.accessToken}`))
        .status,
    ).toBe(200);
    const refreshed = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);
    expect(
      (await request(app).post('/auth/refresh').send({ refreshToken: login.body.refreshToken }))
        .status,
    ).toBe(401);
  });
});
