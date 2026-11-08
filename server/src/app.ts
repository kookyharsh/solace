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
  notificationReplyRequest,
  reminderRequest,
  memoryRequest,
  memoryUpdateRequest,
  openLoopRequest,
  profileUpdateRequest,
  syncPushRequest,
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
  | 'achievement'
  | 'xpEvent'
  | 'device'
  | 'reminder'
  | 'userMemory'
  | 'openLoop'
>;
export function createApp(
  config: Config,
  db: Db,
  verifier: GoogleVerifier = makeGoogleVerifier(config.GOOGLE_CLIENT_ID),
) {
  const richPartsFor = async (
    text: string,
    userId: string,
    replyParts: Array<Record<string, unknown>>,
  ) => {
    if (replyParts.some((part) => part.type === 'crisis_card')) return replyParts;
    const lower = text.toLowerCase();
    const parts = [...replyParts];
    if (lower.includes('mood') || lower.includes('week') || lower.includes('feeling')) {
      const entries = await db.moodEntry.findMany({
        where: { userId, createdAt: { gte: new Date(Date.now() - 7 * 86400000) }, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      parts.push({
        type: 'mood_chart',
        range: 7,
        entries: entries.map((entry) => ({ score: entry.score, createdAt: entry.createdAt })),
      });
    }
    if (lower.includes('xp') || lower.includes('level') || lower.includes('streak')) {
      const stats = await db.userStats.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
      const xpForNext = 100 + (stats.level - 1) * 50;
      parts.push({
        type: 'xp_card',
        level: stats.level,
        xp: stats.xp,
        xpIntoLevel: stats.xp % xpForNext,
        xpForNext,
      });
      if (lower.includes('streak'))
        parts.push({
          type: 'streak_card',
          current: stats.currentStreak,
          longest: stats.longestStreak,
        });
    }
    if (lower.includes('breath') || lower.includes('anxious') || lower.includes('ground')) {
      parts.push({
        type: 'activity_card',
        kind: lower.includes('ground') ? 'grounding' : 'breathing',
        title: lower.includes('ground') ? '5-4-3-2-1 grounding' : 'One-minute breathing',
        durationMinutes: 1,
        xp: 15,
      });
    }
    if (lower.includes('quote') || lower.includes('inspire'))
      parts.push({
        type: 'quote_card',
        text: 'You do not have to solve the whole day at once.',
        author: 'Solace',
      });
    return parts;
  };
  const companionContext = async (userId: string) => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { companionName: true, memoryConsent: true },
    });
    if (!user) return { companionName: null, context: '' };
    if (!user.memoryConsent) return { companionName: user.companionName, context: '' };
    const memories = await db.userMemory.findMany({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 8,
    });
    return {
      companionName: user.companionName,
      context: memories.map((memory) => `${memory.category}: ${memory.text}`).join('; '),
    };
  };
  const extractSignals = async (userId: string, messageId: string, text: string) => {
    const profile = await db.user.findUnique({
      where: { id: userId },
      select: { memoryConsent: true },
    });
    if (!profile?.memoryConsent) return;
    const memoryMatch = text.match(
      /\b(?:i like|i love|my favorite (?:thing|food|sport|music) is)\s+([^.!?]{2,100})/i,
    );
    if (memoryMatch) {
      const value = (memoryMatch[1] ?? '').trim();
      const exists = await db.userMemory.findFirst({
        where: { userId, text: { equals: value, mode: 'insensitive' }, deletedAt: null },
      });
      if (!exists)
        await db.userMemory.create({
          data: { userId, text: value, category: 'preference', sourceMessageId: messageId },
        });
    }
    if (
      /\b(exam|interview|appointment|match|meeting|deadline)\b/i.test(text) &&
      /\b(tomorrow|next week|soon|on monday|on tuesday|on wednesday|on thursday|on friday)\b/i.test(
        text,
      )
    ) {
      const exists = await db.openLoop.findFirst({
        where: {
          userId,
          text: { equals: text, mode: 'insensitive' },
          status: 'open',
          deletedAt: null,
        },
      });
      if (!exists) await db.openLoop.create({ data: { userId, text, sourceMessageId: messageId } });
    }
  };
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
  app.post('/auth/guest', async (_req, res, next) => {
    try {
      const guestId = randomUUID();
      const user = await db.user.create({
        data: { googleId: `guest-${guestId}`, email: `${guestId}@guest.solace.local`, name: null },
      });
      const refreshToken = newRefreshToken();
      await db.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: tokenHash(refreshToken),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });
      res.status(201).json(
        authResponse.parse({
          user: userResponse.parse(user),
          accessToken: await signAccessToken(user.id, config),
          refreshToken,
          tokenType: 'Bearer',
          expiresIn: 900,
        }),
      );
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
  app.patch('/me', requireAuth(config), async (req, res, next) => {
    try {
      const input = profileUpdateRequest.parse(req.body);
      const user = await db.user.update({ where: { id: req.userId! }, data: input });
      res.json(userResponse.parse(user));
    } catch (error) {
      next(error);
    }
  });
  app.delete('/me', requireAuth(config), async (req, res, next) => {
    try {
      await db.user.delete({ where: { id: req.userId! } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  app.get('/me/export', requireAuth(config), async (req, res, next) => {
    try {
      const user = await db.user.findUnique({
        where: { id: req.userId! },
        include: {
          conversations: { include: { messages: true } },
          moods: true,
          memories: true,
          openLoops: true,
          reminders: true,
          stats: true,
          achievements: true,
        },
      });
      if (!user) throw new HttpError(404, 'NOT_FOUND', 'Account not found');
      res.setHeader('Content-Disposition', 'attachment; filename="solace-export.json"');
      res.json(user);
    } catch (error) {
      next(error);
    }
  });
  app.post('/sync/pull', requireAuth(config), async (req, res, next) => {
    try {
      const since = req.body?.lastPulledAt ? new Date(req.body.lastPulledAt) : new Date(0);
      const [conversations, messages, moods] = await Promise.all([
        db.conversation.findMany({ where: { userId: req.userId!, updatedAt: { gt: since } } }),
        db.message.findMany({
          where: { conversation: { userId: req.userId! }, updatedAt: { gt: since } },
        }),
        db.moodEntry.findMany({ where: { userId: req.userId!, updatedAt: { gt: since } } }),
      ]);
      res.json({
        changes: { conversations, messages, moods },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });
  app.post('/sync/push', requireAuth(config), async (req, res, next) => {
    try {
      const input = syncPushRequest.parse(req.body);
      for (const item of input.changes.conversations) {
        if (typeof item.id !== 'string') continue;
        await db.conversation.upsert({
          where: { id: item.id },
          create: {
            id: item.id,
            userId: req.userId!,
            title: typeof item.title === 'string' ? item.title : null,
          },
          update: { title: typeof item.title === 'string' ? item.title : undefined },
        });
      }
      for (const item of input.changes.moods) {
        if (typeof item.id !== 'string' || typeof item.score !== 'number') continue;
        await db.moodEntry.upsert({
          where: { id: item.id },
          create: {
            id: item.id,
            userId: req.userId!,
            score: item.score,
            note: typeof item.note === 'string' ? item.note : null,
          },
          update: { score: item.score, note: typeof item.note === 'string' ? item.note : null },
        });
      }
      res.json({ accepted: true, timestamp: new Date().toISOString() });
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
  app.delete('/conversations/:id', requireAuth(config), async (req, res, next) => {
    try {
      const result = await db.conversation.updateMany({
        where: { id: String(req.params.id), userId: req.userId!, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (!result.count) throw new HttpError(404, 'NOT_FOUND', 'Conversation not found');
      res.status(204).send();
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
      void extractSignals(req.userId!, userMessage.id, input.text).catch(() => undefined);
      const profile = await companionContext(req.userId!);
      const reply = await generateCompanionReply(
        input.text,
        config,
        profile.companionName,
        profile.context,
      );
      const parts = await richPartsFor(
        input.text,
        req.userId!,
        reply.parts.length
          ? reply.parts
          : input.text.toLowerCase().includes('mood')
            ? [{ type: 'mood_picker' }]
            : [
                {
                  type: 'quick_replies',
                  options: ['I feel low', 'I feel okay', 'I want to reflect'],
                },
              ],
      );
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
  app.post('/chat/stream', requireAuth(config), async (req, res, next) => {
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
      void extractSignals(req.userId!, userMessage.id, input.text).catch(() => undefined);
      const profile = await companionContext(req.userId!);
      const reply = await generateCompanionReply(
        input.text,
        config,
        profile.companionName,
        profile.context,
      );
      const parts = await richPartsFor(input.text, req.userId!, reply.parts);
      const assistant = await db.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          parts: [{ type: 'text', text: reply.text }, ...parts] as unknown as Prisma.InputJsonValue,
          source: 'chat',
        },
      });
      res.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      for (const chunk of reply.text.match(/.{1,24}(?:\s|$)/g) ?? [reply.text])
        res.write(`event: delta\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
      res.write(`event: parts\ndata: ${JSON.stringify({ parts })}\n\n`);
      res.write(
        `event: done\ndata: ${JSON.stringify({ conversationId: conversation.id, messageId: assistant.id })}\n\n`,
      );
      res.end();
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
  app.get('/gamification/achievements', requireAuth(config), async (req, res, next) => {
    try {
      res.json(
        await db.achievement.findMany({
          where: { userId: req.userId! },
          orderBy: { unlockedAt: 'desc' },
        }),
      );
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
      let level = 1;
      let remaining = stats.xp;
      let required = 100;
      while (remaining >= required) {
        remaining -= required;
        level += 1;
        required = 100 + (level - 1) * 50;
      }
      const leveled =
        level === stats.level
          ? stats
          : await db.userStats.update({ where: { userId: req.userId! }, data: { level } });
      res.json({ event, stats: leveled, levelUp: level > stats.level });
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
  app.post('/notifications/reply', requireAuth(config), async (req, res, next) => {
    try {
      const input = notificationReplyRequest.parse(req.body);
      const conversation = input.conversationId
        ? await db.conversation.findFirst({
            where: { id: input.conversationId, userId: req.userId!, deletedAt: null },
          })
        : await db.conversation.create({
            data: { userId: req.userId!, title: 'Notification check-in' },
          });
      if (!conversation) throw new HttpError(404, 'NOT_FOUND', 'Conversation not found');
      const userMessage = await db.message.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          source: 'notification',
          parts: [{ type: 'text', text: input.text }],
        },
      });
      void extractSignals(req.userId!, userMessage.id, input.text).catch(() => undefined);
      const profile = await companionContext(req.userId!);
      const reply = await generateCompanionReply(
        input.text,
        config,
        profile.companionName,
        profile.context,
      );
      const parts = await richPartsFor(input.text, req.userId!, reply.parts);
      const assistantMessage = await db.message.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          source: 'notification',
          parts: [{ type: 'text', text: reply.text }, ...parts] as unknown as Prisma.InputJsonValue,
        },
      });
      await db.xpEvent
        .create({
          data: {
            userId: req.userId!,
            type: 'notification_reply',
            amount: 5,
            eventKey: `notification-reply-${userMessage.id}`,
          },
        })
        .catch(() => undefined);
      res.status(201).json({ conversationId: conversation.id, userMessage, assistantMessage });
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
  app.get('/memory', requireAuth(config), async (req, res, next) => {
    try {
      const user = await db.user.findUnique({
        where: { id: req.userId! },
        select: { memoryConsent: true },
      });
      if (!user?.memoryConsent) {
        res.json([]);
        return;
      }
      res.json(
        await db.userMemory.findMany({
          where: { userId: req.userId!, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.post('/memory', requireAuth(config), async (req, res, next) => {
    try {
      const input = memoryRequest.parse(req.body);
      const user = await db.user.findUnique({
        where: { id: req.userId! },
        select: { memoryConsent: true },
      });
      if (!user?.memoryConsent) throw new HttpError(403, 'MEMORY_DISABLED', 'Memory is disabled');
      res.status(201).json(
        await db.userMemory.create({
          data: { userId: req.userId!, text: input.text, category: input.category },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.patch('/memory/:id', requireAuth(config), async (req, res, next) => {
    try {
      const input = memoryUpdateRequest.parse(req.body);
      const updated = await db.userMemory.updateMany({
        where: { id: String(req.params.id), userId: req.userId!, deletedAt: null },
        data: input,
      });
      if (!updated.count) throw new HttpError(404, 'NOT_FOUND', 'Memory not found');
      res.json(await db.userMemory.findUnique({ where: { id: String(req.params.id) } }));
    } catch (error) {
      next(error);
    }
  });
  app.delete('/memory/:id', requireAuth(config), async (req, res, next) => {
    try {
      const updated = await db.userMemory.updateMany({
        where: { id: String(req.params.id), userId: req.userId!, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (!updated.count) throw new HttpError(404, 'NOT_FOUND', 'Memory not found');
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  app.get('/open-loops', requireAuth(config), async (req, res, next) => {
    try {
      res.json(
        await db.openLoop.findMany({
          where: { userId: req.userId!, status: { in: ['open', 'asked'] }, deletedAt: null },
          orderBy: { dueAt: 'asc' },
        }),
      );
    } catch (error) {
      next(error);
    }
  });
  app.post('/open-loops', requireAuth(config), async (req, res, next) => {
    try {
      const input = openLoopRequest.parse(req.body);
      res.status(201).json(
        await db.openLoop.create({
          data: { userId: req.userId!, text: input.text, dueAt: input.dueAt ?? null },
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
