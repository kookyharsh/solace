import { useEffect, useMemo, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { awardXp, completeDailyChallenge, logMood } from '../src/api';
import { MoodChoices } from '../src/components/MoodChoices';

export default function Breathing() {
  const t = useTheme();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('Ready when you are');
  const [seconds, setSeconds] = useState(60);
  const [completed, setCompleted] = useState(false);
  const [afterMood, setAfterMood] = useState<number>();
  const scale = useMemo(() => new Animated.Value(0.72), []);
  useEffect(() => {
    if (!running) return;
    let active = true;
    const countdown = setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          setRunning(false);
          setCompleted(true);
          void completeDailyChallenge('breath').catch(() => undefined);
          void awardXp('breathing', 15, `breathing-${new Date().toISOString()}`).catch(
            () => undefined,
          );
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    const loop = () => {
      if (!active) return;
      setPhase('Breathe in…');
      Animated.timing(scale, { toValue: 1, duration: 4000, useNativeDriver: true }).start(() => {
        if (!active) return;
        setPhase('Breathe out…');
        Animated.timing(scale, { toValue: 0.72, duration: 6000, useNativeDriver: true }).start(
          loop,
        );
      });
    };
    loop();
    return () => {
      active = false;
      clearInterval(countdown);
      scale.stopAnimation();
    };
  }, [running, scale]);
  return (
    <GradientBackground>
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: t.spacing.xl,
        }}
      >
        <View style={{ alignItems: 'center', marginTop: t.spacing.xl }}>
          <Text
            style={{
              color: t.colors.ink,
              fontSize: t.typography.display,
              fontFamily: 'Nunito_700Bold',
            }}
          >
            Breathe
          </Text>
          <Text
            style={{ color: t.colors.muted, fontSize: t.typography.body, marginTop: t.spacing.sm }}
          >
            {completed ? 'You made space to breathe.' : `${phase} · ${seconds}s`}
          </Text>
        </View>
        <Animated.View
          style={{
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: t.colors.primary,
            opacity: 0.88,
            transform: [{ scale }],
          }}
        />
        <View style={{ width: '100%', gap: t.spacing.md }}>
          <Button
            label={completed ? 'Breathe again' : running ? 'Pause' : 'Start 1 minute'}
            onPress={() => {
              if (completed) {
                setCompleted(false);
                setSeconds(60);
              }
              setRunning((value) => !value);
            }}
          />
          {completed && (
            <Text style={{ color: t.colors.muted, textAlign: 'center' }}>How do you feel now?</Text>
          )}
          {completed && (
            <MoodChoices
              value={afterMood}
              onChoose={(score) => {
                setAfterMood(score);
                void logMood(score).catch(() => undefined);
              }}
            />
          )}
          {!running && <Button label="Return to chat" onPress={() => router.back()} />}
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
