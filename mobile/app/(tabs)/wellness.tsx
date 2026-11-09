import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanionBlob } from '../../src/companion/CompanionBlob';
import { Button, Card, Chip, ScreenBackground, ProgressBar } from '../../src/components/ui';
import { MoodChoices } from '../../src/components/MoodChoices';
import { useTheme } from '../../src/theme';
import { colorForMood } from '../../src/companion/moodTheme';
import {
  ALL_ACHIEVEMENTS,
  AchievementItem,
  GamificationStats,
  addLocalXp,
  getLocalAchievements,
  getLocalGamification,
} from '../../src/gamification';
import {
  completeDailyChallenge,
  getAchievements,
  getDailyChallenges,
  getDailyQuote,
  getGamification,
  getMood,
  logMood,
} from '../../src/api';

export default function Wellness() {
  const t = useTheme();
  const [companionName, setCompanionName] = useState('Your companion');
  const [mood, setMood] = useState<number>();
  const [completed, setCompleted] = useState<string[]>([]);
  const [stats, setStats] = useState<GamificationStats>({ level: 1, xp: 0, xpIntoLevel: 0, xpForNext: 100 });
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [moodHistory, setMoodHistory] = useState<Array<{ score: number; createdAt: string }>>([]);
  const [quote, setQuote] = useState<{ text: string; author?: string | null }>();

  const refreshData = useCallback(() => {
    // 1. Instant local-first load
    AsyncStorage.getItem('solace.profile').then((raw) => {
      if (raw) setCompanionName(JSON.parse(raw).companionName ?? 'Your companion');
    });
    void getLocalGamification().then(setStats);
    void getLocalAchievements().then(setAchievements);

    // 2. Background sync with backend
    getGamification()
      .then((remote) => {
        setStats((prev) => (remote.xp >= prev.xp ? remote : prev));
      })
      .catch(() => undefined);

    getAchievements()
      .then((items) => {
        if (items && items.length) {
          void getLocalAchievements().then((localItems) => {
            const combinedMap = new Map<string, AchievementItem>();
            localItems.forEach((item) => combinedMap.set(item.key, item));
            items.forEach((item) => {
              if (!combinedMap.has(item.key)) {
                const meta = ALL_ACHIEVEMENTS[item.key] || {
                  key: item.key,
                  title: item.key.replace(/_/g, ' '),
                  description: 'Wellness achievement unlocked',
                  icon: 'star' as const,
                };
                combinedMap.set(item.key, { ...meta, unlockedAt: item.unlockedAt });
              }
            });
            setAchievements(Array.from(combinedMap.values()));
          });
        }
      })
      .catch(() => undefined);

    getMood()
      .then(setMoodHistory)
      .catch(() => undefined);

    getDailyChallenges()
      .then((items) => setCompleted(items.filter((item) => item.completed).map((item) => item.key)))
      .catch(() => undefined);

    getDailyQuote()
      .then(setQuote)
      .catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData]),
  );

  const toggle = (key: string) =>
    setCompleted((current) => (current.includes(key) ? current : [...current, key]));

  const allAchievementKeys = Object.keys(ALL_ACHIEVEMENTS);
  const unlockedKeys = new Set(achievements.map((a) => a.key));

  return (
    <ScreenBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 20,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: t.colors.divider,
            }}
          >
            <View>
              <Text style={{ color: t.colors.muted, fontSize: t.typography.body }}>
                Your soft place to land
              </Text>
              <Text
                style={{
                  color: t.colors.ink,
                  fontSize: t.typography.display,
                  fontFamily: 'Nunito_700Bold',
                }}
              >
                Wellness
              </Text>
            </View>
            <CompanionBlob size={72} state="proud" moodScore={mood} frozenAt={1} />
          </View>

          {/* Level & XP Card */}
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 18 }}>
                Level & XP
              </Text>
              <Text style={{ color: t.colors.accent, fontFamily: 'Nunito_700Bold', fontSize: 15 }}>
                Total {stats.xp} XP
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text
                style={{
                  color: t.colors.ink,
                  fontFamily: 'Nunito_700Bold',
                  fontSize: 16,
                }}
              >
                Level {stats.level}
              </Text>
              <Text style={{ color: t.colors.muted, fontSize: 13 }}>
                {stats.xpIntoLevel} / {stats.xpForNext} XP
              </Text>
            </View>
            <ProgressBar value={(stats.xpIntoLevel / stats.xpForNext) * 100} />
          </Card>

          {/* Achievements Card */}
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text
                style={{
                  color: t.colors.ink,
                  fontFamily: 'Nunito_700Bold',
                  fontSize: t.typography.title,
                }}
              >
                Achievements
              </Text>
              <Text style={{ color: t.colors.muted, fontSize: 13, fontFamily: 'Nunito_700Bold' }}>
                {achievements.length} of {allAchievementKeys.length} unlocked
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {allAchievementKeys.map((key) => {
                const item = ALL_ACHIEVEMENTS[key];
                const isUnlocked = unlockedKeys.has(key);
                return (
                  <View
                    key={key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      backgroundColor: isUnlocked ? t.colors.input : 'transparent',
                      borderWidth: 1,
                      borderColor: isUnlocked ? t.colors.accent : t.colors.divider,
                      opacity: isUnlocked ? 1 : 0.6,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: isUnlocked ? t.colors.accent : t.colors.divider,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: isUnlocked ? t.colors.onAccent : t.colors.muted, fontSize: 16 }}>
                        {isUnlocked ? '★' : '○'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: isUnlocked ? t.colors.ink : t.colors.muted,
                          fontFamily: 'Nunito_700Bold',
                          fontSize: 15,
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text style={{ color: t.colors.muted, fontSize: 12, marginTop: 2 }}>
                        {item.description}
                      </Text>
                    </View>
                    {isUnlocked && (
                      <View
                        style={{
                          backgroundColor: t.colors.accent,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: t.colors.onAccent, fontSize: 11, fontFamily: 'Nunito_700Bold' }}>
                          Earned
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Weekly Mood Chart */}
          <Card style={{ gap: 12 }}>
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.title,
              }}
            >
              Mood this week
            </Text>
            {moodHistory.length ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 8 }}>
                {moodHistory.slice(-7).map((entry) => (
                  <View key={entry.createdAt} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View
                      style={{
                        width: '100%',
                        minHeight: 8,
                        height: Math.max(8, entry.score * 12),
                        borderRadius: 8,
                        backgroundColor: colorForMood(entry.score),
                      }}
                    />
                    <Text style={{ color: t.colors.muted, fontSize: 11 }}>{entry.score}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: t.colors.muted }}>Log a mood to see your weekly pattern.</Text>
            )}
          </Card>

          {/* Today's Quote */}
          <Card style={{ gap: 12 }}>
            <Text style={{ color: t.colors.ink, fontSize: 18, fontFamily: 'Nunito_700Bold' }}>Today’s note</Text>
            <Text
              style={{
                color: t.colors.ink,
                fontSize: 20,
                fontWeight: '600',
              }}
            >
              {quote?.text ?? 'You do not have to solve the whole day at once.'}
            </Text>
            <Text style={{ color: t.colors.muted, fontSize: 13 }}>— {quote?.author ?? 'Solace'}</Text>
          </Card>

          {/* Mood Check-In with Smooth Continuous Slider & Morphing Face */}
          <Card style={{ gap: 12 }}>
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.title,
              }}
            >
              How are you feeling?
            </Text>
            <MoodChoices
              value={mood}
              onChoose={(score) => {
                setMood(score);
                toggle('mood');
                void completeDailyChallenge('mood').catch(() => undefined);
                void logMood(score).catch(() => undefined);
                void addLocalXp(10, 'mood').then(({ stats: newStats, newAchievements }) => {
                  setStats(newStats);
                  if (newAchievements.length) {
                    void getLocalAchievements().then(setAchievements);
                  }
                });
              }}
            />
          </Card>

          {/* Daily Care Challenges */}
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text
                style={{
                  color: t.colors.ink,
                  fontFamily: 'Nunito_700Bold',
                  fontSize: t.typography.title,
                }}
              >
                Daily care
              </Text>
              <Text style={{ color: t.colors.accent, fontFamily: 'Nunito_700Bold' }}>+30 XP</Text>
            </View>
            <Text style={{ color: t.colors.muted }}>
              Small moments count. Pick one that feels possible.
            </Text>
            {[
              ['mood', 'Log your mood'],
              ['breath', 'One minute of breathing'],
              ['gratitude', 'Write one good thing'],
            ].map(([key, label]) => (
              <Chip
                key={key}
                label={`${completed.includes(key) ? 'Done · ' : ''}${label}`}
                selected={completed.includes(key)}
                onPress={() => {
                  if (key === 'breath') router.push('/breathing');
                  else {
                    toggle(key);
                    void completeDailyChallenge(key).catch(() => undefined);
                    void addLocalXp(10, 'daily_challenge').then(({ stats: newStats, newAchievements }) => {
                      setStats(newStats);
                      if (newAchievements.length) {
                        void getLocalAchievements().then(setAchievements);
                      }
                    });
                  }
                }}
              />
            ))}
            <ProgressBar value={(completed.length / 3) * 100} />
          </Card>

          {/* Gentle Exercises */}
          <Card style={{ gap: 12 }}>
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.title,
              }}
            >
              Gentle exercises
            </Text>
            <Button label="Start breathing" onPress={() => router.push('/breathing')} />
            <Button label="Grounding 5-4-3-2-1" onPress={() => router.push('/grounding')} />
            <Button label="Write one good thing" onPress={() => router.push('/gratitude')} />
            <Button label="Settings" onPress={() => router.push('/settings')} />
            <Text style={{ color: t.colors.muted }}>
              Your companion, {companionName}, will be here when you return.
            </Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}
