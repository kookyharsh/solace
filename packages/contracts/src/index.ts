import { z } from 'zod';

export function isMoodCheckInRequest(text: string) {
  const request = text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, '')
    .trim()
    .replace(/’/g, "'")
    .replace(/\s+/g, ' ')
    .replace(
      /^(please|can i|can we|can you|could i|could you|i want to|i'd like to|i would like to) /,
      '',
    )
    .replace(/,? please$/, '');
  return /^(?:(?:log|record|track) (?:my |a |the )?mood|check in on (?:my )?mood|(?:do )?(?:a )?mood check[ -]in)$/.test(
    request,
  );
}

export const chatActionKind = z.enum([
  'breathing',
  'grounding',
  'gratitude',
  'mood_checkin',
  'history',
  'today',
  'settings',
  'wellness',
]);
export type ChatActionKind = z.infer<typeof chatActionKind>;

/**
 * Only recognizes requests that clearly ask the app to do something. Keeping
 * this deterministic means a conversational model can never invent a route or
 * start an unexpected in-app flow.
 */
export function detectChatAction(text: string): ChatActionKind | undefined {
  const request = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const asksToOpen = /\b(?:open|show|take me to|go to|navigate to|view)\b/.test(request);

  if (isMoodCheckInRequest(text)) return 'mood_checkin';
  if (/\b(?:ground(?:ing)?|5[ -]?4[ -]?3[ -]?2[ -]?1)\b/.test(request)) return 'grounding';
  if (
    /\b(?:breath(?:e|ing)?|breathing exercise|calm me down|help me calm|help me relax)\b/.test(
      request,
    )
  )
    return 'breathing';
  if (/\b(?:gratitude|grateful|appreciat(?:e|ion))\b/.test(request)) return 'gratitude';
  if (asksToOpen && /\b(?:chat )?history\b/.test(request)) return 'history';
  if (asksToOpen && /\b(?:today|journal)\b/.test(request)) return 'today';
  if (asksToOpen && /\b(?:settings?|preferences?)\b/.test(request)) return 'settings';
  if (asksToOpen && /\b(?:wellness|exercises?|activities)\b/.test(request)) return 'wellness';
  return undefined;
}

