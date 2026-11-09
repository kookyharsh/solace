import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Button, GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { awardXp, completeDailyChallenge, logMood } from '../src/api';
import { MoodChoices } from '../src/components/MoodChoices';

const INHALE_MS = 4000;
const EXHALE_MS = 6000;
const DURATION_S = 60;

/** Bezier that eases in and out gently — matches a natural breath curve. */
const breathEasing = Easing.bezier(0.37, 0, 0.63, 1);

export default function Breathing() {
  const t = useTheme();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('Ready when you are');
  const [seconds, setSeconds] = useState(DURATION_S);
  const [completed, setCompleted] = useState(false);
  const [afterMood, setAfterMood] = useState<number>();

  // ── Shared values (UI thread) ──────────────────────────────────────────
  // Core orb
  const coreScale = useSharedValue(0.72);
  // Middle halo — slightly larger, lower opacity
  const haloScale = useSharedValue(0.72);
  const haloOpacity = useSharedValue(0.0);
  // Outer ring — even larger, very subtle
  const outerScale = useSharedValue(0.72);
  const outerOpacity = useSharedValue(0.0);

  const coreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coreScale.value }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: haloOpacity.value,
  }));
  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerScale.value }],
    opacity: outerOpacity.value,
  }));

  // ── Animation loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) {
      // Snap back to resting position
      coreScale.value = withTiming(0.72, { duration: 600, easing: breathEasing });
      haloScale.value = withTiming(0.72, { duration: 600, easing: breathEasing });
      outerScale.value = withTiming(0.72, { duration: 600, easing: breathEasing });
      haloOpacity.value = withTiming(0, { duration: 400 });
      outerOpacity.value = withTiming(0, { duration: 400 });
      return;
    }

    // Halo/outer fade in on start
    haloOpacity.value = withTiming(0.28, { duration: 800 });
    outerOpacity.value = withTiming(0.14, { duration: 1000 });

    // Core breathes 1.0 inhale, 0.72 exhale — repeated
    coreScale.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: INHALE_MS, easing: breathEasing }),
        withTiming(0.72, { duration: EXHALE_MS, easing: breathEasing }),
      ),
      -1,
      false,
    );
    // Halo lags slightly (0.92 max scale)
    haloScale.value = withRepeat(
      withSequence(
        withTiming(0.92, { duration: INHALE_MS + 300, easing: breathEasing }),
        withTiming(0.72, { duration: EXHALE_MS - 300, easing: breathEasing }),
      ),
      -1,
      false,
    );
    // Outer ring lags more (0.84 max scale)
    outerScale.value = withRepeat(
      withSequence(
        withTiming(0.84, { duration: INHALE_MS + 700, easing: breathEasing }),
        withTiming(0.72, { duration: EXHALE_MS - 700, easing: breathEasing }),
      ),
      -1,
      false,
    );
  }, [coreScale, haloOpacity, haloScale, outerOpacity, outerScale, running]);

  // ── Countdown ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) return;

    // Phase label — simple 10s cadence
    setPhase('Breathe in…');
    let isInhale = true;
    const cycleMs = INHALE_MS + EXHALE_MS;
    const phaseTimer = setInterval(() => {
      isInhale = !isInhale;
      setPhase(isInhale ? 'Breathe in…' : 'Breathe out…');
    }, isInhale ? INHALE_MS : EXHALE_MS);

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

    return () => {
      clearInterval(countdown);
      clearInterval(phaseTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const SIZE = 220;
  const HALO_SIZE = SIZE * 1.28;
  const OUTER_SIZE = SIZE * 1.6;

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

        {/* Multi-ring orb */}
        <View style={{ width: OUTER_SIZE, height: OUTER_SIZE, alignItems: 'center', justifyContent: 'center' }}>
          {/* Outer ring */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: OUTER_SIZE,
                height: OUTER_SIZE,
                borderRadius: OUTER_SIZE / 2,
                backgroundColor: t.colors.primary,
              },
              outerStyle,
            ]}
          />
          {/* Middle halo */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: HALO_SIZE,
                height: HALO_SIZE,
                borderRadius: HALO_SIZE / 2,
                backgroundColor: t.colors.primary,
              },
              haloStyle,
            ]}
          />
          {/* Core orb */}
          <Animated.View
            style={[
              {
                width: SIZE,
                height: SIZE,
                borderRadius: SIZE / 2,
                backgroundColor: t.colors.primary,
                opacity: 0.9,
              },
              coreStyle,
            ]}
          />
        </View>

        <View style={{ width: '100%', gap: t.spacing.md }}>
          <Button
            label={completed ? 'Breathe again' : running ? 'Pause' : 'Start 1 minute'}
            onPress={() => {
              if (completed) {
                setCompleted(false);
                setSeconds(DURATION_S);
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
