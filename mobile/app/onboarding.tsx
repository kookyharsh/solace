import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Button } from 'heroui-native/button';
import { Input } from 'heroui-native/input';
import { Switch } from 'heroui-native/switch';
import { CompanionBlob } from '../src/companion/CompanionBlob';
import { reactionForMood, type CompanionState } from '../src/companion/companionStates';
import {
  ConversationBackground,
  ConversationBubble,
  ConversationIconButton,
  ThinkingBubble,
  useConversationReduceMotion,
} from '../src/components/conversation';
import { MoodChoices, moodLabel, type MoodScore } from '../src/components/MoodChoices';
import { ProgressBar } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { googleSignInConfigured, useGoogleSignIn } from '../src/googleAuth';
import { saveOnboardingSetup, syncOnboardingSetup } from '../src/api';
import { requestNotifications } from '../src/notifications';

const goals = ['Stress', 'Sleep', 'Focus', 'Loneliness', 'Building habits'];
const habits = {
  water: 'Drink water',
  stretch: 'Stretch',
  walk: 'Short walk',
  screen_break: 'Screen break',
  wind_down: 'Wind down',
  gratitude: 'Gratitude',
};

const questions = [
  {
    key: 'companionName',
    prompt: 'What should I go by? You can pick a name or give me one of your own.',
  },
  { key: 'nickname', prompt: 'And what can I call you?' },
  { key: 'mood', prompt: 'Before we get into anything else, how are you feeling right now?' },
  { key: 'goals', prompt: 'What would you like a little support with? Pick anything that fits.' },
  { key: 'habits', prompt: 'Are there any small habits you’d like us to make room for?' },
  { key: 'wakeTime', prompt: 'Around what time do you usually wake up?' },
  { key: 'sleepTime', prompt: 'And when do you usually turn in?' },
  {
    key: 'memoryConsent',
    prompt:
      'May I remember details you share to make our chats more personal? You can review or delete memories in Settings.',
  },
  {
    key: 'notificationConsent',
    prompt:
      'Would you like occasional reminders and check-ins? You can decide now or change it in Settings.',
  },
] as const;

type Question = (typeof questions)[number]['key'];
type Answers = {
  companionName: string;
  nickname: string;
  mood?: MoodScore;
  goals: string[];
  habits: string[];
  wakeTime: string;
  sleepTime: string;
  memoryConsent: boolean;
  notificationConsent: boolean;
};

const defaults: Answers = {
  companionName: '',
  nickname: '',
  goals: [],
  habits: [],
  wakeTime: '08:00',
  sleepTime: '22:00',
  memoryConsent: false,
  notificationConsent: false,
};

type Turn = { reply: string; acknowledgement: string };
type Phase = 'greeting' | 'question' | 'thinking' | 'acknowledgement';

function GoogleOption({
  onSuccess,
  onFailure,
  onMergeStart,
  disabled,
}: {
  onSuccess: () => void;
  onFailure: () => void;
  onMergeStart: () => boolean;
  disabled: boolean;
}) {
  const google = useGoogleSignIn(onMergeStart, onSuccess, onFailure);
  return (
    <Button
      variant="outline"
      isDisabled={disabled || !google.ready}
      onPress={() => void google.signIn().catch(onFailure)}
    >
      Continue with Google
    </Button>
  );
}

