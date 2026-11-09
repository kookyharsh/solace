import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { haptics } from '../haptics';

export const moods = [
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
  const { colors } = useTheme();
  const [selected, setSelected] = useState<MoodScore>(clampScore(value ?? 3));
  const currentMood = moods.find((item) => item.score === selected) ?? moods[2];

  useEffect(() => {
    if (value !== undefined) setSelected(clampScore(value));
  }, [value]);

  const handleSelect = (score: MoodScore) => {
    if (disabled) return;
    void haptics.tap();
    setSelected(score);
    onChoose(score);
  };

  return (
    <View
      style={{
        width: '100%',
        minWidth: 0,
        gap: 12,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {/* Header with emoji and status */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text accessibilityLabel={currentMood.label} style={{ fontSize: 32, lineHeight: 38 }}>
            {currentMood.emoji}
          </Text>
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 17 }}>
              {currentMood.label}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, fontFamily: 'Inter_400Regular' }}>
              How is today feeling?
            </Text>
          </View>
        </View>

        <View>
          <Text style={{ color: colors.muted, fontFamily: 'Nunito_700Bold', fontSize: 13 }}>
            {selected} / 5
          </Text>
        </View>
      </View>

      {/* 5 Distinct Touch Targets */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6, width: '100%' }}>
        {moods.map((entry) => {
          const isSelected = selected === entry.score;
          return (
            <Pressable
              key={entry.score}
              accessibilityRole="button"
              accessibilityLabel={`${entry.label}, rating ${entry.score} of 5`}
              accessibilityState={{ selected: isSelected }}
              disabled={disabled}
              onPress={() => handleSelect(entry.score)}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 2,
                borderRadius: 12,
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: isSelected ? colors.accent : colors.divider,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 24, lineHeight: 30 }}>{entry.emoji}</Text>
              <Text
                numberOfLines={1}
                style={{
                  color: colors.ink,
                  fontSize: 11,
                  fontFamily: isSelected ? 'Nunito_700Bold' : 'Inter_400Regular',
                  marginTop: 3,
                }}
              >
                {entry.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
