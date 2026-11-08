import AsyncStorage from '@react-native-async-storage/async-storage';

export type QueuedChat = { text: string; conversationId?: string };

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
};
