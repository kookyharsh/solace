import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Switch, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanionBlob } from '../src/companion/CompanionBlob';
import { Button, Card, Chip, GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { useGoogleSignIn } from '../src/googleAuth';
import { ensureGuestSession, updateProfile } from '../src/api';

export default function Onboarding() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [mood, setMood] = useState(3);
  const [memoryConsent, setMemoryConsent] = useState(false);
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [goals, setGoals] = useState<string[]>([]);
  const [wakeTime, setWakeTime] = useState('08:00');
  const [sleepTime, setSleepTime] = useState('22:00');
  const finish = async () => {
    const companionName = name.trim() || null;
    await ensureGuestSession();
    await updateProfile({
      companionName,
      nickname: nickname.trim() || null,
      memoryConsent,
      notificationConsent,
      goals,
      wakeTime,
      sleepTime,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).catch(() => undefined);
    await AsyncStorage.multiSet([
      ['solace.onboarding', 'done'],
      [
        'solace.profile',
        JSON.stringify({
          companionName,
          nickname: nickname.trim(),
          mood,
          memoryConsent,
          notificationConsent,
          goals,
          wakeTime,
          sleepTime,
        }),
      ],
    ]);
    router.replace('/(tabs)/chat');
  };
  const google = useGoogleSignIn(() => void finish());
  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, padding: t.spacing.lg, gap: t.spacing.lg }}
        >
          <View style={{ alignItems: 'center', gap: t.spacing.md, marginTop: t.spacing.lg }}>
            <CompanionBlob size={110} state="happy" />
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.display,
              }}
            >
              A gentle start
            </Text>
            <Text
              style={{ color: t.colors.muted, textAlign: 'center', fontSize: t.typography.body }}
            >
              This is your space to be heard. You can change everything later.
            </Text>
          </View>
          <Card style={{ gap: t.spacing.md }}>
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.title,
              }}
            >
              What should I be called?
            </Text>
            <TextInput
              accessibilityLabel="Companion name"
              value={name}
              onChangeText={setName}
              placeholder="Name your companion"
              placeholderTextColor={t.colors.muted}
              style={{
                color: t.colors.ink,
                backgroundColor: t.colors.background,
                borderRadius: t.radii.md,
                padding: t.spacing.md,
                fontSize: t.typography.body,
              }}
            />
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              {['Mochi', 'Luna', 'Pip'].map((suggestion) => (
                <Chip
                  key={suggestion}
                  label={suggestion}
                  selected={name === suggestion}
                  onPress={() => setName(suggestion)}
                />
              ))}
            </View>
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.title,
              }}
            >
              And what can I call you?
            </Text>
            <TextInput
              accessibilityLabel="Your nickname"
              value={nickname}
              onChangeText={setNickname}
              placeholder="Your name or nickname"
              placeholderTextColor={t.colors.muted}
              style={{
                color: t.colors.ink,
                backgroundColor: t.colors.background,
                borderRadius: t.radii.md,
                padding: t.spacing.md,
                fontSize: t.typography.body,
              }}
            />
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.title,
              }}
            >
              How are you feeling today?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {['😔', '🙁', '😐', '🙂', '😊'].map((emoji, index) => (
                <Chip
                  key={emoji}
                  label={emoji}
                  selected={mood === index + 1}
                  onPress={() => setMood(index + 1)}
                />
              ))}
            </View>
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.title,
              }}
            >
              What would you like gentle help with?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {['Stress', 'Sleep', 'Focus', 'Loneliness', 'Building habits'].map((goal) => {
                const selected = goals.includes(goal);
                return (
                  <Chip
                    key={goal}
                    label={goal}
                    selected={selected}
                    onPress={() =>
                      setGoals((current) =>
                        selected ? current.filter((item) => item !== goal) : [...current, goal],
                      )
                    }
                  />
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.colors.muted, marginBottom: 4 }}>Wake time</Text>
                <TextInput
                  accessibilityLabel="Wake time"
                  value={wakeTime}
                  onChangeText={setWakeTime}
                  placeholder="08:00"
                  placeholderTextColor={t.colors.muted}
                  keyboardType="numbers-and-punctuation"
                  style={{
                    color: t.colors.ink,
                    backgroundColor: t.colors.background,
                    borderRadius: t.radii.md,
                    padding: t.spacing.md,
                    fontSize: t.typography.body,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.colors.muted, marginBottom: 4 }}>Sleep time</Text>
                <TextInput
                  accessibilityLabel="Sleep time"
                  value={sleepTime}
                  onChangeText={setSleepTime}
                  placeholder="22:00"
                  placeholderTextColor={t.colors.muted}
                  keyboardType="numbers-and-punctuation"
                  style={{
                    color: t.colors.ink,
                    backgroundColor: t.colors.background,
                    borderRadius: t.radii.md,
                    padding: t.spacing.md,
                    fontSize: t.typography.body,
                  }}
                />
              </View>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: t.spacing.md }}>
                <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold' }}>
                  Let your companion remember
                </Text>
                <Text style={{ color: t.colors.muted }}>
                  You can review or delete memories anytime.
                </Text>
              </View>
              <Switch value={memoryConsent} onValueChange={setMemoryConsent} />
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: t.spacing.md }}>
                <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold' }}>
                  Gentle notifications
                </Text>
                <Text style={{ color: t.colors.muted }}>Optional reminders and check-ins.</Text>
              </View>
              <Switch value={notificationConsent} onValueChange={setNotificationConsent} />
            </View>
            <Text style={{ color: t.colors.muted, lineHeight: 22 }}>
              Solace is a companion, not a replacement for professional care.
            </Text>
            <Button label="Enter as guest" onPress={() => void finish()} />
            {google.ready && (
              <Button label="Continue with Google" onPress={() => void google.signIn()} />
            )}
          </Card>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}
