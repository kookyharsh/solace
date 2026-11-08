import { useEffect, useMemo, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';

export default function Breathing() {
  const t = useTheme();
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('Ready when you are');
  const scale = useMemo(() => new Animated.Value(0.72), []);
  useEffect(() => {
    if (!running) return;
    let active = true;
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
            {phase}
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
            label={running ? 'Pause' : 'Start 1 minute'}
            onPress={() => setRunning((value) => !value)}
          />
          {!running && <Button label="Return to chat" onPress={() => router.back()} />}
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
