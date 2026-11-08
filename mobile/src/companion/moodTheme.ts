export const moodTheme: Record<number, string> = {
  1: '#8A8FB8',
  2: '#9DB4E0',
  3: '#BFD8C8',
  4: '#FFD98A',
  5: '#FFB59E',
};

export function colorForMood(score?: number) {
  return moodTheme[Math.max(1, Math.min(5, score ?? 3))] ?? '#8B7CF6';
}
