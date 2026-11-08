import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanionBlob } from '../src/companion/CompanionBlob';
import { Button, Card, Chip, GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';

export default function Onboarding() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [mood, setMood] = useState(3);
  const finish = async () => {
    const companionName = name.trim() || 'Mochi';
    await AsyncStorage.multiSet([
      ['solace.onboarding', 'done'],
      ['solace.profile', JSON.stringify({ companionName, nickname: nickname.trim(), mood })],
    ]);
    router.replace('/(tabs)/chat');
  };
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
            <Button label="Enter Solace" onPress={() => void finish()} />
          </Card>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}
