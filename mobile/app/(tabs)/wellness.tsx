import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanionBlob } from '../../src/companion/CompanionBlob';
import { Button, Card, Chip, GradientBackground, ProgressBar } from '../../src/components/ui';
import { useTheme } from '../../src/theme';

export default function Wellness() {
  const t = useTheme();
  const [companionName, setCompanionName] = useState('Your companion');
  const [mood, setMood] = useState<number>();
  const [completed, setCompleted] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem('solace.profile').then((raw) => {
      if (raw) setCompanionName(JSON.parse(raw).companionName ?? 'Your companion');
    });
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
            <CompanionBlob size={72} state="proud" moodScore={mood} />
          </View>
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
                onPress={() => (key === 'breath' ? router.push('/breathing') : toggle(key))}
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
            <Text style={{ color: t.colors.muted }}>
              Your companion, {companionName}, will be here when you return.
            </Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