export const googleAuthRequest = z.object({ idToken: z.string().min(20).max(8192) });
export const guestMergeRequest = googleAuthRequest;
export const refreshRequest = z.object({ refreshToken: z.string().min(32).max(4096) });
export const userResponse = z.object({
  id: z.string().uuid(),
  email: z.email(),
  name: z.string().nullable(),
  nickname: z.string().nullable(),
  companionName: z.string().nullable(),
  timezone: z.string(),
  goals: z.array(z.string()).optional(),
  wakeTime: z.string().nullable().optional(),
  sleepTime: z.string().nullable().optional(),
});
export const authResponse = z.object({
  user: userResponse,
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
});
export const conversationCreateRequest = z.object({ title: z.string().trim().max(120).optional() });
export const chatRequest = z.object({
  conversationId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(4000),
});
export const journalEntryRequest = z.object({ text: z.string().trim().min(1).max(2000) });
export const moodRequest = z.object({
  score: z.number().int().min(1).max(5),
  note: z.string().trim().max(1000).optional(),
  checkInId: z.string().trim().min(1).max(80).optional(),
});
export const xpEventRequest = z.object({
  type: z.string().trim().min(1).max(80),
  amount: z.number().int().min(0).max(1000),
  eventKey: z.string().trim().min(1).max(160),
});
export const deviceRequest = z.object({
  expoPushToken: z.string().min(10).max(512),
  platform: z.enum(['android', 'ios', 'web']),
});
export const notificationReplyRequest = z.object({
  text: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  notificationId: z.string().uuid().optional(),
  notificationType: z.string().trim().max(80).optional(),
});
export const activityUpdateRequest = z.object({
  status: z.enum(['scheduled', 'completed', 'cancelled', 'skipped']).optional(),
  scheduledAt: z.coerce.date().optional(),
  snoozedUntil: z.coerce.date().nullable().optional(),
  title: z.string().trim().min(1).max(120).optional(),
});
export const reminderRequest = z.object({
  type: z.string().min(1).max(50),
  title: z.string().trim().min(1).max(120),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  days: z.array(z.number().int().min(0).max(6)).max(7),
  enabled: z.boolean().optional(),
});
export const reminderUpdateRequest = reminderRequest.partial();
export const memoryRequest = z.object({
  text: z.string().trim().min(1).max(500),
  category: z.enum(['fact', 'preference', 'habit']).default('fact'),
});
export const memoryUpdateRequest = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  category: z.enum(['fact', 'preference', 'habit']).optional(),
});
export const openLoopRequest = z.object({
  text: z.string().trim().min(1).max(500),
  dueAt: z.coerce.date().optional(),
});
export const openLoopUpdateRequest = z.object({
  text: z.string().trim().min(1).max(500).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  status: z.enum(['open', 'asked', 'resolved']).optional(),
});
export const profileUpdateRequest = z.object({
  name: z.string().trim().max(120).nullable().optional(),
  nickname: z.string().trim().max(80).nullable().optional(),
  companionName: z.string().trim().min(1).max(20).nullable().optional(),
  timezone: z.string().max(80).optional(),
  memoryConsent: z.boolean().optional(),
  notificationConsent: z.boolean().optional(),
  goals: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  wakeTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  sleepTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
});
export const habitPreferenceRequest = z.object({
  enabled: z.boolean(),
  mutedUntil: z.coerce.date().nullable().optional(),
});
export const syncPushRequest = z.object({
  lastPulledAt: z.coerce.date().nullable().optional(),
  changes: z.object({
    conversations: z.array(z.record(z.string(), z.unknown())).default([]),
    messages: z.array(z.record(z.string(), z.unknown())).default([]),
    moods: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
});
export const errorResponse = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const partText = z.object({ type: z.literal('text'), text: z.string() }).passthrough();
const partQuickReplies = z
  .object({ type: z.literal('quick_replies'), options: z.array(z.string()).max(8) })
  .passthrough();
const partMoodPicker = z.object({ type: z.literal('mood_picker') }).passthrough();
const partMoodChart = z
  .object({
    type: z.literal('mood_chart'),
    range: z.number().int().positive(),
    entries: z.array(z.object({ score: z.number(), createdAt: z.coerce.date() })),
  })
  .passthrough();
const partXp = z
  .object({
    type: z.literal('xp_card'),
    level: z.number().int().positive(),
    xp: z.number().int().nonnegative(),
    xpIntoLevel: z.number().int().nonnegative(),
    xpForNext: z.number().int().positive(),
  })
  .passthrough();
const partStreak = z
  .object({
    type: z.literal('streak_card'),
    current: z.number().int().nonnegative(),
    longest: z.number().int().nonnegative(),
  })
  .passthrough();
const partActivity = z
  .object({
    type: z.literal('activity_card'),
    kind: z.string(),
    title: z.string(),
    durationMinutes: z.number().positive(),
    xp: z.number().int().nonnegative(),
  })
  .passthrough();
const partAction = z
  .object({
    type: z.literal('action'),
    action: chatActionKind,
    title: z.string().min(1).max(120),
    description: z.string().max(240).optional(),
  })
  .passthrough();
const partQuote = z
  .object({
    type: z.literal('quote_card'),
    text: z.string(),
    author: z.string().nullable().optional(),
  })
  .passthrough();
const partCrisis = z
  .object({ type: z.literal('crisis_card'), helplines: z.array(z.record(z.string(), z.string())) })
  .passthrough();
const partBreathing = z
  .object({
    type: z.literal('breathing_card'),
    title: z.string(),
    pattern: z.string().optional(),
    durationMinutes: z.number().positive().optional(),
  })
  .passthrough();
const partCompanion = z
  .object({
    type: z.literal('companion'),
    state: z.string(),
    expression: z.string().optional(),
    moodScore: z.number().optional(),
  })
  .passthrough();
const partLevelUp = z
  .object({
    type: z.literal('level_up'),
    level: z.number().int().positive(),
    unlocked: z.array(z.string()).optional(),
  })
  .passthrough();
export const messagePart = z.union([
  partText,
  partQuickReplies,
  partMoodPicker,
  partMoodChart,
  partXp,
  partStreak,
  partActivity,
  partAction,
  partQuote,
  partBreathing,
  partCompanion,
  partLevelUp,
  partCrisis,
]);
export type UserResponse = z.infer<typeof userResponse>;
