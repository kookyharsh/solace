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
  return response.ok;
}

export async function dispatchContextualNotifications(
  db: PrismaClient,
  config: Config,
  now = new Date(),
) {
  if (!config.EXPO_PUSH_ACCESS_TOKEN) return 0;
  const devices = await db.device.findMany({
    include: {
      user: {
        include: {
          openLoops: { where: { status: 'open', deletedAt: null }, orderBy: { createdAt: 'asc' }, take: 3 },
          habitPreferences: { where: { enabled: true } },
          moods: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 3 },
        },
      },
    },
  });
  const messages: PushMessage[] = [];
  const users = new Set<string>();
  const userTypes = new Map<string, string>();
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
    const part = (type: Intl.DateTimeFormatPartTypes) => local.find((item) => item.type === type)?.value ?? '0';
    const localHour = Number(part('hour'));
    const localDay = `${part('year')}-${part('month')}-${part('day')}`;
    const dayStart = new Date(`${localDay}T00:00:00.000Z`);
    let type: 'morning' | 'night' | 'contextual' | null = null;
    const wakeHour = Number((device.user.wakeTime || '09:00').split(':')[0]);
    const sleepHour = Number((device.user.sleepTime || '20:00').split(':')[0]);
    if (localHour === wakeHour) type = 'morning';
    else if (localHour === sleepHour) type = 'night';
    else if (localHour >= Math.max(10, wakeHour + 1) && localHour < Math.max(sleepHour, 19)) type = 'contextual';
    if (!type) continue;
    const sent = await db.notificationLog.findFirst({
      where: { userId: device.userId, type, sentAt: { gte: dayStart } },
    });
    if (sent) continue;
    users.add(device.userId);
    userTypes.set(device.userId, type);
    const companion = device.user.companionName || 'Your companion';
    const planned = chooseCheckin({
      openLoops: device.user.openLoops,
      lowMoodCount: device.user.moods.filter((mood) => mood.score <= 2).length,
      habits: device.user.habitPreferences.map((habit) => habit.key),
    });
    const body =
      type === 'morning'
        ? 'A gentle morning check-in, whenever you are ready.'
        : type === 'night'
          ? 'How was your day? A small reflection is enough.'
          : planned?.text || 'Thinking of you. How is today feeling?';
    messages.push({
      to: device.expoPushToken,
      title: companion,
      body,
      data: { route: '/(tabs)/chat', source: 'notification', type },
      categoryId: 'solace-checkin',
    });
  }
  if (!(await sendExpoPush(messages, config))) return 0;
  await Promise.all(
    [...users].map((userId) =>
      db.notificationLog.create({ data: { userId, type: userTypes.get(userId) || 'contextual' } }),
    ),
  );
  return messages.length;
}
