import { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';

export default function Settings() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  useEffect(() => {
    AsyncStorage.getItem('solace.profile').then((raw) => {
      if (raw) {
        const value = JSON.parse(raw);
        setName(value.companionName ?? '');
        setNickname(value.nickname ?? '');
      }
    });
  }, []);
  const save = async () => {
    const existing = await AsyncStorage.getItem('solace.profile');
    const value = existing ? JSON.parse(existing) : {};
    await AsyncStorage.setItem(
      'solace.profile',
      JSON.stringify({
        ...value,
        companionName: name.trim() || 'Mochi',
        nickname: nickname.trim(),
      }),
    );
    router.back();
  };
  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1, padding: t.spacing.lg, gap: t.spacing.lg }}>
        <Text
          style={{
            color: t.colors.ink,
            fontSize: t.typography.display,
            fontFamily: 'Nunito_700Bold',
          }}
        >
          Settings
        </Text>
        <Card style={{ gap: t.spacing.md }}>
          <Text
            style={{
              color: t.colors.ink,
              fontSize: t.typography.title,
              fontFamily: 'Nunito_700Bold',
            }}
          >
            Your profile
          </Text>
          <Text style={{ color: t.colors.muted }}>Companion name</Text>
          <TextInput
            accessibilityLabel="Companion name"
            value={name}
            onChangeText={setName}
            style={{
              color: t.colors.ink,
              backgroundColor: t.colors.background,
              borderRadius: t.radii.md,
              padding: t.spacing.md,
            }}
          />
          <Text style={{ color: t.colors.muted }}>Your name</Text>
          <TextInput
            accessibilityLabel="Your name"
            value={nickname}
            onChangeText={setNickname}
            style={{
              color: t.colors.ink,
              backgroundColor: t.colors.background,
              borderRadius: t.radii.md,
              padding: t.spacing.md,
            }}
          />
          <Button label="Save changes" onPress={() => void save()} />
        </Card>
        <Card>
          <Text style={{ color: t.colors.muted, lineHeight: 22 }}>
            Solace is a companion, not a replacement for professional care. If you may be in danger,
            contact local emergency services or a trusted person.
          </Text>
        </Card>
        <Button label="Back" onPress={() => router.back()} />
      </SafeAreaView>
    </GradientBackground>
  );
}
