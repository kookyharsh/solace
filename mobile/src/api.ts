import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch as fetchStream } from 'expo/fetch';
import { offlineRepository, type QueuedMood } from './offline/repository';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';
const pendingSetupKey = 'solace.onboarding.pending';
let accountVersion = 0;
let changingAccount = false;
let guestSession: Promise<boolean> | undefined;
let tokenRefresh: Promise<boolean> | undefined;

async function rawRequest(path: string, init: RequestInit, accessToken: string | null) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}
async function rotateAccessToken() {
  const version = accountVersion;
  const refreshToken = await AsyncStorage.getItem('solace.refreshToken');
  if (!refreshToken) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await rawRequest(
      '/auth/refresh',
      { method: 'POST', body: JSON.stringify({ refreshToken }), signal: controller.signal },
      null,
    );
  } finally {
    clearTimeout(timer);
  }
  if (version !== accountVersion) return false;
  if (!response.ok) {
    await AsyncStorage.multiRemove(['solace.accessToken', 'solace.refreshToken']);
    return false;
  }
  const tokens = (await response.json()) as { accessToken: string; refreshToken: string };
  if (version !== accountVersion) return false;
  await AsyncStorage.multiSet([
    ['solace.accessToken', tokens.accessToken],
    ['solace.refreshToken', tokens.refreshToken],
  ]);
  return true;
}
function refreshAccessToken() {
  return (tokenRefresh ??= rotateAccessToken().finally(() => {
    tokenRefresh = undefined;
  }));
}
async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const version = accountVersion;
  const accessToken = await AsyncStorage.getItem('solace.accessToken');
  if (version !== accountVersion) throw new Error('Account changed');
  const response = await rawRequest(path, init, accessToken);
  if (response.status === 401 && retry && !init.signal?.aborted && path !== '/auth/refresh') {
    if ((await refreshAccessToken()) && version === accountVersion)
      return request<T>(path, init, false);
  }
  if (!response.ok) throw new Error(`API ${response.status}`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
async function createGuestSession() {
  const version = accountVersion;
  if (await AsyncStorage.getItem('solace.accessToken')) return true;
  if (changingAccount || version !== accountVersion) throw new Error('Account is changing');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await request<{ accessToken: string; refreshToken: string }>('/auth/guest', {
      method: 'POST',
      body: '{}',
      signal: controller.signal,
    });
    if (version !== accountVersion) throw new Error('Account changed');
    await AsyncStorage.multiSet([
      ['solace.accessToken', response.accessToken],
      ['solace.refreshToken', response.refreshToken],
    ]);
    return true;
  } finally {
    clearTimeout(timer);
  }
}
export function ensureGuestSession() {
  return (guestSession ??= createGuestSession().finally(() => {
    guestSession = undefined;
  }));
}
export async function exchangeGoogleToken(idToken: string) {
  const response = await request<{ accessToken: string; refreshToken: string }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  await AsyncStorage.multiSet([
    ['solace.accessToken', response.accessToken],
    ['solace.refreshToken', response.refreshToken],
  ]);
  return response;
}
export async function mergeGuestWithGoogle(idToken: string) {
  await ensureGuestSession();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await request<{ accessToken: string; refreshToken: string }>(
      '/auth/guest-merge',
      { method: 'POST', body: JSON.stringify({ idToken }), signal: controller.signal },
    );
    await AsyncStorage.multiSet([
      ['solace.accessToken', response.accessToken],
      ['solace.refreshToken', response.refreshToken],
    ]);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
function beginAccountChange() {
  changingAccount = true;
  accountVersion += 1;
  onboardingSync?.abort();
}
export async function signOut() {
  beginAccountChange();
  try {
    await request('/auth/signout', { method: 'POST', body: '{}' }).catch(() => undefined);
    await AsyncStorage.multiRemove([
      'solace.accessToken',
      'solace.refreshToken',
      'solace.onboarding',
      pendingSetupKey,
    ]);
  } finally {
    changingAccount = false;
  }
}
export async function deleteAccount() {
  beginAccountChange();
  try {
    await request('/me', { method: 'DELETE', body: '{}' });
    await AsyncStorage.multiRemove([
      'solace.accessToken',
      'solace.refreshToken',
      'solace.onboarding',
      'solace.profile',
      'solace.queuedChat',
      pendingSetupKey,
    ]);
  } finally {
    changingAccount = false;
  }
}
export async function sendChat(text: string, conversationId?: string) {
  await ensureGuestSession();
  return request<{
    conversationId: string;
    assistantMessage: {
      parts: Array<{ type: string; text?: string; options?: string[]; [key: string]: unknown }>;
    };
  }>('/chat', { method: 'POST', body: JSON.stringify({ text, conversationId }) });
}
export async function streamChat(
  text: string,
  conversationId: string | undefined,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
) {
  await ensureGuestSession();
  const post = async () => {
    const accessToken = await AsyncStorage.getItem('solace.accessToken');
    return fetchStream(`${baseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ text, conversationId }),
      signal,
    });
  };
  let response = await post();
  if (response.status === 401 && (await refreshAccessToken())) response = await post();
  if (!response.ok || !response.body) throw new Error(`API ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done: { conversationId: string; messageId: string } | undefined;
  let parts: Array<{ type: string; text?: string; [key: string]: unknown }> = [];
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      const type = event.match(/^event: ([^\n]+)/m)?.[1];
      const data = event.match(/^data: ([^\n]+)/m)?.[1];
      if (!type || !data) continue;
      const payload = JSON.parse(data) as {
        text?: string;
        parts?: typeof parts;
        conversationId?: string;
        messageId?: string;
      };
      if (type === 'delta' && payload.text) onDelta(payload.text);
      if (type === 'parts' && payload.parts) parts = payload.parts;
      if (type === 'done' && payload.conversationId && payload.messageId)
        done = { conversationId: payload.conversationId, messageId: payload.messageId };
    }
  }
  if (!done) throw new Error('Stream ended without completion');
  return { ...done, parts };
}
let chatQueueOperation = Promise.resolve();

function updateChatQueue(operation: () => Promise<void>) {
  const next = chatQueueOperation.then(operation);
  chatQueueOperation = next.catch(() => undefined);
  return next;
}

export function queueChatMessage(text: string, conversationId?: string) {
  return updateChatQueue(async () => {
    const queue = await offlineRepository.readChatQueue();
    queue.push({ text, conversationId });
    await offlineRepository.writeChatQueue(queue.slice(-50));
  });
}

export function flushQueuedChatMessages() {
  return updateChatQueue(async () => {
    const queue = await offlineRepository.readChatQueue();
    if (!queue.length) return;
    const remaining: typeof queue = [];
    for (const item of queue) {
      try {
        await sendChat(item.text, item.conversationId);
      } catch {
        remaining.push(item);
      }
    }
    await offlineRepository.writeChatQueue(remaining);
  });
}
export async function exportAccount() {
  await ensureGuestSession();
  return request<Record<string, unknown>>('/me/export');
}
export async function logMood(score: number, note?: string, checkInId?: string): Promise<{ score: number }> {
  // 1. Optimistically update local profile mood
  void AsyncStorage.getItem('solace.profile').then((raw) => {
    const prev = raw ? JSON.parse(raw) : {};
    void AsyncStorage.setItem('solace.profile', JSON.stringify({ ...prev, mood: score }));
  }).catch(() => undefined);

  // 2. Queue in offline repository
  const createdAt = new Date().toISOString();
  void offlineRepository.readMoodQueue().then((queue) => {
    queue.push({ score, note, checkInId, createdAt });
    return offlineRepository.writeMoodQueue(queue.slice(-50));
  }).catch(() => undefined);

  // 3. Attempt network save
  try {
    await ensureGuestSession();
    const result = await request<{ score: number }>('/mood', {
      method: 'POST',
      body: JSON.stringify({ score, note, checkInId }),
    });
    // Remove from offline queue once saved
    void offlineRepository.readMoodQueue().then((queue) => {
      const remaining = queue.filter(
        (m) => !(m.score === score && m.checkInId === checkInId && m.createdAt === createdAt),
      );
      return offlineRepository.writeMoodQueue(remaining);
    }).catch(() => undefined);
    return result;
  } catch {
    // Optimistic fallback: return the chosen score so UI confirms and continues smoothly
    return { score };
  }
}

export async function flushQueuedMoods() {
  const queue: QueuedMood[] = await offlineRepository.readMoodQueue().catch(() => []);
  if (!queue.length) return;
  const remaining: QueuedMood[] = [];
  for (const item of queue) {
    try {
      await ensureGuestSession();
      await request<{ score: number }>('/mood', {
        method: 'POST',
        body: JSON.stringify({ score: item.score, note: item.note, checkInId: item.checkInId }),
      });
    } catch {
      remaining.push(item);
    }
  }
  await offlineRepository.writeMoodQueue(remaining).catch(() => undefined);
}
export async function getMood(range = 7) {
  await ensureGuestSession();
  return request<Array<{ score: number; createdAt: string }>>(`/mood?range=${range}`);
}
export async function getDailyQuote() {
  await ensureGuestSession();
  return request<{ text: string; author?: string | null }>('/quote/today');
}
export async function awardXp(type: string, amount: number, eventKey: string) {
  await ensureGuestSession();
  return request('/gamification/event', {
    method: 'POST',
    body: JSON.stringify({ type, amount, eventKey }),
  });
}
export async function getGamification() {
  await ensureGuestSession();
  return request<{ level: number; xp: number; xpIntoLevel: number; xpForNext: number }>(
    '/gamification/status',
  );
}
export async function getAchievements() {
  await ensureGuestSession();
  return request<Array<{ key: string; unlockedAt: string }>>('/gamification/achievements');
}
export async function getConversations() {
  await ensureGuestSession();
  return request<Array<{ id: string; title: string | null; updatedAt: string }>>('/conversations');
}
export async function getConversationMessages(id: string) {
  await ensureGuestSession();
  return request<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
    }>
  >(`/conversations/${id}/messages`);
}
export async function getTodayJournal() {
  await ensureGuestSession();
  return request<{
    messages: Array<{
      id: string;
      role: 'user' | 'assistant';
      parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
      createdAt: string;
    }>;
    summary: string | null;
  }>('/journal/today');
}
export async function saveJournalEntry(text: string) {
  await ensureGuestSession();
  return request('/journal', { method: 'POST', body: JSON.stringify({ text }) });
}
export async function getDailyChallenges() {
  await ensureGuestSession();
  return request<Array<{ key: string; completed: boolean }>>('/challenges/today');
}
export async function completeDailyChallenge(key: string) {
  await ensureGuestSession();
  return request(`/challenges/${key}/complete`, { method: 'POST', body: '{}' });
}
export async function deleteConversation(id: string) {
  await ensureGuestSession();
  const accessToken = await AsyncStorage.getItem('solace.accessToken');
  await fetch(`${baseUrl}/conversations/${id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` },
  });
}
export async function submitNotificationReply(text: string, conversationId?: string) {
  await ensureGuestSession();
  return request<{
    conversationId: string;
    assistantMessage: { parts: Array<{ type: string; text?: string }> };
  }>('/notifications/reply', {
    method: 'POST',
    body: JSON.stringify({ text, conversationId, notificationType: 'checkin' }),
  });
}
type ProfileUpdate = {
  name?: string | null;
  nickname?: string | null;
  companionName?: string | null;
  timezone?: string;
  memoryConsent?: boolean;
  notificationConsent?: boolean;
  goals?: string[];
  wakeTime?: string | null;
  sleepTime?: string | null;
};

