import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { SlideInRight, SlideOutLeft, ZoomIn } from 'react-native-reanimated';
import { GradientBackground } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { awardXp } from '../src/api';

const steps = [
  ['5 things you can see', 'Name five colours, shapes, or details around you.'],
  ['4 things you can feel', 'Notice the chair, floor, clothing, or air on your skin.'],
  ['3 things you can hear', 'Let nearby and distant sounds arrive without judging them.'],
  ['2 things you can smell', 'Notice a scent, or imagine a comforting one.'],
  ['1 thing you can taste', 'Take a sip of water or notice the taste in your mouth.'],
];

export default function Grounding() {
  const t = useTheme();
  const [step, setStep] = useState(0);
  const done = step >= steps.length;

  return (
    <GradientBackground>
      <SafeAreaView
        style={{ flex: 1, padding: t.spacing.lg, justifyContent: 'center', gap: t.spacing.lg }}
      >
        <Text style={{ color: t.colors.muted, fontSize: t.typography.body }}>Grounding</Text>
        <Text
          style={{
            color: t.colors.ink,
            fontSize: t.typography.display,
            fontFamily: 'Nunito_700Bold',
          }}
        >
          Come back to right now.
        </Text>

        {/* Card slides out left and new one slides in from right on each step */}
        <Animated.View
          key={step}
          entering={SlideInRight.springify().damping(18).stiffness(160)}
          exiting={SlideOutLeft.duration(220)}
          style={{
            backgroundColor: t.colors.surface,
            borderRadius: t.radii.lg,
            padding: t.spacing.lg,
            borderWidth: 1,
            borderColor: t.colors.border,
            gap: t.spacing.md,
            ...t.shadows.card,
          }}
        >
          <Text
            style={{
              color: t.colors.primary,
              fontFamily: 'Nunito_700Bold',
              fontSize: t.typography.title,
            }}
          >
            {done ? 'You made space for yourself.' : steps[step][0]}
          </Text>
          <Text style={{ color: t.colors.ink, fontSize: t.typography.body }}>
            {done ? 'A gentle pause still counts.' : steps[step][1]}
          </Text>

          {/* CTA button with spring scale entrance */}
          <Animated.View entering={ZoomIn.springify().delay(120)}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (done) router.back();
                else {
                  const next = step + 1;
                  setStep(next);
                  if (next === steps.length)
                    void awardXp('grounding', 15, `grounding-${new Date().toISOString()}`).catch(
                      () => undefined,
                    );
                }
              }}
              style={{
                backgroundColor: t.colors.primary,
                borderRadius: t.radii.pill,
                padding: t.spacing.md,
              }}
            >
              <Text
                style={{
                  color: t.colors.onPrimary,
                  textAlign: 'center',
                  fontFamily: 'Nunito_700Bold',
                }}
              >
                {done ? 'Back to wellness' : step === steps.length - 1 ? 'Finish' : 'Next'}
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </GradientBackground>
  );
}
