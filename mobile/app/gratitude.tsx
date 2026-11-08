import { useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Card, GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { awardXp, completeDailyChallenge, saveJournalEntry } from '../src/api';

export default function Gratitude() {
  const t = useTheme();
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  return (
    <GradientBackground>
      <SafeAreaView
        style={{ flex: 1, padding: t.spacing.lg, justifyContent: 'center', gap: t.spacing.lg }}
      >
        <Text
          style={{
            color: t.colors.ink,
            fontSize: t.typography.display,
            fontFamily: 'Nunito_700Bold',
          }}
        >
          One good thing
        </Text>
        <Text style={{ color: t.colors.muted, fontSize: t.typography.body }}>
          It can be tiny: a warm drink, a message, or a few quiet minutes.
        </Text>
        <Card style={{ gap: t.spacing.md }}>
          <TextInput
            accessibilityLabel="Gratitude note"
            multiline
            value={note}
            onChangeText={setNote}
            placeholder="Today I appreciated…"
            placeholderTextColor={t.colors.muted}
            style={{
              color: t.colors.ink,
              minHeight: 100,
              fontSize: t.typography.body,
              textAlignVertical: 'top',
            }}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!note.trim() || saved}
            onPress={() => {
              setSaved(true);
              void completeDailyChallenge('gratitude').catch(() => undefined);
              void saveJournalEntry(`Today I’m grateful for: ${note.trim()}`).catch(
                () => undefined,
              );
              void awardXp(
                'gratitude',
                15,
                `gratitude-${new Date().toISOString().slice(0, 10)}`,
              ).catch(() => undefined);
            }}
            style={{
              backgroundColor: t.colors.primary,
              borderRadius: t.radii.pill,
              padding: t.spacing.md,
              opacity: !note.trim() || saved ? 0.5 : 1,
            }}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontFamily: 'Nunito_700Bold' }}>
              {saved ? 'Saved · +15 XP' : 'Save gratitude'}
            </Text>
          </Pressable>
        </Card>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: t.colors.primary, textAlign: 'center' }}>Back to wellness</Text>
        </Pressable>
      </SafeAreaView>
    </GradientBackground>
  );
}
