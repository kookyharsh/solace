import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import { useTheme } from '../theme';

const moods = [
  { score: 1, label: 'Very low', emoji: '😞' },
  { score: 2, label: 'Low', emoji: '😕' },
  { score: 3, label: 'Okay', emoji: '😐' },
  { score: 4, label: 'Good', emoji: '🙂' },
  { score: 5, label: 'Great', emoji: '😄' },
] as const;

export type MoodScore = (typeof moods)[number]['score'];

export function moodLabel(score: number) {
  return moods.find((mood) => mood.score === score)?.label ?? 'Check-in';
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
  const { colors, spacing, radii } = useTheme();
  const [trackWidth, setTrackWidth] = useState(1);
  const [preview, setPreview] = useState<MoodScore>(clampScore(value ?? 3));
  const selected = clampScore(value ?? preview);
  const mood = moods.find((item) => item.score === preview) ?? moods[2];

  useEffect(() => {
    if (value !== undefined) setPreview(clampScore(value));
  }, [value]);

  const scoreAt = (x: number) => clampScore(1 + (Math.max(0, Math.min(trackWidth, x)) / trackWidth) * 4);
  const updatePreview = (x: number) => setPreview(scoreAt(x));
  const commit = (x: number) => {
    if (disabled) return;
    const score = scoreAt(x);
    setPreview(score);
    onChoose(score);
  };
  const chooseAdjacent = (delta: number) => {
    if (disabled) return;
    const score = clampScore(selected + delta);
    setPreview(score);
    onChoose(score);
  };
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (event) => updatePreview(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updatePreview(event.nativeEvent.locationX),
        onPanResponderRelease: (event) => commit(event.nativeEvent.locationX),
        onPanResponderTerminate: (event) => commit(event.nativeEvent.locationX),
      }),
    [disabled, trackWidth],
  );
  const percent = ((preview - 1) / 4) * 100;

  return (
    <View style={{ gap: spacing.sm, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text accessibilityLabel={mood.label} style={{ fontSize: 34, lineHeight: 42 }}>
          {mood.emoji}
        </Text>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ color: colors.ink, fontFamily: 'Nunito_700Bold' }}>{mood.label}</Text>
            <Text style={{ color: colors.muted, fontVariant: ['tabular-nums'] }}>{preview} / 5</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Slide to describe how today feels</Text>
        </View>
      </View>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Mood today"
        accessibilityHint="Swipe or tap to choose a mood from very low to great"
        accessibilityValue={{ min: 1, max: 5, now: preview, text: mood.label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') chooseAdjacent(1);
          if (event.nativeEvent.actionName === 'decrement') chooseAdjacent(-1);
        }}
        onLayout={(event) => setTrackWidth(Math.max(1, event.nativeEvent.layout.width))}
        {...panResponder.panHandlers}
        style={{ height: 40, justifyContent: 'center' }}
      >
        <View
          style={{
            height: 8,
            borderRadius: radii.pill,
            backgroundColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${percent}%`,
              height: '100%',
              borderRadius: radii.pill,
              backgroundColor: colors.primary,
            }}
          />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${percent}%`,
            marginLeft: -14,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.primary,
            borderWidth: 3,
            borderColor: colors.surface,
          }}
        />
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 3, right: 3, flexDirection: 'row', justifyContent: 'space-between' }}
        >
          {moods.map((entry) => (
            <View
              key={entry.score}
              style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.surface }}
            />
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Very low</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Great</Text>
      </View>
    </View>
  );
}