export default function Onboarding() {
  const { colors } = useTheme();
  const reduceMotion = useConversationReduceMotion();
  const animate = reduceMotion === false;
  const [answers, setAnswers] = useState(defaults);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>('greeting');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const transcript = useRef<ComponentRef<typeof ScrollView>>(null);
  const submitting = useRef(false);
  const mergingGoogle = useRef(false);
  const answeredStep = useRef<number | undefined>(undefined);
  const question: Question | undefined = questions[turns.length]?.key;
  const previousQuestion = questions[turns.length - 1]?.key;
  let avatarState: CompanionState = question ? 'listening' : 'proud';
  if (phase === 'greeting') avatarState = 'happy';
  else if (phase === 'thinking' || busy) avatarState = 'thinking';
  else if (previousQuestion === 'mood') avatarState = reactionForMood(answers.mood);
  else if (phase === 'acknowledgement') {
    avatarState =
      previousQuestion === 'companionName' || previousQuestion === 'nickname' ? 'happy' : 'speaking';
  }

  useEffect(() => {
    if (phase === 'question') return;
    if (reduceMotion === undefined) return;
    const next = phase === 'thinking' ? 'acknowledgement' : 'question';
    const timeout = setTimeout(() => setPhase(next), reduceMotion ? 0 : 330);
    return () => clearTimeout(timeout);
  }, [phase, reduceMotion]);

  const answer = <K extends Question>(
    key: K,
    value: Answers[K],
    reply: string,
    acknowledgement: string,
  ) => {
    if (answeredStep.current === turns.length || phase !== 'question' || question !== key) return;
    answeredStep.current = turns.length;
    Keyboard.dismiss();
    setError('');
    setAnswers((current) => ({ ...current, [key]: value }));
    setTurns((current) => [...current, { reply, acknowledgement }]);
    setPhase('thinking');
  };

  const save = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    const { habits: selectedHabits, mood, ...profile } = answers;
    const companionName = profile.companionName || null;
    try {
      await saveOnboardingSetup(
        {
          ...profile,
          companionName,
          nickname: profile.nickname || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          mood: mood ?? 3,
        },
        Object.fromEntries(Object.keys(habits).map((key) => [key, selectedHabits.includes(key)])),
      );
      setRevealed(true);
    } catch {
      setError(
        'I couldn’t save your setup. Your answers are still here. Try again when you’re ready.',
      );
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  };

  const complete = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await AsyncStorage.setItem('solace.onboarding', 'done');
      router.replace('/(tabs)/chat');
      syncOnboardingSetup();
    } catch {
      setError('I couldn’t open our chat yet. Please try again.');
      submitting.current = false;
      setBusy(false);
    }
  }, []);
  const beginGoogleMerge = useCallback(() => {
    if (submitting.current) return false;
    mergingGoogle.current = true;
    submitting.current = true;
    setGoogleBusy(true);
    setError('');
    return true;
  }, []);
  const completeWithGoogle = useCallback(() => {
    mergingGoogle.current = false;
    submitting.current = false;
    setGoogleBusy(false);
    void complete();
  }, [complete]);
  const googleFailed = useCallback(() => {
    if (mergingGoogle.current) {
      mergingGoogle.current = false;
      submitting.current = false;
    }
    setGoogleBusy(false);
    setError('Google sign-in didn’t finish. You can try again or continue as guest.');
  }, []);

  const submitName = (key: 'companionName' | 'nickname', name: string) => {
    const trimmed = name.trim();
    if (key === 'companionName') {
      answer(
        key,
        trimmed,
        trimmed || 'Solace is fine',
        trimmed ? 'I like that. ' + trimmed + ' it is.' : 'Solace it is, then.',
      );
    } else if (trimmed) {
      answer(key, trimmed, trimmed, 'Good to meet you, ' + trimmed + '.');
    }
  };

  const submitTime = (key: 'wakeTime' | 'sleepTime', time: string) => {
    const trimmed = time.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
      setError('Use a 24-hour time such as ' + defaults[key] + '.');
      return;
    }
    answer(
      key,
      trimmed,
      trimmed,
      key === 'wakeTime'
        ? 'Got it. That gives me a feel for your mornings.'
        : 'Thanks. That helps me understand your routine.',
    );
  };

  const renderChoices = () => {
    switch (question) {
      case 'companionName':
      case 'nickname':
        return (
          <>
            {question === 'companionName' && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {['Mochi', 'Luna', 'Pip'].map((name) => (
                  <Button
                    key={name}
                    size="sm"
                    variant="outline"
                    onPress={() => submitName(question, name)}
                  >
                    {name}
                  </Button>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Input
                accessibilityLabel={
                  question === 'companionName' ? 'Companion name' : 'Your nickname'
                }
                placeholder={
                  question === 'companionName' ? 'Type a name for me…' : 'Your name or nickname…'
                }
                value={answers[question]}
                onChangeText={(value) =>
                  setAnswers((current) => ({ ...current, [question]: value }))
                }
                maxLength={question === 'companionName' ? 20 : 80}
                onSubmitEditing={() => submitName(question, answers[question])}
                returnKeyType="send"
                containerClassName="flex-1"
                style={{ minHeight: 48 }}
              />
              <ConversationIconButton
                label="Send answer"
                icon="send"
                primary
                disabled={!answers[question].trim()}
                onPress={() => submitName(question, answers[question])}
              />
            </View>
            {question === 'companionName' && (
              <Button size="sm" variant="ghost" onPress={() => submitName(question, '')}>
                Keep Solace
              </Button>
            )}
          </>
        );
      case 'mood':
        return (
          <MoodChoices
            onChoose={(score) =>
              answer(
                'mood',
                score,
                moodLabel(score),
                'Thanks for telling me. We can take this at your pace.',
              )
            }
          />
        );
      case 'goals':
      case 'habits': {
        const options =
          question === 'goals' ? goals.map((goal) => [goal, goal]) : Object.entries(habits);
        const selected = answers[question];
        const label = (key: string) => options.find(([value]) => value === key)?.[1] ?? key;
        return (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {options.map(([key, title]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={selected.includes(key) ? 'primary' : 'outline'}
                  accessibilityState={{ selected: selected.includes(key) }}
                  onPress={() =>
                    setAnswers((current) => ({
                      ...current,
                      [question]: current[question].includes(key)
                        ? current[question].filter((item) => item !== key)
                        : [...current[question], key],
                    }))
                  }
                >
                  {title}
                </Button>
              ))}
            </View>
            <Button
              onPress={() =>
                answer(
                  question,
                  selected,
                  selected.length ? selected.map(label).join(', ') : 'Nothing for now',
                  selected.length
                    ? 'We can start there and see what feels right.'
                    : 'Sure. We can come back to this anytime.',
                )
              }
            >
              Continue
            </Button>
          </>
        );
      }
      case 'wakeTime':
      case 'sleepTime':
        return (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Input
                accessibilityLabel={question === 'wakeTime' ? 'Wake time' : 'Sleep time'}
                isInvalid={!!error}
                value={answers[question]}
                onChangeText={(value) => {
                  setError('');
                  setAnswers((current) => ({ ...current, [question]: value }));
                }}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                maxLength={5}
                placeholder={defaults[question]}
                onSubmitEditing={() => submitTime(question, answers[question])}
                returnKeyType="send"
                containerClassName="flex-1"
                style={{ minHeight: 48 }}
              />
              <ConversationIconButton
                label="Send time"
                icon="send"
                primary
                onPress={() => submitTime(question, answers[question])}
              />
            </View>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => submitTime(question, defaults[question])}
            >
              {'Use ' + defaults[question]}
            </Button>
          </>
        );
      case 'memoryConsent':
      case 'notificationConsent': {
        const isMemory = question === 'memoryConsent';
        const label = isMemory ? 'Remember what I share' : 'Reminders and check-ins';
        const allowed = answers[question];
        return (
          <>
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ flex: 1, color: colors.ink, fontFamily: 'Nunito_700Bold' }}>
                {label}
              </Text>
              <Switch
                accessibilityLabel={label}
                isSelected={allowed}
                onSelectedChange={(value) =>
                  setAnswers((current) => ({ ...current, [question]: value }))
                }
              />
            </View>
            <Button
              isDisabled={requestingNotifications}
              onPress={() => {
                if (!allowed) {
                  answer(question, false, 'Leave it off', 'Of course. We’ll leave it off.');
                  return;
                }
                setRequestingNotifications(true);
                void requestNotifications()
                  .then((granted) =>
                    answer(
                      question,
                      granted,
                      'Yes, turn it on',
                      granted
                        ? 'Got it. I’ll keep check-ins gentle. You can change that anytime.'
                        : 'No problem. Your device has reminders turned off for now. You can enable them in Settings anytime.',
                    ),
                  )
                  .catch(() =>
                    answer(
                      question,
                      false,
                      'Leave it off',
                      'No problem. Your device has reminders turned off for now. You can enable them in Settings anytime.',
                    ),
                  )
                  .finally(() => setRequestingNotifications(false));
              }}
            >
              {requestingNotifications ? 'Checking…' : 'Continue'}
            </Button>
          </>
        );
      }
      default:
        return (
          <Button isDisabled={busy} onPress={() => void save()}>
            Meet your companion
          </Button>
        );
    }
  };

  return (
    <ConversationBackground>
      <SafeAreaView style={{ flex: 1 }}>
        {revealed ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          >
            <Animated.View
              entering={animate ? FadeInDown.duration(400) : undefined}
              style={{
                width: '100%',
                maxWidth: 440,
                alignSelf: 'center',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <CompanionBlob size={164} state="proud" moodScore={answers.mood} />
              <Text
                accessibilityRole="header"
                style={{
                  color: colors.ink,
                  fontFamily: 'Nunito_700Bold',
                  fontSize: 32,
                  textAlign: 'center',
                }}
              >
                {'It’s me, ' + (answers.companionName || 'Solace') + '.'}
              </Text>
              <Text
                style={{ color: colors.muted, textAlign: 'center', fontSize: 16, lineHeight: 23 }}
              >
                I’m glad we met. When you’re ready, we can pick up right here.
              </Text>
              <View style={{ alignSelf: 'stretch', gap: 8 }}>
                <Button isDisabled={busy || googleBusy} onPress={() => void complete()}>
                  Continue as guest
                </Button>
                {googleSignInConfigured && (
                  <GoogleOption
                    onSuccess={completeWithGoogle}
                    onFailure={googleFailed}
                    onMergeStart={beginGoogleMerge}
                    disabled={busy || googleBusy}
                  />
                )}
              </View>
              {!!error && (
                <Text accessibilityRole="alert" style={{ color: colors.ink }}>
                  {error}
                </Text>
              )}
              <Text style={{ color: colors.muted, textAlign: 'center' }}>
                Solace is a companion, not a replacement for professional care.
              </Text>
            </Animated.View>
          </ScrollView>
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'web' ? undefined : 'padding'}
          >
            <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <CompanionBlob
                  size={54}
                  state={avatarState}
                  moodScore={answers.mood}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: 'Nunito_700Bold',
                      fontSize: 12,
                      letterSpacing: 1.6,
                    }}
                  >
                    SOLACE / HELLO
                  </Text>
                  <Text
                    accessibilityRole="header"
                    style={{ color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 24 }}
                  >
                    Getting to know you
                  </Text>
                </View>
              </View>
              <ProgressBar value={(turns.length / questions.length) * 100} />
            </View>
            <ScrollView
              ref={transcript}
              style={{ flex: 1 }}
              contentContainerStyle={{
                width: '100%',
                maxWidth: 640,
                alignSelf: 'center',
                padding: 20,
                gap: 9,
              }}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => transcript.current?.scrollToEnd({ animated: animate })}
              onLayout={() => transcript.current?.scrollToEnd({ animated: false })}
            >
              <ConversationBubble text="Hey, I’m glad you’re here. I’m your Solace companion. Can we get to know each other a little?" />
              {turns.map((turn, index) => {
                const isLatest = index === turns.length - 1;
                return (
                  <View key={questions[index].key} style={{ gap: 9 }}>
                    <ConversationBubble text={questions[index].prompt} />
                    <ConversationBubble
                      role="user"
                      text={turn.reply}
                      animate={animate && isLatest}
                    />
                    {(!isLatest || phase !== 'thinking') && (
                      <ConversationBubble
                        text={turn.acknowledgement}
                        animate={animate && isLatest && phase === 'acknowledgement'}
                      />
                    )}
                  </View>
                );
              })}
              {phase === 'question' && (
                <ConversationBubble
                  key={question ?? 'ready'}
                  text={
                    questions[turns.length]?.prompt ??
                    'That’s enough for a first hello. Ready to meet me properly?'
                  }
                  animate={animate}
                />
              )}
              {(phase === 'greeting' || phase === 'thinking' || busy) && (
                <ThinkingBubble reduceMotion={!animate} />
              )}
            </ScrollView>
            {phase === 'question' && (
              <View
                style={{
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                }}
              >
                <View
                  style={{ width: '100%', maxWidth: 640, alignSelf: 'center', padding: 16, gap: 8 }}
                >
                  {!!error && (
                    <Text accessibilityRole="alert" style={{ color: colors.ink }}>
                      {error}
                    </Text>
                  )}
                  {renderChoices()}
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </ConversationBackground>
  );
}
