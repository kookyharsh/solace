import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Button } from 'heroui-native/button';
import { useTheme } from '../theme';

const moods = [
  {
    score: 1,
    label: 'Very low',
    path: 'M6 14a3 3 0 1 1 .6-5.9 5.5 5.5 0 0 1 10.4 1A2.5 2.5 0 1 1 19 14H6ZM8 17l-1 3m6-3-1 3m6-3-1 3',
  },
  {
    score: 2,
    label: 'Low',
    path: 'M6 16a4 4 0 1 1 1-7.9 5.5 5.5 0 0 1 10.5 1.1A3.5 3.5 0 1 1 19 16H6Z',
  },
  {
    score: 3,
    label: 'Okay',
    path: 'M3 16h18M6 20h12m-11-4a5 5 0 0 1 10 0M12 5v2M5 9l1.5 1.5M19 9l-1.5 1.5',
  },
  {
    score: 4,
    label: 'Good',
    path: 'M6 18a3 3 0 1 1 .8-5.9 5 5 0 0 1 9.6.9A2.5 2.5 0 1 1 19 18H6Zm7-9a3.5 3.5 0 1 1 5 4m-2-11v2m6 4h-2m-8-4 1 1',
  },
  {
    score: 5,
    label: 'Great',
    path: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2m10-10 2-2',
  },
] as const;

export type MoodScore = (typeof moods)[number]['score'];

export function moodLabel(score: number) {
  return moods.find((mood) => mood.score === score)?.label ?? 'Check-in';
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
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {moods.map(({ score, label, path }) => (
        <Button
          key={score}
          size="sm"
          variant={value === score ? 'primary' : 'outline'}
          isDisabled={disabled}
          accessibilityState={{ selected: value === score }}
          onPress={() => onChoose(score)}
          style={{
            flexGrow: 1,
            minWidth: 46,
            minHeight: 52,
            flexDirection: 'column',
            gap: 2,
            paddingHorizontal: 6,
          }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d={path}
              fill="none"
              stroke={colors.ink}
              strokeWidth={1.65}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Button.Label style={{ fontSize: 12, fontFamily: 'Nunito_700Bold' }}>
            {label}
          </Button.Label>
        </Button>
      ))}
    </View>
  );
}
