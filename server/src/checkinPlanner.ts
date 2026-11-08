export type CheckinCandidate = {
  source: 'loop' | 'mood' | 'habit';
  topic: string;
  text: string;
};

export function chooseCheckin(input: {
  openLoops: Array<{ text: string }>;
  lowMoodCount: number;
  habits: string[];
  recentTopics?: string[];
}): CheckinCandidate | null {
  const recent = new Set((input.recentTopics ?? []).map((topic) => topic.toLowerCase()));
  const loop = input.openLoops.find((candidate) => !recent.has(candidate.text.toLowerCase()));
  if (loop) return { source: 'loop', topic: loop.text, text: 'How did that go?' };
  if (input.lowMoodCount >= 2)
    return { source: 'mood', topic: 'mood', text: 'How is today feeling, at your own pace?' };
  const habit = input.habits.find((candidate) => !recent.has(candidate.toLowerCase()));
  if (habit) {
    const labels: Record<string, string> = {
      water: 'Have you had some water?',
      stretch: 'Would a small stretch feel kind right now?',
      walk: 'Could a short walk help you reset?',
      gratitude: 'What is one small thing you appreciate today?',
      screen_break: 'Would a screen break feel supportive?',
      wind_down: 'Would a gentle wind-down help tonight?',
    };
    return {
      source: 'habit',
      topic: habit,
      text: labels[habit] ?? 'A small caring habit might help today.',
    };
  }
  return null;
}
