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
    assistantMessage: { parts: Array<{ type: string; text?: string; options?: string[] }> };
  }>('/chat', { method: 'POST', body: JSON.stringify({ text, conversationId }) });
}
export async function exportAccount() {
  await ensureGuestSession();
  return request<Record<string, unknown>>('/me/export');
}
export async function logMood(score: number, note?: string) {
  await ensureGuestSession();
  return request('/mood', { method: 'POST', body: JSON.stringify({ score, note }) });
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
export async function deleteConversation(id: string) {
  await ensureGuestSession();
  const accessToken = await AsyncStorage.getItem('solace.accessToken');
  await fetch(`${baseUrl}/conversations/${id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` },
  });
}
