import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button } from 'heroui-native/button';
import { Input } from 'heroui-native/input';
import { History, Mic, Plus, Send, Settings, Square } from 'lucide-react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { isMoodCheckInRequest } from '@solace/contracts';
import { CompanionBlob } from '../../src/companion/CompanionBlob';
import {
  asCompanionState,
  reactionForMessage,
  reactionForMood,
  type CompanionState,
} from '../../src/companion/companionStates';
import { Card, Chip } from '../../src/components/ui';
import {
  ConversationBackground,
  ConversationBubble,
  ConversationIconButton,
  ThinkingBubble,
  useConversationReduceMotion,
} from '../../src/components/conversation';
import { MoodChoices, moodLabel, type MoodScore } from '../../src/components/MoodChoices';
import { useTheme } from '../../src/theme';
import { offlineRepository, type CachedChatMessage } from '../../src/offline/repository';
import {
  flushQueuedChatMessages,
  getConversationMessages,
  logMood,
  queueChatMessage,
  streamChat,
} from '../../src/api';

const welcome: CachedChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hey, I’m here with you. What’s on your mind today?',
  parts: [{ type: 'quick_replies' }],
};
const quickReplies = ['I feel low', 'I feel okay', 'I want to reflect'];

type Reveal = { id: string; visible: number; total: number };
type AvatarReaction = { state: CompanionState; expression?: string };

function replyBubbles(text: string) {
  const pieces = text.split(/([.!?]+(?:\s+|$)|\n{2,})/u);
  const bubbles: string[] = [];
  for (let i = 0; i < pieces.length; i += 2) {
    const bubble = (pieces[i] + (pieces[i + 1] ?? '')).trim();
    if (bubble) bubbles.push(bubble);
  }
  if (bubbles.length > 4) bubbles.splice(3, bubbles.length, bubbles.slice(3).join(' '));
  return bubbles.length ? bubbles : [''];
}

export default function Chat() {
  const { conversationId, fresh } = useLocalSearchParams<{
    conversationId?: string;
    fresh?: string;
  }>();
  return (
    <ChatThread
      key={`${conversationId ?? 'current'}-${fresh ?? ''}`}
      initialConversationId={conversationId}
      startFresh={!!fresh}
    />
  );
}

