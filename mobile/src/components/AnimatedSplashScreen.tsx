/**
 * AnimatedSplashScreen
 *
 * Renders a fully in-JS animated intro that seamlessly replaces the native
 * splash window (locked by expo-splash-screen).  The sequence is:
 *
 *   1. Companion blob springs in from 0.6 → 1.0 scale.
 *   2. A soft radial halo breathes behind the blob (opacity pulse).
 *   3. Title "Solace" glides up with FadeInDown.
 *   4. Tagline glides up with a 200 ms stagger.
 *   5. After `minVisibleMs` the component calls `onReady()` which allows
 *      the caller to navigate and fade this screen out.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { CompanionBlob } from '../companion/CompanionBlob';
import { useTheme } from '../theme';

interface Props {
  /** Called once the intro animation has completed and the app may navigate. */
  onReady: () => void;
  /** Minimum time (ms) the splash is shown before onReady is called. Default 1 600 ms. */
  minVisibleMs?: number;
}

export function AnimatedSplashScreen({ onReady, minVisibleMs = 1600 }: Props) {
  const t = useTheme();

  // ── Companion entrance ──────────────────────────────────────────────────
  const blobScale = useSharedValue(0.55);
  const blobOpacity = useSharedValue(0);

  const blobStyle = useAnimatedStyle(() => ({
    transform: [{ scale: blobScale.value }],
    opacity: blobOpacity.value,
  }));

  // ── Halo breathing glow ─────────────────────────────────────────────────
  const haloScale = useSharedValue(1);
  const haloOpacity = useSharedValue(0);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: haloOpacity.value,
  }));

  useEffect(() => {
    // Blob springs in
    blobScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    blobOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) });

    // Halo fades in then breathes
    haloOpacity.value = withDelay(
      250,
      withTiming(0.35, { duration: 400, easing: Easing.out(Easing.quad) }),
    );
    haloScale.value = withDelay(
      250,
      withRepeat(
        withSequence(
          withTiming(1.18, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );

    // Fire onReady after minimum visible time
    const timer = setTimeout(() => runOnJS(onReady)(), minVisibleMs);
    return () => clearTimeout(timer);
  }, [blobOpacity, blobScale, haloOpacity, haloScale, minVisibleMs, onReady]);

  return (
    <LinearGradient
      colors={[t.colors.background, t.colors.secondary + '28']}
      style={StyleSheet.absoluteFill}
    >
      <View style={styles.container}>
        {/* Breathing halo behind blob */}
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: t.colors.primary,
              width: 190,
              height: 190,
              borderRadius: 95,
            },
            haloStyle,
          ]}
        />

        {/* Companion blob */}
        <Animated.View style={[styles.blobWrapper, blobStyle]}>
          <CompanionBlob size={132} state="idle" />
        </Animated.View>

        {/* Staggered text */}
        <Animated.View
          entering={FadeIn.duration(100)}
          style={styles.textWrapper}
        >
          <Animated.Text
            entering={FadeInDown.duration(500).delay(200).easing(Easing.out(Easing.cubic))}
            style={[
              styles.title,
              { color: t.colors.ink, fontFamily: 'Nunito_700Bold', fontSize: t.typography.display },
            ]}
          >
            Solace
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.duration(500).delay(400).easing(Easing.out(Easing.cubic))}
            style={[styles.tagline, { color: t.colors.muted, fontSize: t.typography.body }]}
          >
            A gentle place to be heard.
          </Animated.Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

/** Wraps AnimatedSplashScreen in a full-screen animated fade-out exit. */
export function SplashScreenWrapper({
  onReady,
  minVisibleMs,
}: Props) {
  return (
    <Animated.View exiting={FadeOut.duration(320)} style={StyleSheet.absoluteFill}>
      <AnimatedSplashScreen onReady={onReady} minVisibleMs={minVisibleMs} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  halo: {
    position: 'absolute',
  },
  blobWrapper: {
    zIndex: 1,
  },
  textWrapper: {
    alignItems: 'center',
    gap: 10,
    zIndex: 1,
  },
  title: {
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
  },
});
