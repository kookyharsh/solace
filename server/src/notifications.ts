import type { PrismaClient } from '@prisma/client';
import type { Config } from './config.js';

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
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const devices = await db.device.findMany({ include: { user: true } });
  const messages: PushMessage[] = [];
  const users = new Set<string>();
  for (const device of devices) {
    if (!device.user.notificationConsent || users.has(device.userId)) continue;
    const sent = await db.notificationLog.findFirst({
      where: { userId: device.userId, type: 'contextual', sentAt: { gte: dayStart } },
    });
    if (sent) continue;
    users.add(device.userId);
    const companion = device.user.companionName || 'Your companion';
    messages.push({
      to: device.expoPushToken,
      title: companion,
      body: 'Thinking of you. How is today feeling?',
      data: { route: '/(tabs)/chat', source: 'notification' },
      categoryId: 'solace-checkin',
    });
  }
  if (!(await sendExpoPush(messages, config))) return 0;
  await Promise.all(
    [...users].map((userId) => db.notificationLog.create({ data: { userId, type: 'contextual' } })),
  );
  return messages.length;
}
