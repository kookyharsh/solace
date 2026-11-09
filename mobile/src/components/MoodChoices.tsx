import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme';
import { haptics } from '../haptics';
import { SmoothMoodFace } from './SmoothMoodFace';

export const moods = [
  { score: 1, label: 'Very low', emoji: '😞' },
  { score: 2, label: 'Low', emoji: '😕' },
  { score: 3, label: 'Okay', emoji: '😐' },
  { score: 4, label: 'Good', emoji: '🙂' },
  { score: 5, label: 'Great', emoji: '😄' },
] as const;

export type MoodScore = (typeof moods)[number]['score'];

export function moodLabel(score: number): string {
  const rounded = Math.max(1, Math.min(5, Math.round(score)));
  return moods.find((m) => m.score === rounded)?.label ?? 'Okay';
}

function clampScore(value: number): MoodScore {
  return Math.max(1, Math.min(5, Math.round(value))) as MoodScore;
}

export function MoodChoices({
  value,
  disabled,
  onChoose,
}: {
  value?: number;
  disabled?: boolean;
  onChoose: (score: MoodScore) => void;
}) {
  const { colors } = useTheme();
  // Continuous score from 1.0 to 5.0
  const [continuousScore, setContinuousScore] = useState<number>(value ?? 3.0);
  const trackWidthRef = useRef<number>(280);
  const lastIntScore = useRef<number>(Math.round(value ?? 3.0));

  useEffect(() => {
    if (value !== undefined) {
      setContinuousScore(value);
      lastIntScore.current = Math.round(value);
    }
  }, [value]);

  const updateFromPosition = (x: number) => {
    if (disabled) return;
    const width = trackWidthRef.current || 280;
    const clampedX = Math.max(0, Math.min(width, x));
    const nextScore = 1 + (clampedX / width) * 4;
    setContinuousScore(nextScore);

    const intScore = Math.round(nextScore);
    if (intScore !== lastIntScore.current) {
      lastIntScore.current = intScore;
      void haptics.selection();
    }
  };

  const commitScore = (finalScore: number) => {
    if (disabled) return;
    void haptics.tap();
    const rounded = clampScore(finalScore);
    setContinuousScore(rounded);
    onChoose(rounded);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (evt) => {
          updateFromPosition(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt) => {
          updateFromPosition(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          commitScore(lastIntScore.current);
        },
        onPanResponderTerminate: () => {
          commitScore(lastIntScore.current);
        },
      }),
    [disabled],
  );

  const roundedScore = clampScore(continuousScore);
  const currentLabel = moodLabel(continuousScore);
  // Normalized 0 to 1 for slider position
  const progressPercent = Math.max(0, Math.min(1, (continuousScore - 1) / 4));

  return (
    <View
      style={{
        width: '100%',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        gap: 14,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {/* Dynamic Hand-Drawn Morphing Face (matches sketch) */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <SmoothMoodFace score={continuousScore} size={88} color={colors.ink} />
      </View>

      {/* Live Label & Rating */}
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 20 }}>
          {currentLabel}
        </Text>
        <Text style={{ color: colors.muted, fontFamily: 'Inter_400Regular', fontSize: 13 }}>
          Slide smoothly to tune how you feel
        </Text>
      </View>

      {/* Smooth Continuous Slider Track (no discrete stops) */}
      <View
        style={{ width: '100%', maxWidth: 360, paddingHorizontal: 16, paddingVertical: 12 }}
        onLayout={(e: LayoutChangeEvent) => {
          const w = e.nativeEvent.layout.width - 32; // deduct horizontal padding
          if (w > 0) trackWidthRef.current = w;
        }}
        {...panResponder.panHandlers}
      >
        <View
          style={{
            height: 12,
            backgroundColor: colors.divider,
            borderRadius: 6,
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Active colored track fill */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              width: `${progressPercent * 100}%`,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.accent,
            }}
          />

          {/* Smooth draggable circular thumb */}
          <View
            style={[
              styles.thumb,
              {
                left: `${progressPercent * 100}%`,
                backgroundColor: colors.bg,
                borderColor: colors.accent,
              },
            ]}
          />
        </View>

        {/* Min / Max Labels under track */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 10,
            paddingHorizontal: 2,
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
            Frown
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
            Neutral
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontFamily: 'Inter_400Regular' }}>
            Smile
          </Text>
        </View>
      </View>

      {/* Direct Tap / Confirmation Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Confirm mood: ${currentLabel}`}
        disabled={disabled}
        onPress={() => commitScore(continuousScore)}
        style={({ pressed }) => ({
          backgroundColor: colors.accent,
          paddingHorizontal: 24,
          paddingVertical: 10,
          borderRadius: 20,
          opacity: pressed ? 0.8 : 1,
          marginTop: 2,
        })}
      >
        <Text style={{ color: colors.onAccent, fontFamily: 'Nunito_700Bold', fontSize: 15 }}>
          Save feeling · {currentLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    marginLeft: -14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
});
