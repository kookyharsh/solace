import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanionBlob } from '../../src/companion/CompanionBlob';
import { Button, Card, Chip, GradientBackground, ProgressBar } from '../../src/components/ui';
import { useTheme } from '../../src/theme';
import {
  awardXp,
  completeDailyChallenge,
  getAchievements,
  getDailyChallenges,
  getGamification,
  getMood,
  logMood,
} from '../../src/api';

export default function Wellness() {
  const t = useTheme();
  const [companionName, setCompanionName] = useState('Your companion');
  const [mood, setMood] = useState<number>();
  const [completed, setCompleted] = useState<string[]>([]);
  const [stats, setStats] = useState({ level: 1, xp: 0, xpIntoLevel: 0, xpForNext: 100 });
  const [achievements, setAchievements] = useState<Array<{ key: string; unlockedAt: string }>>([]);
  const [moodHistory, setMoodHistory] = useState<Array<{ score: number; createdAt: string }>>([]);
  useEffect(() => {
    AsyncStorage.getItem('solace.profile').then((raw) => {
      if (raw) setCompanionName(JSON.parse(raw).companionName ?? 'Your companion');
    });
    getGamification()
      .then(setStats)
      .catch(() => undefined);
    getAchievements()
      .then(setAchievements)
      .catch(() => undefined);
    getMood()
      .then(setMoodHistory)
      .catch(() => undefined);
    getDailyChallenges()
      .then((items) => setCompleted(items.filter((item) => item.completed).map((item) => item.key)))
      .catch(() => undefined);
  }, []);
  const toggle = (key: string) =>
    setCompleted((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <View>
              <Text style={{ color: t.colors.muted, fontSize: t.typography.body }}>Your space</Text>
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
          <Card style={{ gap: t.spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text
                style={{
                  color: t.colors.ink,
                  fontFamily: 'Nunito_700Bold',
                  fontSize: t.typography.title,
                }}
              >
                Level {stats.level}
              </Text>
              <Text style={{ color: t.colors.primary }}>{stats.xp} XP</Text>
            </View>
            <ProgressBar value={(stats.xpIntoLevel / stats.xpForNext) * 100} />
          </Card>
          <Card style={{ gap: t.spacing.md }}>
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
                        backgroundColor: t.colors.primary,
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
          <Card style={{ gap: t.spacing.md }}>
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.title,
              }}
            >
              Achievements
            </Text>
            <Text style={{ color: t.colors.muted }}>
              {achievements.length
                ? achievements.map((item) => item.key).join(' · ')
                : 'Your first rewards will appear here.'}
            </Text>
          </Card>
          <Card style={{ gap: t.spacing.md }}>
            <Text style={{ color: t.colors.muted }}>Today’s note</Text>
            <Text
              style={{
                color: t.colors.ink,
                fontSize: t.typography.title,
                fontFamily: 'Nunito_700Bold',
              }}
            >
              You do not have to solve the whole day at once.
            </Text>
            <Text style={{ color: t.colors.muted }}>A quiet moment still counts.</Text>
          </Card>
          <Card style={{ gap: t.spacing.md }}>
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
              <Text style={{ color: t.colors.primary }}>+30 XP</Text>
            </View>
            {[
              ['mood', 'Log your mood'],
              ['breath', 'One minute of breathing'],
              ['gratitude', 'Write one good thing'],
            ].map(([key, label]) => (
              <Chip
                key={key}
                label={`${completed.includes(key) ? '✓ ' : ''}${label}`}
                selected={completed.includes(key)}
                onPress={() => {
                  if (key === 'breath') router.push('/breathing');
                  else {
                    toggle(key);
                    void completeDailyChallenge(key).catch(() => undefined);
                    if (!completed.includes(key))
                      void awardXp(
                        'daily_challenge',
                        10,
                        `${key}-${new Date().toISOString().slice(0, 10)}`,
                      ).catch(() => undefined);
                  }
                }}
              />
            ))}
            <ProgressBar value={(completed.length / 3) * 100} />
          </Card>
          <Card style={{ gap: t.spacing.md }}>
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.title,
              }}
            >
              How are you feeling?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {['😔', '🙁', '😐', '🙂', '😊'].map((emoji, index) => (
                <Chip
                  key={emoji}
                  label={emoji}
                  selected={mood === index + 1}
                  onPress={() => {
                    setMood(index + 1);
                    toggle('mood');
                    void logMood(index + 1).catch(() => undefined);
                  }}
                />
              ))}
            </View>
          </Card>
          <Card style={{ gap: t.spacing.md }}>
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
    </GradientBackground>
  );
}
