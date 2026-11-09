import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import pino from 'pino';
import { createHash, randomUUID } from 'node:crypto';
import {
  googleAuthRequest,
  guestMergeRequest,
  refreshRequest,
  userResponse,
  authResponse,
  conversationCreateRequest,
  chatRequest,
  journalEntryRequest,
  moodRequest,
  xpEventRequest,
  deviceRequest,
  notificationReplyRequest,
  reminderRequest,
  reminderUpdateRequest,
  memoryRequest,
  memoryUpdateRequest,
  openLoopRequest,
  openLoopUpdateRequest,
  profileUpdateRequest,
  habitPreferenceRequest,
  syncPushRequest,
  messagePart,
  detectChatAction,
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
import { chooseCheckin } from './checkinPlanner.js';

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
  | 'checkinPlan'
  | 'habitPreference'
  | 'quote'
  | 'habitLog'
  | 'dailyChallenge'
  | 'notificationLog'
>;

type StreakProgress = {
  xp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  freezesUsedThisWeek: number;
};

/** A PostgreSQL DATE is a calendar date, not a moment in the user's timezone. */
export function dateOnlyKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function nextStreakCount(
  previousDay: string | null,
  todayDay: string,
  currentStreak: number,
) {
  if (previousDay === todayDay) return currentStreak;
  if (!previousDay) return 1;
  const today = Date.parse(`${todayDay}T00:00:00.000Z`);
  const previous = Date.parse(`${previousDay}T00:00:00.000Z`);
  return today - previous === 86400000 ? currentStreak + 1 : 1;
}

export function mergeStreakProgress(
  account: StreakProgress | null,
  guest: StreakProgress | null,
): StreakProgress | null {
  if (!account) return guest;
  if (!guest) return account;
  const accountDay = account.lastActiveDate ? dateOnlyKey(account.lastActiveDate) : null;
  const guestDay = guest.lastActiveDate ? dateOnlyKey(guest.lastActiveDate) : null;
  const guestIsNewer = !accountDay || (guestDay !== null && guestDay > accountDay);
  const sameDay = accountDay !== null && accountDay === guestDay;
  const latest = guestIsNewer ? guest : account;
  return {
    xp: account.xp + guest.xp,
    currentStreak: sameDay
      ? Math.max(account.currentStreak, guest.currentStreak)
      : latest.currentStreak,
    longestStreak: Math.max(account.longestStreak, guest.longestStreak),
    lastActiveDate: latest.lastActiveDate,
    freezesUsedThisWeek: Math.max(account.freezesUsedThisWeek, guest.freezesUsedThisWeek),
  };
}

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
    if (replyParts.some((part) => part.type === 'crisis_card'))
      return replyParts.flatMap((part) => {
        const parsed = messagePart.safeParse(part);
        return parsed.success ? [parsed.data as Record<string, unknown>] : [];
      });
    const lower = text.toLowerCase();
    const action = detectChatAction(text);
    const parts = [...replyParts];
    const asksForMoodHistory =
      /\b(?:mood (?:this|last) week|my moods? (?:this|last) week|show (?:me )?(?:my )?moods?|mood history|weekly mood)\b/.test(
        lower,
      );
    if (!parts.some((part) => part.type === 'mood_picker') && asksForMoodHistory) {
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
    if (action) {
      const metadata = {
        breathing: {
          title: 'One-minute breathing',
          description: 'Follow a gentle inhale and exhale at your own pace.',
        },
        grounding: {
          title: '5-4-3-2-1 grounding',
          description: 'Notice your senses and come back to this moment.',
        },
        gratitude: {
          title: 'One good thing',
          description: 'Write down one small thing you appreciate today.',
        },
        mood_checkin: {
          title: 'Mood check-in',
          description: 'Choose the feeling that is closest right now.',
        },
        history: { title: 'Chat history', description: 'Look back at earlier conversations.' },
        today: { title: 'Today', description: 'Open today’s journal and check-in.' },
        settings: { title: 'Settings', description: 'Adjust your Solace preferences.' },
        wellness: { title: 'Wellness', description: 'Explore all wellness exercises.' },
      }[action];
      parts.push({
        type: 'action',
        action,
        ...metadata,
      });
    }
    if (lower.includes('quote') || lower.includes('inspire')) {
      const quotes = await db.quote.findMany({ orderBy: { id: 'asc' } });
      const quote = quotes.length
        ? quotes[Math.floor(Date.now() / 86400000) % quotes.length]
        : null;
      parts.push({
        type: 'quote_card',
        text: quote?.text ?? 'You do not have to solve the whole day at once.',
        author: quote?.author ?? 'Solace',
      });
    }
    return parts.flatMap((part) => {
      const parsed = messagePart.safeParse(part);
      return parsed.success ? [parsed.data as Record<string, unknown>] : [];
    });
  };
  const companionContext = async (userId: string) => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { companionName: true, memoryConsent: true },
    });
    if (!user) return { companionName: null, context: '' };
    if (!user.memoryConsent) return { companionName: user.companionName, context: '' };
    const [memories, moods] = await Promise.all([
      db.userMemory.findMany({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      db.moodEntry.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 7,
      }),
    ]);
    return {
      companionName: user.companionName,
      context: [
        ...memories.map((memory) => `${memory.category}: ${memory.text}`),
        ...(moods.length
          ? [`recent mood scores: ${moods.map((mood) => mood.score).join(', ')}`]
          : []),
      ].join('; '),
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
  const updateActivityStreak = async (
    userId: string,
    stats: {
      xp: number;
      level: number;
      currentStreak: number;
      longestStreak: number;
      lastActiveDate: Date | null;
    },
  ) => {
    const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const timezone = user?.timezone || 'UTC';
    const calendarDay = (date: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    const todayKey = calendarDay(new Date());
    const previousKey = stats.lastActiveDate ? dateOnlyKey(stats.lastActiveDate) : null;
    if (previousKey === todayKey) return stats;
    const today = new Date(`${todayKey}T00:00:00.000Z`);
    const currentStreak = nextStreakCount(previousKey, todayKey, stats.currentStreak);
    return db.userStats.update({
      where: { userId },
      data: {
        currentStreak,
        longestStreak: Math.max(stats.longestStreak, currentStreak),
        lastActiveDate: today,
      },
    });
  };
  const userDateKey = async (userId: string, date = new Date()) => {
    const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: user?.timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };
  const userDayStart = async (userId: string, date = new Date()) =>
    new Date(`${await userDateKey(userId, date)}T00:00:00.000Z`);
  const awardChatSessionXp = async (userId: string, conversationId: string) => {
    const userMessages = await db.message.count({
      where: { conversationId, role: 'user', deletedAt: null },
    });
    if (userMessages < 5) return false;
    const event = await db.xpEvent
      .create({
        data: {
          userId,
          type: 'chat_session',
          amount: 15,
          eventKey: `chat-session-${await userDateKey(userId)}-${userId}`,
        },
      })
      .catch((error: { code?: string }) => (error.code === 'P2002' ? null : Promise.reject(error)));
    if (!event) return false;
    const stats = await db.userStats.upsert({
      where: { userId },
      create: { userId, xp: 15 },
      update: { xp: { increment: 15 } },
    });
    const streaked = await updateActivityStreak(userId, stats);
    const withStreakBonus = await awardStreakBonus(userId, streaked);
    await refreshStatsLevel({ ...withStreakBonus, userId });
    return true;
  };
  const awardStreakBonus = async (
    userId: string,
    stats: {
      xp: number;
      level: number;
      currentStreak: number;
      longestStreak: number;
      lastActiveDate: Date | null;
    },
  ) => {
    const amount = Math.min(stats.currentStreak, 7) * 5;
    if (amount <= 0) return stats;
    const event = await db.xpEvent
      .create({
        data: {
          userId,
          type: 'streak_day',
          amount,
          eventKey: `streak-${await userDateKey(userId)}-${userId}`,
        },
      })
      .catch((error: { code?: string }) => (error.code === 'P2002' ? null : Promise.reject(error)));
    if (!event) return stats;
    return db.userStats.update({ where: { userId }, data: { xp: { increment: amount } } });
  };
  const levelForXp = (xp: number) => {
    let level = 1;
    let remaining = Math.max(0, xp);
    let xpForNext = 100;
    while (remaining >= xpForNext) {
      remaining -= xpForNext;
      level += 1;
      xpForNext = 100 + (level - 1) * 50;
    }
    return { level, xpIntoLevel: remaining, xpForNext };
  };
  const refreshStatsLevel = async (stats: {
    userId: string;
    xp: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: Date | null;
  }) => {
    const computed = levelForXp(stats.xp);
    const updated =
      computed.level === stats.level
        ? stats
        : await db.userStats.update({
            where: { userId: stats.userId },
            data: { level: computed.level },
          });
    return { ...updated, ...computed };
  };
  const unlockAchievement = async (userId: string, key: string) =>
    db.achievement.create({ data: { userId, key } }).catch((error: { code?: string }) => {
      if (error.code !== 'P2002') throw error;
      return null;
    });
  const mergeGuestRecords = async (guestId: string, accountId: string) => {
    const [guestStats, accountStats] = await Promise.all([
      db.userStats.findUnique({ where: { userId: guestId } }),
      db.userStats.findUnique({ where: { userId: accountId } }),
    ]);
    await db.conversation.updateMany({ where: { userId: guestId }, data: { userId: accountId } });
    await db.moodEntry.updateMany({ where: { userId: guestId }, data: { userId: accountId } });
    await db.userMemory.updateMany({ where: { userId: guestId }, data: { userId: accountId } });
    await db.openLoop.updateMany({ where: { userId: guestId }, data: { userId: accountId } });
    await db.habitLog.updateMany({ where: { userId: guestId }, data: { userId: accountId } });
    await db.checkinPlan.updateMany({ where: { userId: guestId }, data: { userId: accountId } });
    await db.reminder.updateMany({ where: { userId: guestId }, data: { userId: accountId } });
    await db.notificationLog.updateMany({
      where: { userId: guestId },
      data: { userId: accountId },
    });
    const guestEvents = await db.xpEvent.findMany({ where: { userId: guestId } });
    for (const event of guestEvents)
      await db.xpEvent
        .update({ where: { id: event.id }, data: { userId: accountId } })
        .catch(() => undefined);
    const guestAchievements = await db.achievement.findMany({ where: { userId: guestId } });
    for (const achievement of guestAchievements)
      await db.achievement
        .create({
          data: { userId: accountId, key: achievement.key, unlockedAt: achievement.unlockedAt },
        })
        .catch(() => undefined);
    const guestChallenges = await db.dailyChallenge.findMany({ where: { userId: guestId } });
    for (const challenge of guestChallenges)
      await db.dailyChallenge
        .create({
          data: {
            userId: accountId,
            date: challenge.date,
            key: challenge.key,
            completedAt: challenge.completedAt,
          },
        })
        .catch(() => undefined);
    const mergedStats = mergeStreakProgress(accountStats, guestStats);
    if (mergedStats) {
      const level = levelForXp(mergedStats.xp).level;
      await db.userStats.upsert({
        where: { userId: accountId },
        create: { userId: accountId, ...mergedStats, level },
        update: { ...mergedStats, level },
      });
    }
    await db.userStats.delete({ where: { userId: guestId } }).catch(() => undefined);
    await db.achievement.deleteMany({ where: { userId: guestId } });
    await db.dailyChallenge.deleteMany({ where: { userId: guestId } });
    await db.habitPreference.deleteMany({ where: { userId: guestId } });
    await db.user.delete({ where: { id: guestId } });
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
  app.post('/auth/guest-merge', requireAuth(config), async (req, res, next) => {
    try {
      const { idToken } = guestMergeRequest.parse(req.body);
      let identity;
      try {
        identity = await verifier.verify(idToken);
      } catch {
        throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'Google sign-in failed');
      }
      const existing = await db.user.findUnique({ where: { googleId: identity.sub } });
      const guest = await db.user.findUnique({ where: { id: req.userId! } });
      if (existing && guest && existing.id !== guest.id)
        await mergeGuestRecords(guest.id, existing.id);
      const user =
        existing ??
        (guest && guest.googleId.startsWith('guest-')
          ? await db.user.update({
              where: { id: guest.id },
              data: { googleId: identity.sub, email: identity.email, name: identity.name },
            })
          : await db.user.upsert({
              where: { googleId: identity.sub },
              create: { googleId: identity.sub, email: identity.email, name: identity.name },
              update: { email: identity.email, name: identity.name },
            }));
      const refreshToken = newRefreshToken();
      await db.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: tokenHash(refreshToken),
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });
      res.json(
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
  app.post('/auth/signout', requireAuth(config), async (req, res, next) => {
    try {
      await db.refreshSession.updateMany({
        where: { userId: req.userId!, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      res.status(204).send();
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
  app.get('/habits', requireAuth(config), async (req, res, next) => {
    try {
      res.json(await db.habitPreference.findMany({ where: { userId: req.userId! } }));
    } catch (error) {
      next(error);
    }
  });
  app.patch('/habits/:key', requireAuth(config), async (req, res, next) => {
    try {
      const key = String(req.params.key);
      if (!['water', 'stretch', 'walk', 'screen_break', 'wind_down', 'gratitude'].includes(key))
        throw new HttpError(400, 'INVALID_HABIT', 'Unknown habit preference');
      const input = habitPreferenceRequest.parse(req.body);
      res.json(
        await db.habitPreference.upsert({
          where: { userId_key: { userId: req.userId!, key } },
          create: {
            userId: req.userId!,
            key,
            enabled: input.enabled,
            mutedUntil: input.mutedUntil ?? null,
          },
          update: { enabled: input.enabled, mutedUntil: input.mutedUntil ?? null },
        }),
      );
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
        const owned = await db.conversation.findFirst({
          where: { id: item.id, userId: req.userId! },
        });
        if (owned)
          await db.conversation.update({
            where: { id: owned.id },
            data: { title: typeof item.title === 'string' ? item.title : undefined },
          });
        else
          await db.conversation
            .create({
              data: {
                id: item.id,
                userId: req.userId!,
                title: typeof item.title === 'string' ? item.title : null,
              },
            })
            .catch(() => undefined);
      }
      for (const item of input.changes.messages) {
        if (
          typeof item.id !== 'string' ||
          typeof item.conversationId !== 'string' ||
          typeof item.role !== 'string'
        )
          continue;
        const conversation = await db.conversation.findFirst({
          where: { id: item.conversationId, userId: req.userId!, deletedAt: null },
        });
        if (!conversation) continue;
        const existing = await db.message.findFirst({
          where: { id: item.id, conversationId: conversation.id },
        });
        const data = {
          role: item.role,
          source: typeof item.source === 'string' ? item.source : 'chat',
          parts: (item.parts ?? []) as Prisma.InputJsonValue,
        };
        if (existing) await db.message.update({ where: { id: existing.id }, data });
        else
          await db.message
            .create({ data: { id: item.id, conversationId: conversation.id, ...data } })
            .catch(() => undefined);
      }
      for (const item of input.changes.moods) {
        if (typeof item.id !== 'string' || typeof item.score !== 'number') continue;
        const existing = await db.moodEntry.findFirst({
          where: { id: item.id, userId: req.userId! },
        });
        const data = { score: item.score, note: typeof item.note === 'string' ? item.note : null };
        if (existing) await db.moodEntry.update({ where: { id: existing.id }, data });
        else
          await db.moodEntry
            .create({ data: { id: item.id, userId: req.userId!, ...data } })
            .catch(() => undefined);
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
  app.get('/journal/today', requireAuth(config), async (req, res, next) => {
    try {
      const start = await userDayStart(req.userId!);
      const messages = await db.message.findMany({
        where: {
          conversation: { userId: req.userId!, deletedAt: null },
          createdAt: { gte: start },
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json({
        messages,
        summary: messages.length
          ? `${messages.filter((message) => message.role === 'user').length} moments shared today, held gently.`
          : null,
      });
    } catch (error) {
      next(error);
    }
  });
  app.post('/journal', requireAuth(config), async (req, res, next) => {
    try {
      const input = journalEntryRequest.parse(req.body);
      const conversation = await db.conversation.create({
        data: { userId: req.userId!, title: 'Today' },
      });
      const message = await db.message.create({
        data: {
          conversationId: conversation.id,
          role: 'user',
          source: 'journal',
          parts: [{ type: 'text', text: input.text }],
        },
      });
      res.status(201).json({ conversationId: conversation.id, message });
    } catch (error) {
      next(error);
    }
  });
  app.get('/checkins/next', requireAuth(config), async (req, res, next) => {
    try {
      const [openLoops, moods, habits] = await Promise.all([
        db.openLoop.findMany({
          where: { userId: req.userId!, status: 'open', deletedAt: null },
          orderBy: { dueAt: 'asc' },
          take: 3,
        }),
        db.moodEntry.findMany({
          where: {
            userId: req.userId!,
            createdAt: { gte: new Date(Date.now() - 3 * 86400000) },
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
        }),
        db.habitPreference.findMany({
          where: {
            userId: req.userId!,
            enabled: true,
            OR: [{ mutedUntil: null }, { mutedUntil: { lt: new Date() } }],
          },
          orderBy: { key: 'asc' },
        }),
      ]);
      const recentPlans = await db.checkinPlan.findMany({
        where: { userId: req.userId!, scheduledAt: { gte: new Date(Date.now() - 3 * 86400000) } },
        select: { topic: true },
      });
      const candidate = chooseCheckin({
        openLoops,
        lowMoodCount: moods.filter((mood) => mood.score <= 2).length,
        habits: habits.map((habit) => habit.key),
        recentTopics: recentPlans
          .map((plan) => plan.topic)
          .filter((topic): topic is string => Boolean(topic)),
      });
      if (!candidate) {
        res.json(null);
        return;
      }
      const plan = await db.checkinPlan.create({
        data: {
          userId: req.userId!,
          type: 'contextual',
          source: candidate.source,
          topic: candidate.topic,
          scheduledAt: new Date(),
        },
      });
      if (candidate.source === 'loop')
        await db.openLoop.updateMany({
          where: { userId: req.userId!, text: candidate.topic, status: 'open', deletedAt: null },
          data: { status: 'asked' },
        });
      res.json({ ...candidate, planId: plan.id });
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
      if (!conversation.title) {
        await db.conversation.update({
          where: { id: conversation.id },
          data: { title: input.text.replace(/\s+/g, ' ').trim().slice(0, 80) },
        });
      }
      void awardChatSessionXp(req.userId!, conversation.id).catch(() => undefined);
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
      if (!conversation.title) {
        await db.conversation.update({
          where: { id: conversation.id },
          data: { title: input.text.replace(/\s+/g, ' ').trim().slice(0, 80) },
        });
      }
      void awardChatSessionXp(req.userId!, conversation.id).catch(() => undefined);
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
      for (const chunk of reply.text.match(/[\s\S]{1,24}/gu) ?? [])
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
      const userId = req.userId!;
      let id: string | undefined;
      if (input.checkInId) {
        // Derive a user-scoped UUID so retries reuse the same mood entry.
        const hash = createHash('sha256')
          .update(userId + ':' + input.checkInId)
          .digest('hex');
        id = [
          hash.slice(0, 8),
          hash.slice(8, 12),
          '8' + hash.slice(13, 16),
          '8' + hash.slice(17, 20),
          hash.slice(20, 32),
        ].join('-');
      }
      const mood = await db.moodEntry
        .create({
          data: {
            id,
            userId,
            score: input.score,
            note: input.note ?? null,
            provenance: 'explicit',
          },
        })
        .catch((error: { code?: string }) => {
          if (!id || error.code !== 'P2002') throw error;
          return db.moodEntry.findFirstOrThrow({ where: { id, userId } });
        });
      const day = await userDateKey(req.userId!);
      const event = await db.xpEvent
        .create({
          data: {
            userId: req.userId!,
            type: 'mood_checkin',
            amount: 10,
            eventKey: `mood-${day}-${req.userId}`,
          },
        })
        .catch((error: { code?: string }) =>
          error.code === 'P2002' ? null : Promise.reject(error),
        );
      if (event) {
        const stats = await db.userStats.upsert({
          where: { userId: req.userId! },
          create: { userId: req.userId!, xp: 10 },
          update: { xp: { increment: 10 } },
        });
        const streaked = await updateActivityStreak(req.userId!, stats);
        const withStreakBonus = await awardStreakBonus(req.userId!, streaked);
        const refreshed = await refreshStatsLevel({ ...withStreakBonus, userId: req.userId! });
        const moodCount = await db.moodEntry.count({
          where: { userId: req.userId!, deletedAt: null },
        });
        if (moodCount >= 14) await unlockAchievement(req.userId!, 'mood_mapper');
        if (refreshed.currentStreak >= 3) await unlockAchievement(req.userId!, 'three_day_streak');
        if (refreshed.currentStreak >= 7) await unlockAchievement(req.userId!, 'seven_day_streak');
      }
      res.status(201).json({ ...mood, xpAwarded: Boolean(event) });
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
      res.json({ ...stats, ...levelForXp(stats.xp) });
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
  app.get('/challenges/today', requireAuth(config), async (req, res, next) => {
    try {
      const date = await userDayStart(req.userId!);
      const keys = ['mood', 'breath', 'gratitude'];
      const rows = await db.dailyChallenge.findMany({ where: { userId: req.userId!, date } });
      res.json(
        keys.map((key) => ({
          key,
          completed: rows.some((row) => row.key === key && row.completedAt),
        })),
      );
    } catch (error) {
      next(error);
    }
  });
  app.post('/challenges/:key/complete', requireAuth(config), async (req, res, next) => {
    try {
      const key = String(req.params.key);
      if (!['mood', 'breath', 'gratitude'].includes(key))
        throw new HttpError(400, 'INVALID_CHALLENGE', 'Unknown daily challenge');
      const date = await userDayStart(req.userId!);
      const existing = await db.dailyChallenge.findUnique({
        where: { userId_date_key: { userId: req.userId!, date, key } },
      });
      const row = await db.dailyChallenge.upsert({
        where: { userId_date_key: { userId: req.userId!, date, key } },
        create: { userId: req.userId!, date, key, completedAt: new Date() },
        update: { completedAt: new Date() },
      });
      let xpAwarded = false;
      let bonusAwarded = false;
      if (!existing?.completedAt) {
        const event = await db.xpEvent
          .create({
            data: {
              userId: req.userId!,
              type: 'daily_challenge',
              amount: 10,
              eventKey: `challenge-${date.toISOString().slice(0, 10)}-${key}-${req.userId}`,
            },
          })
          .catch((error: { code?: string }) =>
            error.code === 'P2002' ? null : Promise.reject(error),
          );
        if (event) {
          xpAwarded = true;
          const stats = await db.userStats.upsert({
            where: { userId: req.userId! },
            create: { userId: req.userId!, xp: 10 },
            update: { xp: { increment: 10 } },
          });
          const streaked = await updateActivityStreak(req.userId!, stats);
          const withStreakBonus = await awardStreakBonus(req.userId!, streaked);
          await refreshStatsLevel({ ...withStreakBonus, userId: req.userId! });
        }
      }
      const completedToday = await db.dailyChallenge.count({
        where: { userId: req.userId!, date, completedAt: { not: null } },
      });
      if (completedToday === 3) {
        const bonus = await db.xpEvent
          .create({
            data: {
              userId: req.userId!,
              type: 'daily_challenge_bonus',
              amount: 20,
              eventKey: `challenge-bonus-${date.toISOString().slice(0, 10)}-${req.userId}`,
            },
          })
          .catch((error: { code?: string }) =>
            error.code === 'P2002' ? null : Promise.reject(error),
          );
        if (bonus) {
          bonusAwarded = true;
          const stats = await db.userStats.upsert({
            where: { userId: req.userId! },
            create: { userId: req.userId!, xp: 20 },
            update: { xp: { increment: 20 } },
          });
          const streaked = await updateActivityStreak(req.userId!, stats);
          const withStreakBonus = await awardStreakBonus(req.userId!, streaked);
          await refreshStatsLevel({ ...withStreakBonus, userId: req.userId! });
        }
      }
      res.json({ ...row, xpAwarded, bonusAwarded });
    } catch (error) {
      next(error);
    }
  });
  app.post('/gamification/event', requireAuth(config), async (req, res, next) => {
    try {
      const input = xpEventRequest.parse(req.body);
      const limits: Record<string, number> = {
        breathing: 3,
        grounding: 2,
        gratitude: 2,
        notification_reply: 3,
        habit_checkin: 3,
      };
      const limit = limits[input.type];
      if (limit) {
        const dayStart = await userDayStart(req.userId!);
        const used = await db.xpEvent.count({
          where: { userId: req.userId!, type: input.type, createdAt: { gte: dayStart } },
        });
        if (used >= limit) {
          res.json({ limited: true, limit, type: input.type });
          return;
        }
      }
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
      const streaked = await updateActivityStreak(req.userId!, stats);
      const withStreakBonus = await awardStreakBonus(req.userId!, streaked);
      const computed = levelForXp(withStreakBonus.xp);
      const leveled = await refreshStatsLevel({ ...withStreakBonus, userId: req.userId! });
      const unlocks = new Set<string>(['first_words']);
      if (computed.level >= 5) unlocks.add('level_5');
      if (input.type === 'breathing') {
        const count = await db.xpEvent.count({ where: { userId: req.userId!, type: 'breathing' } });
        if (count >= 10) unlocks.add('breath_master');
      }
      for (const key of unlocks) await unlockAchievement(req.userId!, key);
      res.json({ event, stats: leveled, levelUp: computed.level > streaked.level });
    } catch (error) {
      next(error);
    }
  });
  app.get('/quote/today', requireAuth(config), async (_req, res, next) => {
    try {
      const quotes = await db.quote.findMany({ orderBy: { id: 'asc' } });
      if (!quotes.length) {
        res.json({ text: 'You do not have to solve the whole day at once.', author: 'Solace' });
        return;
      }
      const index = Math.floor(Date.now() / 86400000) % quotes.length;
      res.json(quotes[index]);
    } catch (error) {
      next(error);
    }
  });
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
      await db.openLoop.updateMany({
        where: { userId: req.userId!, status: 'asked', deletedAt: null },
        data: { status: 'resolved' },
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
      const notificationDay = await userDayStart(req.userId!);
      const notificationReplies = await db.xpEvent.count({
        where: {
          userId: req.userId!,
          type: 'notification_reply',
          createdAt: { gte: notificationDay },
        },
      });
      if (notificationReplies < 3) {
        const event = await db.xpEvent
          .create({
            data: {
              userId: req.userId!,
              type: 'notification_reply',
              amount: 5,
              eventKey: `notification-reply-${userMessage.id}`,
            },
          })
          .catch(() => null);
        if (event) {
          const stats = await db.userStats.upsert({
            where: { userId: req.userId! },
            create: { userId: req.userId!, xp: 5 },
            update: { xp: { increment: 5 } },
          });
          const streaked = await updateActivityStreak(req.userId!, stats);
          const withStreakBonus = await awardStreakBonus(req.userId!, streaked);
          await refreshStatsLevel({ ...withStreakBonus, userId: req.userId! });
        }
      }
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
  app.patch('/reminders/:id', requireAuth(config), async (req, res, next) => {
    try {
      const input = reminderUpdateRequest.parse(req.body);
      const updated = await db.reminder.updateMany({
        where: { id: String(req.params.id), userId: req.userId!, deletedAt: null },
        data: input,
      });
      if (!updated.count) throw new HttpError(404, 'NOT_FOUND', 'Reminder not found');
      res.json(await db.reminder.findUnique({ where: { id: String(req.params.id) } }));
    } catch (error) {
      next(error);
    }
  });
  app.delete('/reminders/:id', requireAuth(config), async (req, res, next) => {
    try {
      const updated = await db.reminder.updateMany({
        where: { id: String(req.params.id), userId: req.userId!, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (!updated.count) throw new HttpError(404, 'NOT_FOUND', 'Reminder not found');
      res.status(204).send();
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
  app.patch('/open-loops/:id', requireAuth(config), async (req, res, next) => {
    try {
      const input = openLoopUpdateRequest.parse(req.body);
      const updated = await db.openLoop.updateMany({
        where: { id: String(req.params.id), userId: req.userId!, deletedAt: null },
        data: input,
      });
      if (!updated.count) throw new HttpError(404, 'NOT_FOUND', 'Open loop not found');
      res.json(await db.openLoop.findUnique({ where: { id: String(req.params.id) } }));
    } catch (error) {
      next(error);
    }
  });
  app.delete('/open-loops/:id', requireAuth(config), async (req, res, next) => {
    try {
      const updated = await db.openLoop.updateMany({
        where: { id: String(req.params.id), userId: req.userId!, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (!updated.count) throw new HttpError(404, 'NOT_FOUND', 'Open loop not found');
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Route not found')));
  app.use(errorHandler);
  return app;
}
