import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button, Card, ProgressBar } from './ui';
import { useTheme } from '../theme';
import { awardXp, completeDailyChallenge, logMood, saveJournalEntry } from '../api';
import { MoodChoices } from './MoodChoices';

const breathingDurationSeconds = 60;
const groundingSteps = [
  ['5 things you can see', 'Name five colours, shapes, or details around you.'],
  ['4 things you can feel', 'Notice the chair, floor, clothing, or air on your skin.'],
  ['3 things you can hear', 'Let nearby and distant sounds arrive without judging them.'],
  ['2 things you can smell', 'Notice a scent, or imagine a comforting one.'],
  ['1 thing you can taste', 'Take a sip of water or notice the taste in your mouth.'],
] as const;

function ExerciseShell({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Card style={{ marginTop: t.spacing.md, gap: t.spacing.md }}>{children}</Card>;
}

export function BreathingExercise({ onDone }: { onDone?: () => void }) {
  const t = useTheme();
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(breathingDurationSeconds);
  const [completed, setCompleted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [mood, setMood] = useState<number>();
  const completionKey = useRef(`breathing-${new Date().toISOString()}`);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setSeconds((current) => {
        if (current > 1) return current - 1;
        setRunning(false);
        setCompleted(true);
        onDone?.();
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDone, running]);

  useEffect(() => {
    if (!completed || saved) return;
    let active = true;
    void Promise.all([
      completeDailyChallenge('breath'),
      awardXp('breathing', 15, completionKey.current),
    ])
      .then(() => active && setSaved(true))
      .catch(() => active && setSaveError(true));
    return () => {
      active = false;
    };
  }, [completed, saveAttempt, saved]);

  const restart = () => {
    setRunning(true);
    setSeconds(breathingDurationSeconds);
    setCompleted(false);
    setSaved(false);
    setSaveError(false);
    setSaveAttempt(0);
    completionKey.current = `breathing-${new Date().toISOString()}`;
    setMood(undefined);
  };
  const phase = seconds % 10 < 4 ? 'Breathe in' : 'Breathe out';
  return (
    <ExerciseShell>
      <Text style={{ color: t.colors.primary, fontFamily: 'Nunito_700Bold' }}>
        One-minute breathing
      </Text>
      <View
        accessibilityLabel={completed ? 'Breathing complete' : phase}
        style={{ alignItems: 'center', justifyContent: 'center', height: 112 }}
      >
        <View
          style={{
            width: running ? 96 : 78,
            height: running ? 96 : 78,
            borderRadius: 999,
            backgroundColor: t.colors.primary,
            opacity: 0.8,
          }}
        />
      </View>
      <Text style={{ color: t.colors.ink, textAlign: 'center', fontFamily: 'Nunito_700Bold' }}>
        {completed ? 'You made space to breathe.' : `${phase} · ${seconds}s`}
      </Text>
      <ProgressBar
        value={((breathingDurationSeconds - seconds) / breathingDurationSeconds) * 100}
      />
      <Button
        label={completed ? 'Breathe again' : running ? 'Pause' : 'Start 1 minute'}
        onPress={() => {
          if (completed) restart();
          else setRunning((value) => !value);
        }}
      />
      {saveError && (
        <Button
          label="Save completion again"
          variant="outline"
          onPress={() => {
            setSaveError(false);
            setSaveAttempt((attempt) => attempt + 1);
          }}
        />
      )}
      {completed && (
        <>
          <Text style={{ color: t.colors.muted, textAlign: 'center' }}>
            {saved
              ? 'Completed · +15 XP'
              : saveError
                ? 'Completion was not saved yet.'
                : 'Saving completion…'}
          </Text>
          <Text style={{ color: t.colors.muted, textAlign: 'center' }}>How do you feel now?</Text>
          <MoodChoices
            value={mood}
            onChoose={(score) => {
              setMood(score);
              void logMood(score).catch(() => undefined);
            }}
          />
        </>
      )}
    </ExerciseShell>
  );
}

export function GroundingExercise({ onDone }: { onDone?: () => void }) {
  const t = useTheme();
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const completionKey = useRef(`grounding-${new Date().toISOString()}`);
  const done = step >= groundingSteps.length;
  const saveCompletion = () => {
    setSaveError(false);
    void awardXp('grounding', 15, completionKey.current)
      .then(() => setSaved(true))
      .catch(() => setSaveError(true));
  };
  return (
    <ExerciseShell>
      <Text style={{ color: t.colors.primary, fontFamily: 'Nunito_700Bold' }}>
        5-4-3-2-1 grounding
      </Text>
      <Text
        style={{ color: t.colors.ink, fontFamily: 'Nunito_700Bold', fontSize: t.typography.title }}
      >
        {done ? 'You made space for yourself.' : groundingSteps[step][0]}
      </Text>
      <Text style={{ color: t.colors.muted }}>
        {done ? 'A gentle pause still counts.' : groundingSteps[step][1]}
      </Text>
      <ProgressBar value={(Math.min(step, groundingSteps.length) / groundingSteps.length) * 100} />
      <Button
        label={done ? 'Start again' : step === groundingSteps.length - 1 ? 'Finish' : 'Next'}
        onPress={() => {
          if (done) {
            setStep(0);
            setSaved(false);
            setSaveError(false);
            completionKey.current = `grounding-${new Date().toISOString()}`;
            return;
          }
          const next = step + 1;
          setStep(next);
          if (next === groundingSteps.length) {
            onDone?.();
            saveCompletion();
          }
        }}
      />
      {done && (
        <Text style={{ color: t.colors.muted, textAlign: 'center' }}>
          {saved
            ? 'Completed · +15 XP'
            : saveError
              ? 'Completion was not saved yet.'
              : 'Saving completion…'}
        </Text>
      )}
      {saveError && (
        <Button label="Save completion again" variant="outline" onPress={saveCompletion} />
      )}
    </ExerciseShell>
  );
}

export function GratitudeExercise({ onDone }: { onDone?: () => void }) {
  const t = useTheme();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);
  const save = async () => {
    if (!note.trim() || saving || saved) return;
    setSaving(true);
    setError(false);
    try {
      await Promise.all([
        completeDailyChallenge('gratitude'),
        saveJournalEntry(`Today I’m grateful for: ${note.trim()}`),
        awardXp('gratitude', 15, `gratitude-${new Date().toISOString().slice(0, 10)}`),
      ]);
      setSaved(true);
      onDone?.();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <ExerciseShell>
      <Text style={{ color: t.colors.primary, fontFamily: 'Nunito_700Bold' }}>One good thing</Text>
      <Text style={{ color: t.colors.muted }}>
        It can be tiny: a warm drink, a message, or a quiet minute.
      </Text>
      <TextInput
        accessibilityLabel="Gratitude note"
        editable={!saved && !saving}
        multiline
        value={note}
        onChangeText={setNote}
        placeholder="Today I appreciated…"
        placeholderTextColor={t.colors.muted}
        style={{
          minHeight: 88,
          padding: t.spacing.sm,
          borderRadius: t.radii.md,
          borderWidth: 1,
          borderColor: t.colors.border,
          color: t.colors.ink,
          textAlignVertical: 'top',
        }}
      />
      <Button
        label={saved ? 'Saved · +15 XP' : saving ? 'Saving…' : 'Save gratitude'}
        disabled={!note.trim() || saving || saved}
        onPress={() => void save()}
      />
      {error && (
        <Text accessibilityRole="alert" style={{ color: t.colors.primary }}>
          I couldn’t save that yet. Your note is still here—try again.
        </Text>
      )}
    </ExerciseShell>
  );
}