function ChatThread({
  initialConversationId,
  startFresh,
}: {
  initialConversationId?: string;
  startFresh: boolean;
}) {
  const { colors } = useTheme();
  const animate = useConversationReduceMotion() === false;
  const [messages, setMessages] = useState<CachedChatMessage[]>(
    initialConversationId ? [] : [welcome],
  );
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [companionName, setCompanionName] = useState('Solace');
  const [avatarMood, setAvatarMood] = useState<number>();
  const [avatarReaction, setAvatarReaction] = useState<AvatarReaction>();
  const [draft, setDraft] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [focused, setFocused] = useState(false);
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [reveal, setReveal] = useState<Reveal>();
  const [liveReplyId, setLiveReplyId] = useState<string | undefined>(
    initialConversationId ? undefined : welcome.id,
  );
  const [savingMood, setSavingMood] = useState(false);
  const [moodError, setMoodError] = useState(false);
  const [listening, setListening] = useState(false);
  const list = useRef<FlatList<CachedChatMessage>>(null);
  const follow = useRef(true);
  const request = useRef<AbortController | undefined>(undefined);
  const moodRequest = useRef(false);
  const liveReply = useRef(liveReplyId);
  const sequence = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', () => setListening(false));
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) setDraft(transcript.slice(0, 4000));
  });

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem('solace.profile')
      .then((raw) => {
        if (active && raw) {
          const profile = JSON.parse(raw);
          setCompanionName(profile.companionName || 'Solace');
          if (typeof profile.mood === 'number') setAvatarMood(profile.mood);
        }
      })
      .catch(() => undefined);
    void flushQueuedChatMessages().catch(() => undefined);

    async function load() {
      const cached = await offlineRepository
        .readTranscript()
        .catch(() => ({ conversationId: undefined, messages: [] }));
      if (!active) return;
      const matching =
        !startFresh &&
        (initialConversationId === undefined || cached.conversationId === initialConversationId);
      const usable = matching
        ? cached.messages.filter((item) => item.text || item.parts?.length)
        : [];
      if (usable.some((item) => item.id !== welcome.id)) {
        setMessages(usable);
        setConversationId(cached.conversationId ?? initialConversationId);
        liveReply.current = undefined;
        setLiveReplyId(undefined);
      }
      if (initialConversationId) {
        try {
          const items = await getConversationMessages(initialConversationId);
          if (active)
            setMessages(
              items.map((item) => ({
                id: item.id,
                role: item.role,
                text: item.parts
                  .filter((part) => part.type === 'text')
                  .map((part) => part.text ?? '')
                  .join('\n'),
                parts: item.parts,
                moodLabel: usable.find((message) => message.id === item.id)?.moodLabel,
              })),
            );
        } catch {
          if (active && !usable.length) setHistoryUnavailable(true);
        }
      }
      if (active) setHydrated(true);
    }
    void load();
    return () => {
      active = false;
      request.current?.abort();
    };
  }, [initialConversationId, startFresh]);

  useEffect(() => {
    if (!focused || !hydrated || pending || !messages.some((item) => item.id !== welcome.id))
      return;
    void offlineRepository.writeTranscript({ conversationId, messages }).catch(() => undefined);
  }, [conversationId, focused, hydrated, messages, pending]);

  useEffect(() => {
    if (!reveal) return;
    if (!animate) {
      setReveal(undefined);
      return;
    }
    const complete = reveal.visible >= reveal.total;
    const timer = setTimeout(
      () => setReveal(complete ? undefined : { ...reveal, visible: reveal.visible + 1 }),
      complete ? 210 : 180,
    );
    return () => clearTimeout(timer);
  }, [animate, reveal]);

  useEffect(() => {
    if (!avatarReaction) return;
    const timer = setTimeout(() => setAvatarReaction(undefined), 1800);
    return () => clearTimeout(timer);
  }, [avatarReaction]);

  const send = async (value?: string) => {
    const text = (value ?? draft).trim();
    if (!text || !hydrated || request.current || moodRequest.current) return;
    const moodCheckIn = isMoodCheckInRequest(text);
    const controller = new AbortController();
    request.current = controller;
    liveReply.current = undefined;
    setLiveReplyId(undefined);
    setMoodError(false);
    setReveal(undefined);
    setAvatarReaction(undefined);
    setHistoryUnavailable(false);
    if (value === undefined) setDraft('');
    follow.current = true;
    const localId = Date.now() + '-' + sequence.current++;
    setMessages((current) => [...current, { id: localId + '-user', role: 'user', text }]);
    setPending(true);

    let assistantText = '';
    let reply: CachedChatMessage;
    try {
      const response = await streamChat(
        text,
        conversationId,
        (delta) => {
          assistantText += delta;
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setConversationId(response.conversationId);
      reply = {
        id: response.messageId,
        role: 'assistant',
        text: assistantText,
        parts: response.parts.filter((part) => moodCheckIn || part.type !== 'mood_picker'),
      };
    } catch {
      if (controller.signal.aborted) return;
      if (!moodCheckIn && !assistantText)
        void queueChatMessage(text, conversationId).catch(() => undefined);
      reply = {
        id: localId + '-offline',
        role: 'assistant',
        text: moodCheckIn
          ? 'Let’s check in. Which of these feels closest right now?'
          : 'I’m having trouble connecting. What part feels heaviest right now?',
        parts: [{ type: moodCheckIn ? 'mood_picker' : 'quick_replies' }],
      };
    }
    request.current = undefined;
    setPending(false);
    liveReply.current = reply.id;
    setLiveReplyId(reply.id);
    const crisis = reply.parts?.some((part) => part.type === 'crisis_card');
    const companion = reply.parts?.find((part) => part.type === 'companion');
    const celebrating = reply.parts?.some((part) => part.type === 'level_up');
    let state = asCompanionState(companion?.state) ?? reactionForMessage(text);
    if (moodCheckIn) state = 'listening';
    if (celebrating) state = 'proud';
    if (crisis) state = 'caring';
    const expression =
      !crisis && typeof companion?.expression === 'string' ? companion.expression : undefined;
    setAvatarReaction({ state, expression });
    if (animate && !crisis) {
      setReveal({ id: reply.id, visible: 1, total: replyBubbles(reply.text).length });
    }
    setMessages((current) => [...current, reply]);
  };

  const chooseMood = async (messageId: string, score: MoodScore) => {
    if (liveReply.current !== messageId || moodRequest.current || request.current) return;
    moodRequest.current = true;
    setSavingMood(true);
    setMoodError(false);
    setAvatarMood(score);
    setAvatarReaction({ state: reactionForMood(score) });
    try {
      const saved = await logMood(score, undefined, messageId);
      if (saved.score !== score) {
        setAvatarMood(saved.score);
        setAvatarReaction({ state: reactionForMood(saved.score) });
      }
      liveReply.current = undefined;
      setLiveReplyId(undefined);
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId ? { ...item, moodLabel: moodLabel(saved.score) } : item,
        ),
      );
    } catch {
      setMoodError(true);
    } finally {
      moodRequest.current = false;
      setSavingMood(false);
    }
  };

  const latest = messages.at(-1);
  const latestId = latest?.id;
  const hasActiveMoodPrompt =
    latestId === liveReplyId && latest?.parts?.some((part) => part.type === 'mood_picker');
  const controlsDisabled = !hydrated || pending || savingMood;
  const avatarState = pending
    ? 'thinking'
    : (avatarReaction?.state ?? (draft.trim() || listening ? 'listening' : 'idle'));
  const scrollToLatest = () => {
    if (follow.current) list.current?.scrollToEnd({ animated: false });
  };

  return (
    <ConversationBackground>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'web' ? undefined : 'padding'}
        >
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderBottomWidth: 1,
              borderColor: colors.border,
            }}
          >
            <CompanionBlob
              size={50}
              state={avatarState}
              moodScore={avatarMood}
              expression={avatarReaction?.expression}
              frozenAt={focused ? 0 : 1}
            />
            <View style={{ flex: 1, marginRight: 4 }}>
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={{ color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 23 }}
              >
                {companionName}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Here with you</Text>
            </View>
            <ConversationIconButton
              label="Start a new chat"
              iconNode={<Plus color={colors.ink} size={20} strokeWidth={2.25} />}
              onPress={() =>
                router.replace({
                  pathname: '/(tabs)/chat',
                  params: { fresh: Date.now().toString() },
                })
              }
            />
            <ConversationIconButton
              label="Today journal"
              icon="clock"
              onPress={() => router.push('/today')}
            />
            <ConversationIconButton
              label="Chat history"
              iconNode={<History color={colors.ink} size={20} strokeWidth={2.25} />}
              onPress={() => router.push('/history')}
            />
            <ConversationIconButton
              label="Settings"
              iconNode={<Settings color={colors.ink} size={20} strokeWidth={2.25} />}
              onPress={() => router.push('/settings')}
            />
          </View>
          <FlatList
            ref={list}
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              width: '100%',
              maxWidth: 720,
              alignSelf: 'center',
              padding: 16,
              gap: 12,
            }}
            onContentSizeChange={scrollToLatest}
            onLayout={scrollToLatest}
            onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
              follow.current =
                contentSize.height - layoutMeasurement.height - contentOffset.y < 110;
            }}
            scrollEventThrottle={32}
            ListEmptyComponent={
              historyUnavailable ? (
                <ConversationBubble text="I couldn’t load this conversation. You can try again from your chat history." />
              ) : undefined
            }
            ListFooterComponent={pending ? <ThinkingBubble reduceMotion={!animate} /> : undefined}
            renderItem={({ item }) => {
              if (item.role === 'user') return <ConversationBubble role="user" text={item.text} />;
              const live = hydrated && item.id === latestId && item.id === liveReplyId;
              const motion = animate && reveal?.id === item.id ? reveal : undefined;
              const bubbles = replyBubbles(item.text);
              const quick = live && item.parts?.find((part) => part.type === 'quick_replies');
              const mood = live && item.parts?.some((part) => part.type === 'mood_picker');
              return (
                <View style={{ gap: 7 }}>
                  {bubbles.slice(0, motion?.visible ?? bubbles.length).map((bubble, index) => (
                    <ConversationBubble key={index} text={bubble} animate={!!motion}>
                      {index === bubbles.length - 1 && <RichMessageParts item={item} />}
                    </ConversationBubble>
                  ))}
                  {(!motion || motion.visible >= bubbles.length) && (
                    <>
                      {!!quick && !mood && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {(Array.isArray(quick.options)
                            ? (quick.options as string[])
                            : quickReplies
                          ).map((option) => (
                            <Button
                              key={option}
                              size="sm"
                              variant="outline"
                              isDisabled={controlsDisabled}
                              onPress={() => {
                                if (liveReply.current === item.id) void send(option);
                              }}
                            >
                              {option}
                            </Button>
                          ))}
                        </View>
                      )}
                      {!!mood && (
                        <View style={{ gap: 8, alignSelf: 'flex-start', maxWidth: '100%' }}>
                          <MoodChoices
                            disabled={controlsDisabled}
                            onChoose={(score) => void chooseMood(item.id, score)}
                          />
                          {savingMood && (
                            <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>
                              Saving your check-in…
                            </Text>
                          )}
                          {moodError && (
                            <Text accessibilityRole="alert" style={{ color: colors.ink }}>
                              I couldn’t save that check-in. Tap your choice to try again.
                            </Text>
                          )}
                        </View>
                      )}
                      {!!item.moodLabel && (
                        <Text
                          accessibilityLiveRegion="polite"
                          style={{ color: colors.primary, fontFamily: 'Nunito_700Bold' }}
                        >
                          {'Mood saved · ' + item.moodLabel}
                        </Text>
                      )}
                    </>
                  )}
                </View>
              );
            }}
          />
          <View
            style={{
              borderTopWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
            }}
          >
            <View
              style={{
                width: '100%',
                maxWidth: 720,
                alignSelf: 'center',
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ConversationIconButton
                  label={listening ? 'Stop voice input' : 'Start voice input'}
                  iconNode={
                    listening ? (
                      <Square color={colors.ink} size={20} fill={colors.ink} />
                    ) : (
                      <Mic color={colors.ink} size={20} strokeWidth={2.25} />
                    )
                  }
                  onPress={() => {
                    if (listening) ExpoSpeechRecognitionModule.stop();
                    else
                      void ExpoSpeechRecognitionModule.requestPermissionsAsync()
                        .then((permission) => {
                          if (permission.granted)
                            ExpoSpeechRecognitionModule.start({
                              lang: 'en-IN',
                              interimResults: true,
                              continuous: false,
                              addsPunctuation: true,
                            });
                        })
                        .catch(() => undefined);
                  }}
                />
                <Input
                  accessibilityLabel="Message your companion"
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={() => void send()}
                  placeholder="What’s on your mind?"
                  maxLength={4000}
                  returnKeyType="send"
                  containerClassName="flex-1"
                  style={{ minHeight: 46 }}
                />
                <ConversationIconButton
                  label="Send message"
                  iconNode={<Send color={colors.onPrimary} size={20} strokeWidth={2.25} />}
                  primary
                  disabled={controlsDisabled || !draft.trim()}
                  onPress={() => void send()}
                />
              </View>
              <View style={{ alignSelf: 'flex-start', paddingLeft: 44 }}>
                <Button
                  size="sm"
                  variant="ghost"
                  isDisabled={controlsDisabled || hasActiveMoodPrompt}
                  onPress={() => void send('Log my mood')}
                >
                  Log my mood
                </Button>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ConversationBackground>
  );
}

