import { Text } from 'react-native';
import { router } from 'expo-router';
import { Button, Card } from './ui';
import { useTheme } from '../theme';
import { BreathingExercise, GratitudeExercise, GroundingExercise } from './wellness-exercises';

type Action =
  | 'breathing'
  | 'grounding'
  | 'gratitude'
  | 'mood_checkin'
  | 'history'
  | 'today'
  | 'settings'
  | 'wellness';

const routes = {
  history: '/history',
  today: '/today',
  settings: '/settings',
  wellness: '/(tabs)/wellness',
} as const;

function isAction(value: unknown): value is Action {
  return (
    typeof value === 'string' &&
    [
      'breathing',
      'grounding',
      'gratitude',
      'mood_checkin',
      'history',
      'today',
      'settings',
      'wellness',
    ].includes(value)
  );
}

export function ChatAction({
  action: rawAction,
  title,
  description,
}: {
  action: unknown;
  title: unknown;
  description?: unknown;
}) {
  const t = useTheme();
  if (!isAction(rawAction) || rawAction === 'mood_checkin') return null;
  if (rawAction === 'breathing') return <BreathingExercise />;
  if (rawAction === 'grounding') return <GroundingExercise />;
  if (rawAction === 'gratitude') return <GratitudeExercise />;

  const path = routes[rawAction];
  return (
    <Card style={{ marginTop: t.spacing.md, gap: t.spacing.sm }}>
      <Text style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold' }}>
        {typeof title === 'string' ? title : 'Open Solace'}
      </Text>
      {typeof description === 'string' && (
        <Text style={{ color: t.colors.muted }}>{description}</Text>
      )}
      <Button label="Open" variant="outline" onPress={() => router.push(path)} />
    </Card>
  );
}

export function isMoodCheckInAction(action: unknown) {
  return action === 'mood_checkin';
}
