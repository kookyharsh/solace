import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { scheduleGentleReminder } from '../src/notifications';
import { deleteMemory, exportAccount, getMemories, updateProfile } from '../src/api';

export default function Settings() {
  const t = useTheme();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [memories, setMemories] = useState<Array<{ id: string; text: string; category: string }>>(
    [],
  );
  useEffect(() => {
    AsyncStorage.getItem('solace.profile').then((raw) => {
      if (raw) {
        const value = JSON.parse(raw);
        setName(value.companionName ?? '');
        setNickname(value.nickname ?? '');
      }
    });
    getMemories()
      .then(setMemories)
      .catch(() => undefined);
  }, []);
  const save = async () => {
    const existing = await AsyncStorage.getItem('solace.profile');
    const value = existing ? JSON.parse(existing) : {};
    await AsyncStorage.setItem(
      'solace.profile',
      JSON.stringify({
        ...value,
        companionName: name.trim() || null,
        nickname: nickname.trim(),
      }),
    );
    await updateProfile({
      companionName: name.trim() || null,
      nickname: nickname.trim() || null,
    }).catch(() => undefined);
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
          <Button
            label="Schedule a gentle reminder"
            onPress={() => void scheduleGentleReminder()}
          />
          <Button
            label="Export my data"
            onPress={() =>
              void exportAccount()
                .then(() =>
                  Alert.alert('Export ready', 'Your Solace data was prepared successfully.'),
                )
                .catch(() =>
                  Alert.alert('Export unavailable', 'Please try again when you are online.'),
                )
            }
          />
        </Card>
        <Card style={{ gap: t.spacing.sm }}>
          <Text
            style={{
              color: t.colors.ink,
              fontSize: t.typography.title,
              fontFamily: 'Nunito_700Bold',
            }}
          >
            What your companion remembers
          </Text>
          {memories.length ? (
            memories.map((memory) => (
              <View
                key={memory.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: t.spacing.sm,
                }}
              >
                <Text style={{ color: t.colors.muted, flex: 1 }}>{memory.text}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    void deleteMemory(memory.id).then(() =>
                      setMemories((current) => current.filter((item) => item.id !== memory.id)),
                    )
                  }
                >
                  <Text style={{ color: '#B05A62' }}>Delete</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={{ color: t.colors.muted }}>No saved memories yet.</Text>
          )}
        </Card>
        <Card>
          <Text style={{ color: t.colors.muted, lineHeight: 22 }}>
            Solace is a companion, not a replacement for professional care. If you may be in danger,
            contact local emergency services or a trusted person.
          </Text>
        </Card>
        <Card>
          <Text style={{ color: t.colors.muted, lineHeight: 22 }}>
            Credits: companion animation engine adapted from Bloub (MIT License). The original
            source is preserved in references/.
          </Text>
        </Card>
        <Button label="Back" onPress={() => router.back()} />
      </SafeAreaView>
    </GradientBackground>
  );
}
