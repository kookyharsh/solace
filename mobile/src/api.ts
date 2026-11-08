import AsyncStorage from '@react-native-async-storage/async-storage';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await AsyncStorage.getItem('solace.accessToken');
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
}
export async function ensureGuestSession() {
  if (await AsyncStorage.getItem('solace.accessToken')) return true;
  const response = await request<{ accessToken: string; refreshToken: string }>('/auth/guest', {
    method: 'POST',
    body: '{}',
  });
  await AsyncStorage.multiSet([
    ['solace.accessToken', response.accessToken],
    ['solace.refreshToken', response.refreshToken],
  ]);
  return true;
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
) {
  await ensureGuestSession();
  const accessToken = await AsyncStorage.getItem('solace.accessToken');
  const response = await fetch(`${baseUrl}/chat/stream`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ text, conversationId }),
  });
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
export async function exportAccount() {
  await ensureGuestSession();
  return request<Record<string, unknown>>('/me/export');
}
export async function logMood(score: number, note?: string) {
  await ensureGuestSession();
  return request('/mood', { method: 'POST', body: JSON.stringify({ score, note }) });
}
export async function getMood(range = 7) {
  await ensureGuestSession();
  return request<Array<{ score: number; createdAt: string }>>(`/mood?range=${range}`);
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
export async function updateProfile(profile: {
  name?: string | null;
  nickname?: string | null;
  companionName?: string | null;
  memoryConsent?: boolean;
  notificationConsent?: boolean;
}) {
  await ensureGuestSession();
  return request('/me', { method: 'PATCH', body: JSON.stringify(profile) });
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
