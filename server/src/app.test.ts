import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { signAccessToken, tokenHash } from './auth.js';
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
  EXPO_PUSH_ACCESS_TOKEN: '',
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
  const moods = new Map<string, { id: string; userId: string; score: number }>();
  let messageCount = 0;
  const db = {
    $queryRaw: async () => {
      if (!ready) throw Error('database down');
      return [1];
    },
    user: { upsert: async () => user, findUnique: async () => user },
    conversation: {
      create: async () => ({ id: 'da375410-51ec-4ef5-a480-4ca9a7d10a3f', title: 'Test chat' }),
    },
    message: {
      create: async ({ data }: { data: object }) => ({ ...data, id: String(++messageCount) }),
      count: async () => messageCount,
    },
    moodEntry: {
      findMany: async () => [...moods.values()],
      create: async ({ data }: { data: { id: string; userId: string; score: number } }) => {
        if (moods.has(data.id)) throw Object.assign(new Error('duplicate mood'), { code: 'P2002' });
        moods.set(data.id, data);
        return data;
      },
      findFirstOrThrow: async ({ where }: { where: { id: string; userId: string } }) => {
        const mood = moods.get(where.id);
        if (mood?.userId !== where.userId) throw new Error('Mood not found');
        return mood;
      },
    },
    xpEvent: {
      create: async () => {
        throw Object.assign(new Error('XP already awarded'), { code: 'P2002' });
      },
    },
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
  return { app, sessions, moods };
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

describe('chat mood check-ins', () => {
  it.each(['/chat', '/chat/stream'])(
    'only adds a picker for explicit requests on %s',
    async (path) => {
      const { app } = fixture();
      const token = await signAccessToken(user.id, config);
      const getParts = async (text: string) => {
        const response = await request(app)
          .post(path)
          .auth(token, { type: 'bearer' })
          .send({ text });
        expect(response.status).toBe(200);
        if (path === '/chat')
          return response.body.assistantMessage.parts as Array<{ type: string }>;
        const data = response.text.match(/event: parts\ndata: (.+)\n/)?.[1];
        expect(data).toBeDefined();
        return (JSON.parse(data!) as { parts: Array<{ type: string }> }).parts;
      };

      for (const text of [
        'I feel tired',
        'I’m in a bad mood',
        'I feel 😊',
        'Show my mood this week',
      ]) {
        expect((await getParts(text)).filter((part) => part.type === 'mood_picker')).toHaveLength(
          0,
        );
      }
      for (const text of ['Log my mood', 'Could I check in on my mood, please?', 'Mood check-in']) {
        expect((await getParts(text)).filter((part) => part.type === 'mood_picker')).toHaveLength(
          1,
        );
      }
      const crisis = await getParts('I want to die');
      expect(crisis.some((part) => part.type === 'crisis_card')).toBe(true);
      expect(crisis.some((part) => part.type === 'mood_picker')).toBe(false);
    },
  );

  it('returns the same saved mood for retries of one check-in', async () => {
    const { app, moods } = fixture();
    const token = await signAccessToken(user.id, config);
    const save = (score: number) =>
      request(app)
        .post('/mood')
        .auth(token, { type: 'bearer' })
        .send({ score, checkInId: 'reply-1' });

    const first = await save(3);
    const [retry, repeatedTap] = await Promise.all([save(3), save(4)]);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(repeatedTap.status).toBe(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(repeatedTap.body.score).toBe(3);
    expect(moods.size).toBe(1);
  });
});
