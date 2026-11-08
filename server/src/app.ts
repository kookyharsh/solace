import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pino from 'pino';
import { randomUUID } from 'node:crypto';
import {
  googleAuthRequest,
  refreshRequest,
  userResponse,
  authResponse,
  conversationCreateRequest,
  chatRequest,
  moodRequest,
  xpEventRequest,
  deviceRequest,
  reminderRequest,
} from '@solace/contracts';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Config } from './config.js';
import {
  makeGoogleVerifier,
  newRefreshToken,
  requireAuth,
  signAccessToken,
  tokenHash,
  type GoogleVerifier,
} from './auth.js';
import { errorHandler, HttpError } from './errors.js';
import { generateCompanionReply } from './ai.js';

type Db = Pick<
  PrismaClient,
  | '$queryRaw'
  | 'user'
  | 'refreshSession'
  | 'conversation'
  | 'message'
  | 'moodEntry'
  | 'userStats'
  | 'xpEvent'
  | 'device'
  | 'reminder'
>;
export function createApp(
  config: Config,
  db: Db,
  verifier: GoogleVerifier = makeGoogleVerifier(config.GOOGLE_CLIENT_ID),
) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const id = req.get('x-request-id')?.slice(0, 100) || randomUUID();
    res.set('x-request-id', id);
    next();
  });
  const logger = pino();
  app.use((req, res, next) => {
    res.on('finish', () =>
      logger.info(
        {
          requestId: res.getHeader('x-request-id'),
          method: req.method,
          path: req.path,
          status: res.statusCode,
        },
        'request',
      ),
    );
    next();
  });
  app.use(helmet());
  const origins = config.CORS_ORIGINS.split(',').map((x) => x.trim());
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin)) }));
  app.use(express.json({ limit: '16kb' }));
  app.use(
    rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res, next) => {
    try {
      await db.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      next(new HttpError(503, 'NOT_READY', 'Database unavailable'));
    }
  });
  app.post('/auth/google', async (req, res, next) => {
    try {
      const { idToken } = googleAuthRequest.parse(req.body);
      let identity;
      try {
        identity = await verifier.verify(idToken);
      } catch {
        throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'Google sign-in failed');
      }
      const user = await db.user.upsert({
        where: { googleId: identity.sub },
        create: { googleId: identity.sub, email: identity.email, name: identity.name },
        update: { email: identity.email, name: identity.name },
      });
      const refreshToken = newRefreshToken();
      await db.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: tokenHash(refreshToken),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });
      const response = authResponse.parse({
        user: userResponse.parse(user),
        accessToken: await signAccessToken(user.id, config),
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      });
      res.json(response);
    } catch (error) {
      next(error);
    }
  });
  app.post('/auth/refresh', async (req, res, next) => {
    try {
      const { refreshToken } = refreshRequest.parse(req.body);
      const session = await db.refreshSession.findUnique({
        where: { tokenHash: tokenHash(refreshToken) },
        include: { user: true },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date())
        throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Session expired');
      const replacement = newRefreshToken();
      const result = await db.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!result.count) throw new HttpError(401, 'INVALID_REFRESH_TOKEN', 'Session expired');
      await db.refreshSession.create({
        data: {
          userId: session.userId,
          tokenHash: tokenHash(replacement),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });
      res.json(
        authResponse.parse({
          user: userResponse.parse(session.user),
          accessToken: await signAccessToken(session.userId, config),
          refreshToken: replacement,
          tokenType: 'Bearer',
          expiresIn: 900,
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.get('/me', requireAuth(config), async (req, res, next) => {
    try {
      const user = await db.user.findUnique({ where: { id: req.userId! } });
      if (!user) throw new HttpError(404, 'NOT_FOUND', 'Account not found');
      res.json(userResponse.parse(user));
    } catch (error) {
      next(error);
    }
  });
  app.get('/conversations', requireAuth(config), async (req, res, next) => {
    try {
      res.json(
        await db.conversation.findMany({
          where: { userId: req.userId!, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.post('/conversations', requireAuth(config), async (req, res, next) => {
    try {
      const input = conversationCreateRequest.parse(req.body);
      res.status(201).json(
        await db.conversation.create({
          data: { userId: req.userId!, title: input.title ?? null },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.get('/conversations/:id/messages', requireAuth(config), async (req, res, next) => {
    try {
      const conversation = await db.conversation.findFirst({
        where: { id: String(req.params.id), userId: req.userId!, deletedAt: null },
      });
      if (!conversation) throw new HttpError(404, 'NOT_FOUND', 'Conversation not found');
      res.json(
        await db.message.findMany({
          where: { conversationId: conversation.id, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.post('/chat', requireAuth(config), async (req, res, next) => {
    try {
      const input = chatRequest.parse(req.body);
      const conversation = input.conversationId
        ? await db.conversation.findFirst({
            where: { id: input.conversationId, userId: req.userId!, deletedAt: null },
          })
        : await db.conversation.create({ data: { userId: req.userId! } });
      if (!conversation) throw new HttpError(404, 'NOT_FOUND', 'Conversation not found');
      const userMessage = await db.message.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          parts: [{ type: 'text', text: input.text }],
          source: 'chat',
        },
      });
      const reply = await generateCompanionReply(input.text, config);
      const parts = reply.parts.length
        ? reply.parts
        : input.text.toLowerCase().includes('mood')
          ? [{ type: 'mood_picker' }]
          : [
              {
                type: 'quick_replies',
                options: ['I feel low', 'I feel okay', 'I want to reflect'],
              },
            ];
      const assistantMessage = await db.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          parts: [{ type: 'text', text: reply.text }, ...parts] as unknown as Prisma.InputJsonValue,
          source: 'chat',
        },
      });
      res.json({ conversationId: conversation.id, userMessage, assistantMessage });
    } catch (error) {
      next(error);
    }
  });
  app.post('/mood', requireAuth(config), async (req, res, next) => {
    try {
      const input = moodRequest.parse(req.body);
      res.status(201).json(
        await db.moodEntry.create({
          data: {
            userId: req.userId!,
            score: input.score,
            note: input.note ?? null,
            provenance: 'explicit',
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.get('/mood', requireAuth(config), async (req, res, next) => {
    try {
      const days = Math.min(90, Math.max(1, Number(req.query.range ?? 7)));
      res.json(
        await db.moodEntry.findMany({
          where: {
            userId: req.userId!,
            createdAt: { gte: new Date(Date.now() - days * 86400000) },
            deletedAt: null,
          },
          orderBy: { createdAt: 'asc' },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.get('/gamification/status', requireAuth(config), async (req, res, next) => {
    try {
      const stats = await db.userStats.upsert({
        where: { userId: req.userId! },
        create: { userId: req.userId! },
        update: {},
      });
      const xpForNext = 100 + (stats.level - 1) * 50;
      res.json({ ...stats, xpIntoLevel: stats.xp % xpForNext, xpForNext });
    } catch (error) {
      next(error);
    }
  });
  app.post('/gamification/event', requireAuth(config), async (req, res, next) => {
    try {
      const input = xpEventRequest.parse(req.body);
      const event = await db.xpEvent
        .create({ data: { userId: req.userId!, ...input } })
        .catch((error: { code?: string }) => {
          if (error.code === 'P2002') return null;
          throw error;
        });
      if (!event) {
        res.json({ duplicate: true });
        return;
      }
      const stats = await db.userStats.upsert({
        where: { userId: req.userId! },
        create: { userId: req.userId!, xp: input.amount },
        update: { xp: { increment: input.amount } },
      });
      res.json({ event, stats });
    } catch (error) {
      next(error);
    }
  });
  app.get('/quote/today', requireAuth(config), async (_req, res) =>
    res.json({ text: 'You do not have to solve the whole day at once.', author: 'Solace' }),
  );
  app.post('/devices', requireAuth(config), async (req, res, next) => {
    try {
      const input = deviceRequest.parse(req.body);
      res.json(
        await db.device.upsert({
          where: { expoPushToken: input.expoPushToken },
          create: { userId: req.userId!, ...input },
          update: { userId: req.userId!, platform: input.platform },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.get('/reminders', requireAuth(config), async (req, res, next) => {
    try {
      res.json(
        await db.reminder.findMany({
          where: { userId: req.userId!, deletedAt: null },
          orderBy: { time: 'asc' },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.post('/reminders', requireAuth(config), async (req, res, next) => {
    try {
      const input = reminderRequest.parse(req.body);
      res.status(201).json(
        await db.reminder.create({
          data: { userId: req.userId!, ...input, enabled: input.enabled ?? true },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Route not found')));
  app.use(errorHandler);
  return app;
}
