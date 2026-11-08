import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme';
import {
  flushQueuedChatMessages,
  getConversationMessages,
  queueChatMessage,
  streamChat,
} from '../../src/api';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
};
const starter: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Hi. I’m here with you. What feels present for you today?',
    parts: [{ type: 'quick_replies' }],
  },
];

export default function Chat() {
  const t = useTheme();
  const [messages, setMessages] = useState(starter);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const [conversationId, setConversationId] = useState<string | undefined>(params.conversationId);
  const [companionName, setCompanionName] = useState('Your companion');
  useEffect(() => {
    AsyncStorage.getItem('solace.profile').then((raw) => {
      if (raw) setCompanionName(JSON.parse(raw).companionName || 'Your companion');
    });
  }, []);
  useEffect(() => {
    void flushQueuedChatMessages();
  }, []);
  useEffect(() => {
    if (!params.conversationId) return;
    setConversationId(params.conversationId);
    void getConversationMessages(params.conversationId)
      .then((items) => {
        setMessages(
          items.map((item) => ({
            id: item.id,
            role: item.role,
            text: item.parts.find((part) => part.type === 'text')?.text ?? '',
            parts: item.parts,
          })),
        );
      })
      .catch(() => undefined);
  }, [params.conversationId]);
  const send = (value = draft) => {
    const text = value.trim();
    if (!text || thinking) return;
    setDraft('');
    setMessages((current) => [...current, { id: `${Date.now()}-u`, role: 'user', text }]);
    setThinking(true);
    const assistantId = `${Date.now()}-a`;
    setMessages((current) => [...current, { id: assistantId, role: 'assistant', text: '' }]);
    void streamChat(text, conversationId, (delta) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? { ...message, text: message.text + delta } : message,
        ),
      );
    })
      .then((response) => {
        setConversationId(response.conversationId);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, parts: response.parts } : message,
          ),
        );
      })
      .catch(() => {
        void queueChatMessage(text, conversationId);
        const mood = text.toLowerCase().includes('mood');
        setMessages((current) => [
          ...current.filter((message) => message.id !== assistantId),
          {
            id: `${Date.now()}-a`,
            role: 'assistant',
            text: mood
              ? 'Let’s check in gently. Which one is closest right now?'
              : 'Thank you for telling me. I’m listening. What part feels heaviest?',
            parts: [{ type: mood ? 'mood_picker' : 'quick_replies' }],
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
              {companionName}
            </Text>
            <Text style={{ color: t.colors.muted }}>A gentle place to be heard</Text>
          </View>
          <IconButton label="Today journal" icon="◷" onPress={() => router.push('/today')} />
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
                {item.parts?.some((part) => part.type === 'quick_replies') && (
                  <View style={{ gap: t.spacing.sm, marginTop: t.spacing.md }}>
                    {quick.map((option) => (
                      <Chip key={option} label={option} onPress={() => send(option)} />
                    ))}
                  </View>
                )}
                {item.parts?.some((part) => part.type === 'mood_picker') && (
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
                {item.parts?.map((part, index) => {
                  if (part.type === 'mood_chart') {
                    const entries = Array.isArray(part.entries)
                      ? (part.entries as Array<{ score: number }>).slice(-7)
                      : [];
                    return (
                      <View key={`mood-${index}`} style={{ marginTop: t.spacing.md, gap: 6 }}>
                        <Text style={{ color: t.colors.muted }}>Mood this week</Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-end',
                            height: 58,
                            gap: 5,
                          }}
                        >
                          {entries.map((entry, entryIndex) => (
                            <View
                              key={`${entryIndex}-${entry.score}`}
                              style={{ flex: 1, alignItems: 'center' }}
                            >
                              <View
                                style={{
                                  width: '100%',
                                  height: Math.max(6, entry.score * 10),
                                  backgroundColor: t.colors.secondary,
                                  borderRadius: 6,
                                }}
                              />
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  }
                  if (part.type === 'xp_card')
                    return (
                      <Card key={`xp-${index}`} style={{ marginTop: t.spacing.md, gap: 4 }}>
                        <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold' }}>
                          Level {String(part.level)} · {String(part.xp)} XP
                        </Text>
                        <Text style={{ color: t.colors.muted }}>
                          {String(part.xpIntoLevel)} / {String(part.xpForNext)} to the next level
                        </Text>
                      </Card>
                    );
                  if (part.type === 'streak_card')
                    return (
                      <Text
                        key={`streak-${index}`}
                        style={{ color: t.colors.primary, marginTop: t.spacing.md }}
                      >
                        ✨ {String(part.current)} day streak · best {String(part.longest)}
                      </Text>
                    );
                  if (part.type === 'quote_card')
                    return (
                      <Card key={`quote-${index}`} style={{ marginTop: t.spacing.md }}>
                        <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold' }}>
                          {String(part.text)}
                        </Text>
                        <Text style={{ color: t.colors.muted, marginTop: 4 }}>
                          — {String(part.author)}
                        </Text>
                      </Card>
                    );
                  if (part.type === 'activity_card')
                    return (
                      <Chip
                        key={`activity-${index}`}
                        label={`${String(part.title)} · +${String(part.xp)} XP`}
                        onPress={() =>
                          router.push(
                            String(part.kind) === 'breathing' ? '/breathing' : '/grounding',
                          )
                        }
                      />
                    );
                  return null;
                })}
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
