import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanionBlob } from '../../src/companion/CompanionBlob';
import { Card, Chip, GradientBackground, IconButton } from '../../src/components/ui';
import { router } from 'expo-router';
import { useTheme } from '../../src/theme';
import { sendChat } from '../../src/api';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  part?: 'mood_picker' | 'quick_replies';
};
const starter: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hi. I’m here with you. What feels present for you today?',
    part: 'quick_replies',
  },
];

export default function Chat() {
  const t = useTheme();
  const [messages, setMessages] = useState(starter);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const send = (value = draft) => {
    const text = value.trim();
    if (!text || thinking) return;
    setDraft('');
    setMessages((current) => [...current, { id: `${Date.now()}-u`, role: 'user', text }]);
    setThinking(true);
    void sendChat(text)
      .then((response) => {
        const textPart = response.assistantMessage.parts.find((part) => part.type === 'text');
        const structured = response.assistantMessage.parts.find(
          (part) => part.type === 'mood_picker' || part.type === 'quick_replies',
        );
        setMessages((current) => [
          ...current,
          {
            id: `${Date.now()}-a`,
            role: 'assistant',
            text: textPart?.text ?? 'I’m here with you.',
            part: structured?.type as ChatMessage['part'],
          },
        ]);
      })
      .catch(() => {
        const mood = text.toLowerCase().includes('mood');
        setMessages((current) => [
          ...current,
          {
            id: `${Date.now()}-a`,
            role: 'assistant',
            text: mood
              ? 'Let’s check in gently. Which one is closest right now?'
              : 'Thank you for telling me. I’m listening. What part feels heaviest?',
            part: mood ? 'mood_picker' : 'quick_replies',
          },
        ]);
      })
      .finally(() => setThinking(false));
  };
  const quick = useMemo(() => ['I feel low', 'I feel okay', 'I want to reflect'], []);
  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View
          style={{
            paddingHorizontal: t.spacing.lg,
            paddingVertical: t.spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
          }}
        >
          <CompanionBlob size={52} state={thinking ? 'thinking' : 'idle'} />
          <View>
            <Text
              style={{
                color: t.colors.ink,
                fontFamily: 'Nunito_700Bold',
                fontSize: t.typography.title,
              }}
            >
              Your companion
            </Text>
            <Text style={{ color: t.colors.muted }}>A gentle place to be heard</Text>
          </View>
          <IconButton label="Chat history" icon="☰" onPress={() => router.push('/history')} />
        </View>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <View style={{ alignItems: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <Card
                style={{
                  maxWidth: '88%',
                  backgroundColor: item.role === 'user' ? t.colors.primary : t.colors.surface,
                }}
              >
                <Text
                  style={{
                    color: item.role === 'user' ? '#fff' : t.colors.ink,
                    fontSize: t.typography.body,
                  }}
                >
                  {item.text}
                </Text>
                {item.part === 'quick_replies' && (
                  <View style={{ gap: t.spacing.sm, marginTop: t.spacing.md }}>
                    {quick.map((option) => (
                      <Chip key={option} label={option} onPress={() => send(option)} />
                    ))}
                  </View>
                )}
                {item.part === 'mood_picker' && (
                  <View
                    style={{ flexDirection: 'row', gap: t.spacing.sm, marginTop: t.spacing.md }}
                  >
                    {['😔', '🙁', '😐', '🙂', '😊'].map((emoji) => (
                      <Pressable
                        key={emoji}
                        accessibilityLabel={`Mood ${emoji}`}
                        onPress={() => send(`I feel ${emoji}`)}
                      >
                        <Text style={{ fontSize: 28 }}>{emoji}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </Card>
            </View>
          )}
        />
        {thinking && (
          <Text
            style={{ position: 'absolute', bottom: 90, left: t.spacing.lg, color: t.colors.muted }}
          >
            Your companion is thinking…
          </Text>
        )}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={10}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: t.spacing.md,
            backgroundColor: t.colors.background,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <TextInput
              accessibilityLabel="Message your companion"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => send()}
              placeholder="Talk to your companion…"
              placeholderTextColor={t.colors.muted}
              style={{
                flex: 1,
                backgroundColor: t.colors.surface,
                color: t.colors.ink,
                borderRadius: t.radii.pill,
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.sm,
                fontSize: t.typography.body,
              }}
            />
            <IconButton label="Send message" icon="↑" onPress={() => send()} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}
