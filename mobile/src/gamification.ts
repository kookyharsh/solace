import AsyncStorage from '@react-native-async-storage/async-storage';
import { awardXp } from './api';

export interface GamificationStats {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
}

export interface AchievementItem {
  key: string;
  title: string;
  description: string;
  icon: 'wind' | 'smile' | 'star' | 'message-circle' | 'flame' | 'trophy' | 'calendar';
  unlockedAt: string;
}

export const ALL_ACHIEVEMENTS: Record<
  string,
  Omit<AchievementItem, 'unlockedAt'>
> = {
  first_breath: {
    key: 'first_breath',
    title: 'First Breath',
    description: 'Completed your first 1-minute breathing session',
    icon: 'wind',
  },
  first_mood: {
    key: 'first_mood',
    title: 'Self-Aware',
    description: 'Checked in with your feelings',
    icon: 'smile',
  },
  first_challenge: {
    key: 'first_challenge',
    title: 'Daily Care',
    description: 'Completed your first daily wellness practice',
    icon: 'star',
  },
  first_words: {
    key: 'first_words',
    title: 'Hello Solace',
    description: 'Named and met your personal companion',
    icon: 'message-circle',
  },
  breath_master: {
    key: 'breath_master',
    title: 'Deep Calm',
    description: 'Completed 5 breathing sessions',
    icon: 'flame',
  },
  level_5: {
    key: 'level_5',
    title: 'Rising High',
    description: 'Reached Level 5 in your wellness journey',
    icon: 'trophy',
  },
};

const STATS_KEY = 'solace.gamification';
const ACHIEVEMENTS_KEY = 'solace.achievements';
const BREATH_COUNT_KEY = 'solace.breath_count';

export function levelForXp(xp: number): { level: number; xpIntoLevel: number; xpForNext: number } {
  let level = 1;
  let remaining = Math.max(0, xp);
  let xpForNext = 100;
  while (remaining >= xpForNext) {
    remaining -= xpForNext;
    level += 1;
    xpForNext = 100 + (level - 1) * 50;
  }
  return { level, xpIntoLevel: remaining, xpForNext };
}

export async function getLocalGamification(): Promise<GamificationStats> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const computed = levelForXp(parsed.xp || 0);
      return { xp: parsed.xp || 0, ...computed };
    }
  } catch {
    // fallback to initial
  }
  return { level: 1, xp: 0, xpIntoLevel: 0, xpForNext: 100 };
}

export async function getLocalAchievements(): Promise<AchievementItem[]> {
  try {
    const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    if (raw) {
      const list: Array<{ key: string; unlockedAt?: string }> = JSON.parse(raw);
      return list.map((item) => {
        const meta = ALL_ACHIEVEMENTS[item.key] || {
          key: item.key,
          title: item.key.replace(/_/g, ' '),
          description: 'Wellness achievement unlocked',
          icon: 'star',
        };
        return {
          ...meta,
          unlockedAt: item.unlockedAt || new Date().toISOString(),
        };
      });
    }
  } catch {
    // fallback
  }
  return [];
}

export async function addLocalXp(
  amount: number,
  type: string,
  eventKey?: string,
): Promise<{ stats: GamificationStats; newAchievements: AchievementItem[] }> {
  const current = await getLocalGamification();
  const newXp = current.xp + amount;
  const computed = levelForXp(newXp);
  const updatedStats: GamificationStats = { xp: newXp, ...computed };
  await AsyncStorage.setItem(STATS_KEY, JSON.stringify(updatedStats));

  // Check achievements to unlock
  const existingAchievements = await getLocalAchievements();
  const existingKeys = new Set(existingAchievements.map((a) => a.key));
  const newUnlocks: string[] = [];

  if (type === 'breathing') {
    if (!existingKeys.has('first_breath')) newUnlocks.push('first_breath');
    const prevCount = Number(await AsyncStorage.getItem(BREATH_COUNT_KEY)) || 0;
    const newCount = prevCount + 1;
    await AsyncStorage.setItem(BREATH_COUNT_KEY, String(newCount));
    if (newCount >= 5 && !existingKeys.has('breath_master')) {
      newUnlocks.push('breath_master');
    }
  } else if (type === 'mood' || type === 'mood_checkin') {
    if (!existingKeys.has('first_mood')) newUnlocks.push('first_mood');
  } else if (type === 'daily_challenge') {
    if (!existingKeys.has('first_challenge')) newUnlocks.push('first_challenge');
  }

  if (computed.level >= 5 && !existingKeys.has('level_5')) {
    newUnlocks.push('level_5');
  }

  const now = new Date().toISOString();
  const addedItems: AchievementItem[] = [];

  for (const key of newUnlocks) {
    const meta = ALL_ACHIEVEMENTS[key];
    if (meta) {
      addedItems.push({ ...meta, unlockedAt: now });
      existingAchievements.unshift({ ...meta, unlockedAt: now });
    }
  }

  if (addedItems.length > 0) {
    await AsyncStorage.setItem(
      ACHIEVEMENTS_KEY,
      JSON.stringify(
        existingAchievements.map((item) => ({ key: item.key, unlockedAt: item.unlockedAt })),
      ),
    );
  }

  // Background sync to server (silently caught if offline or server is spun down)
  const keyToSync = eventKey || `local-${type}-${Date.now()}`;
  void awardXp(type, amount, keyToSync).catch(() => undefined);

  return { stats: updatedStats, newAchievements: addedItems };
}
