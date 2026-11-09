export const moodTheme: Record<number, string> = {
  1: '#7C785F',
  2: '#8B9A61',
  3: '#ABC270',
  4: '#FEC868',
  5: '#FDA769',
};

export function colorForMood(score?: number) {
  return moodTheme[Math.max(1, Math.min(5, score ?? 3))] ?? moodTheme[3];
}
