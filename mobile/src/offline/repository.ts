import AsyncStorage from '@react-native-async-storage/async-storage';

export type QueuedChat = { text: string; conversationId?: string };
export type QueuedMood = { score: number; note?: string; checkInId?: string; createdAt: string };
export type CachedChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  moodLabel?: string;
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
};

/** Offline boundary: keeps the app storage backend swappable for WatermelonDB. */
export const offlineRepository = {
  async readChatQueue(): Promise<QueuedChat[]> {
    const raw = await AsyncStorage.getItem('solace.queuedChat');
    return raw ? (JSON.parse(raw) as QueuedChat[]) : [];
  },
  async writeChatQueue(queue: QueuedChat[]) {
    if (queue.length) await AsyncStorage.setItem('solace.queuedChat', JSON.stringify(queue));
    else await AsyncStorage.removeItem('solace.queuedChat');
  },
  async readMoodQueue(): Promise<QueuedMood[]> {
    const raw = await AsyncStorage.getItem('solace.queuedMood');
    return raw ? (JSON.parse(raw) as QueuedMood[]) : [];
  },
  async writeMoodQueue(queue: QueuedMood[]) {
    if (queue.length) await AsyncStorage.setItem('solace.queuedMood', JSON.stringify(queue));
    else await AsyncStorage.removeItem('solace.queuedMood');
  },
  async readTranscript(): Promise<{ conversationId?: string; messages: CachedChatMessage[] }> {
    const raw = await AsyncStorage.getItem('solace.chat.transcript');
    if (!raw) return { messages: [] };
    try {
      return JSON.parse(raw) as { conversationId?: string; messages: CachedChatMessage[] };
    } catch {
      return { messages: [] };
    }
  },
  async writeTranscript(value: { conversationId?: string; messages: CachedChatMessage[] }) {
    await AsyncStorage.setItem('solace.chat.transcript', JSON.stringify(value));
  },
};