type PendingSetup = {
  profile?: ProfileUpdate;
  habits: Record<string, boolean>;
  welcomeXp: boolean;
};

let setupWrites = Promise.resolve();
let onboardingSync: AbortController | undefined;

function withSetupWrite<T>(operation: () => Promise<T>) {
  const version = accountVersion;
  const next = setupWrites.then(() => {
    if (version !== accountVersion || changingAccount) throw new Error('Account changed');
    return operation();
  });
  setupWrites = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function readPendingSetup() {
  const raw = await AsyncStorage.getItem(pendingSetupKey);
  return raw ? (JSON.parse(raw) as PendingSetup) : undefined;
}

function writePendingSetup(setup: PendingSetup) {
  return setup.profile || Object.keys(setup.habits).length || setup.welcomeXp
    ? AsyncStorage.setItem(pendingSetupKey, JSON.stringify(setup))
    : AsyncStorage.removeItem(pendingSetupKey);
}

export function saveOnboardingSetup(
  profile: ProfileUpdate & { mood: number },
  habits: Record<string, boolean>,
) {
  const { mood, ...remoteProfile } = profile;
  return withSetupWrite(() =>
    AsyncStorage.multiSet([
      ['solace.profile', JSON.stringify({ ...remoteProfile, mood })],
      [pendingSetupKey, JSON.stringify({ profile: remoteProfile, habits, welcomeXp: true })],
    ]),
  );
}

function patchProfile(profile: ProfileUpdate, signal?: AbortSignal) {
  return request('/me', { method: 'PATCH', body: JSON.stringify(profile), signal });
}

function patchHabit(key: string, enabled: boolean, signal?: AbortSignal) {
  return request(`/habits/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
    signal,
  });
}

export function syncOnboardingSetup() {
  if (onboardingSync || changingAccount) return;
  const controller = new AbortController();
  const { signal } = controller;
  onboardingSync = controller;
  void withSetupWrite(async () => {
    const setup = await readPendingSetup();
    if (!setup || signal.aborted || (await AsyncStorage.getItem('solace.onboarding')) !== 'done')
      return;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      await ensureGuestSession();
      if (signal.aborted) return;
      if (setup.profile) {
        await patchProfile(setup.profile, signal);
        if (signal.aborted) return;
        delete setup.profile;
        await writePendingSetup(setup);
      }
      const habits = Object.entries(setup.habits);
      const results = await Promise.allSettled([
        ...habits.map(([key, enabled]) => patchHabit(key, enabled, signal)),
        setup.welcomeXp &&
          request('/gamification/event', {
            method: 'POST',
            body: JSON.stringify({
              type: 'onboarding_completed',
              amount: 50,
              eventKey: 'onboarding-completed',
            }),
            signal,
          }),
      ]);
      if (signal.aborted) return;
      habits.forEach(([key], index) => {
        if (results[index].status === 'fulfilled') delete setup.habits[key];
      });
      if (results[habits.length].status === 'fulfilled') setup.welcomeXp = false;
      await writePendingSetup(setup);
    } finally {
      clearTimeout(timeout);
    }
  })
    .catch(() => undefined)
    .finally(() => {
      onboardingSync = undefined;
    });
}

export function updateProfile(profile: ProfileUpdate) {
  const version = accountVersion;
  return withSetupWrite(async () => {
    await ensureGuestSession();
    const result = await patchProfile(profile);
    const setup = await readPendingSetup();
    if (setup?.profile && version === accountVersion) {
      for (const key of Object.keys(profile) as (keyof ProfileUpdate)[]) delete setup.profile[key];
      if (!Object.keys(setup.profile).length) delete setup.profile;
      await writePendingSetup(setup);
    }
    return result;
  });
}
export function updateHabitPreference(key: string, enabled: boolean) {
  const version = accountVersion;
  return withSetupWrite(async () => {
    await ensureGuestSession();
    const result = await patchHabit(key, enabled);
    const setup = await readPendingSetup();
    if (setup && key in setup.habits && version === accountVersion) {
      delete setup.habits[key];
      await writePendingSetup(setup);
    }
    return result;
  });
}
export async function getHabitPreferences() {
  await ensureGuestSession();
  return request<Array<{ key: string; enabled: boolean }>>('/habits');
}
export async function getProfile() {
  await ensureGuestSession();
  return request<{ memoryConsent: boolean; notificationConsent: boolean }>('/me');
}
export async function getMemories() {
  await ensureGuestSession();
  return request<Array<{ id: string; text: string; category: string }>>('/memory');
}
export async function deleteMemory(id: string) {
  await ensureGuestSession();
  await request(`/memory/${id}`, { method: 'DELETE' });
}
export async function registerDevice(expoPushToken: string, platform: 'android' | 'ios' | 'web') {
  await ensureGuestSession();
  return request('/devices', {
    method: 'POST',
    body: JSON.stringify({ expoPushToken, platform }),
  });
}
export async function getReminders() {
  await ensureGuestSession();
  return request<Array<{ id: string; title: string; time: string; enabled: boolean }>>(
    '/reminders',
  );
}
export async function createReminder(input: {
  type: string;
  title: string;
  time: string;
  days: number[];
  enabled?: boolean;
}) {
  await ensureGuestSession();
  return request('/reminders', { method: 'POST', body: JSON.stringify(input) });
}
export async function deleteReminder(id: string) {
  await ensureGuestSession();
  await request(`/reminders/${id}`, { method: 'DELETE' });
}
export async function getOpenLoops() {
  await ensureGuestSession();
  return request<Array<{ id: string; text: string; status: string; dueAt: string | null }>>(
    '/open-loops',
  );
}
export async function resolveOpenLoop(id: string) {
  await ensureGuestSession();
  return request(`/open-loops/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'resolved' }),
  });
}
