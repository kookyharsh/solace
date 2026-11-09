import type { PrismaClient } from '@prisma/client';
import type { Config } from './config.js';
import { chooseCheckin } from './checkinPlanner.js';

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  categoryId: string;
};

async function sendExpoPush(messages: PushMessage[], config: Config) {
  if (!messages.length || !config.EXPO_PUSH_ACCESS_TOKEN) return false;
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.EXPO_PUSH_ACCESS_TOKEN
        ? { Authorization: `Bearer ${config.EXPO_PUSH_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(messages),
  });
  if (!response.ok) return false;
  const payload = await response.json() as { data?: Array<{ status: string }> };
  return Array.isArray(payload.data) && payload.data.every(ticket => ticket.status === 'ok');
}
export async function sendNotificationAnswer(db: PrismaClient, config: Config, userId: string, conversationId: string, body: string) {
  const devices = await db.device.findMany({ where: { userId } });
  return sendExpoPush(devices.map(device => ({ to: device.expoPushToken, title: 'Solace replied', body: body.slice(0, 300), data: { route: '/(tabs)/chat', conversationId, type: 'answer' }, categoryId: 'solace-checkin' })), config);
}

export async function dispatchContextualNotifications(
  db: PrismaClient,
  config: Config,
  now = new Date(),
) {
  if (!config.EXPO_PUSH_ACCESS_TOKEN) return 0;
  const due = await db.plannedActivity.findMany({ where: { status: 'scheduled', OR: [{ scheduledAt: { lte: now }, reminderSentAt: null }, { followUpAt: { lte: now }, followUpSentAt: null }] }, include: { user: { include: { devices: true } } }, take: 100 });
  let activityCount = 0;
  for (const item of due) {
    if (!item.user.notificationConsent || !item.user.devices.length) continue;
    const followUp = !!item.reminderSentAt;
    if (item.snoozedUntil && item.snoozedUntil > now && !followUp) continue;
    const field = followUp ? 'followUpSentAt' : 'reminderSentAt';
    const claimed = await db.plannedActivity.updateMany({ where: { id: item.id, status: 'scheduled', [field]: null }, data: { [field]: now } });
    if (!claimed.count) continue;
    try {
      const delivered = await sendExpoPush(item.user.devices.map(device => ({ to: device.expoPushToken, title: item.user.companionName || 'Solace', body: followUp ? `How did ${item.title} go?` : `It’s time for ${item.title}.`, data: { route: '/(tabs)/chat', conversationId: item.conversationId, activityId: item.id, type: followUp ? 'follow-up' : 'activity' }, categoryId: 'solace-activity' })), config);
      if (!delivered) throw new Error('Push rejected');
      activityCount += item.user.devices.length;
    } catch {
      await db.plannedActivity.updateMany({ where: { id: item.id, [field]: now }, data: { [field]: null } });
    }
  }
  const devices = await db.device.findMany({
    include: {
      user: {
        include: {
          openLoops: {
            where: { status: 'open', deletedAt: null },
            orderBy: { createdAt: 'asc' },
            take: 3,
          },
          habitPreferences: { where: { enabled: true } },
          moods: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 3 },
        },
      },
    },
  });
  const messages: PushMessage[] = [];
  const users = new Set<string>();
  const userTypes = new Map<string, string>();
  const plans = new Map<string, { source: string; topic: string; type: string }>();
  for (const device of devices) {
    if (!device.user.notificationConsent || users.has(device.userId)) continue;
    const timezone = device.user.timezone || 'UTC';
    const local = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      local.find((item) => item.type === type)?.value ?? '0';
    const localHour = Number(part('hour'));
    const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (localHour >= 22 || localHour < 8) continue;
    let type: 'morning' | 'night' | 'contextual' | null = null;
    const wakeHour = Number((device.user.wakeTime || '09:00').split(':')[0]);
    const sleepHour = Number((device.user.sleepTime || '20:00').split(':')[0]);
    if (localHour === wakeHour) type = 'morning';
    else if (localHour === sleepHour) type = 'night';
    else if (localHour >= Math.max(10, wakeHour + 1) && localHour < Math.min(sleepHour, 19) && localHour === 15)
      type = 'contextual';
    if (!type) continue;
    const sent = await db.notificationLog.findFirst({
      where: { userId: device.userId, type, sentAt: { gte: dayStart } },
    });
    if (sent) continue;
    if (type === 'contextual') {
      const recentMood = device.user.moods[0];
      if (recentMood && now.getTime() - recentMood.createdAt.getTime() < 12 * 60 * 60 * 1000) continue;
      const engagement = await db.notificationLog.findFirst({ where: { userId: device.userId, type: 'contextual', sentAt: { gte: dayStart } } });
      if (engagement) continue;
    }
    users.add(device.userId);
    userTypes.set(device.userId, type);
    const companion = device.user.companionName || 'Your companion';
    const planned = chooseCheckin({
      openLoops: device.user.openLoops,
      lowMoodCount: device.user.moods.filter((mood) => mood.score <= 2).length,
      habits: device.user.habitPreferences.map((habit) => habit.key),
      recentTopics: (
        await db.checkinPlan.findMany({
          where: {
            userId: device.userId,
            scheduledAt: { gte: new Date(now.getTime() - 3 * 86400000) },
          },
          select: { topic: true },
        })
      )
        .map((plan) => plan.topic)
        .filter((topic): topic is string => Boolean(topic)),
    });
    const body =
      type === 'morning'
        ? 'A gentle morning check-in, whenever you are ready.'
        : type === 'night'
          ? 'How was your day? A small reflection is enough.'
          : planned?.text || (['How is your mood right now?', 'What felt good today?', 'What is one thing on your mind?'][Math.floor(now.getTime() / 86400000) % 3] ?? 'How are you feeling?');
    plans.set(device.userId, {
      source: type === 'contextual' ? planned?.source || 'habit' : 'ritual',
      topic: type === 'contextual' ? planned?.topic || 'daily check-in' : type,
      type,
    });
    messages.push({
      to: device.expoPushToken,
      title: companion,
      body,
      data: { route: '/(tabs)/chat', source: 'notification', type },
      categoryId: 'solace-checkin',
    });
  }
  if (!messages.length || !(await sendExpoPush(messages, config))) return activityCount;
  await Promise.all(
    [...users].map((userId) =>
      db.notificationLog.create({ data: { userId, type: userTypes.get(userId) || 'contextual' } }),
    ),
  );
  await Promise.all(
    [...users].map((userId) => {
      const plan = plans.get(userId);
      return plan
        ? db.checkinPlan.create({
            data: {
              userId,
              type: plan.type,
              source: plan.source,
              topic: plan.topic,
              scheduledAt: now,
              sentAt: now,
            },
          })
        : Promise.resolve();
    }),
  );
  return messages.length + activityCount;
}
