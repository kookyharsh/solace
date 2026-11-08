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
export async function sendChat(text: string, conversationId?: string) {
  await ensureGuestSession();
  return request<{
    conversationId: string;
    assistantMessage: { parts: Array<{ type: string; text?: string; options?: string[] }> };
  }>('/chat', { method: 'POST', body: JSON.stringify({ text, conversationId }) });
}