function RichMessageParts({ item }: { item: CachedChatMessage }) {
  const t = useTheme();
  return (
    <>
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
              {String(part.current)} day streak · best {String(part.longest)}
            </Text>
          );
        if (part.type === 'quote_card')
          return (
            <Card key={`quote-${index}`} style={{ marginTop: t.spacing.md }}>
              <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold' }}>
                {String(part.text)}
              </Text>
              <Text style={{ color: t.colors.muted, marginTop: 4 }}>— {String(part.author)}</Text>
            </Card>
          );
        if (part.type === 'activity_card')
          return (
            <Chip
              key={`activity-${index}`}
              label={`${String(part.title)} · +${String(part.xp)} XP`}
              onPress={() =>
                router.push(String(part.kind) === 'breathing' ? '/breathing' : '/grounding')
              }
            />
          );
        if (part.type === 'crisis_card') {
          const helplines = Array.isArray(part.helplines)
            ? (part.helplines as Array<{ name?: string; phone?: string; url?: string }>)
            : [];
          return (
            <Card
              key={`crisis-${index}`}
              style={{
                marginTop: t.spacing.md,
                backgroundColor: '#FFF0EE',
                gap: t.spacing.sm,
              }}
            >
              <Text style={{ color: '#7A2E35', fontFamily: 'Nunito_700Bold' }}>
                You deserve immediate, human support
              </Text>
              <Text style={{ color: '#7A2E35' }}>
                If you may be in danger, contact emergency services or someone you trust now.
              </Text>
              {helplines.map((line) => (
                <Pressable
                  key={`${line.name}-${line.phone ?? line.url}`}
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(line.url ?? `tel:${line.phone}`)}
                >
                  <Text style={{ color: '#7A2E35', textDecorationLine: 'underline' }}>
                    {line.name}: {line.phone ?? line.url}
                  </Text>
                </Pressable>
              ))}
            </Card>
          );
        }
        if (part.type === 'companion')
          return (
            <View key={`companion-${index}`} style={{ marginTop: t.spacing.md }}>
              <CompanionBlob
                size={72}
                state={asCompanionState(part.state)}
                expression={typeof part.expression === 'string' ? part.expression : undefined}
                moodScore={typeof part.moodScore === 'number' ? part.moodScore : undefined}
                frozenAt={1}
              />
            </View>
          );
        if (part.type === 'level_up')
          return (
            <Card key={`level-${index}`} style={{ marginTop: t.spacing.md, gap: t.spacing.sm }}>
              <Text
                style={{
                  color: t.colors.primary,
                  fontFamily: 'Nunito_700Bold',
                  fontSize: t.typography.title,
                }}
              >
                A new level is blooming
              </Text>
              <Text style={{ color: t.colors.ink }}>
                Level {String(part.level)} · {String(part.unlock ?? 'A new companion moment')}
              </Text>
            </Card>
          );
        return null;
      })}
    </>
  );
}
