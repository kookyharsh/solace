import { describe, expect, it } from 'vitest';
import { dateOnlyKey, mergeStreakProgress, nextStreakCount } from './app.js';

describe('streak calendar dates', () => {
  it('continues a streak across consecutive stored DATE values', () => {
    expect(nextStreakCount('2026-11-08', '2026-11-09', 4)).toBe(5);
    expect(nextStreakCount('2026-11-07', '2026-11-09', 4)).toBe(1);
    expect(nextStreakCount('2026-11-09', '2026-11-09', 4)).toBe(4);
  });

  it('keeps a DATE stable instead of reinterpreting it in a negative timezone', () => {
    // Prisma returns a PostgreSQL DATE at midnight UTC. Localizing it to New York
    // would incorrectly turn 2026-11-09 into 2026-11-08.
    expect(dateOnlyKey(new Date('2026-11-09T00:00:00.000Z'))).toBe('2026-11-09');
  });
});

describe('guest streak merge', () => {
  it('retains guest XP and the most recently active streak', () => {
    const merged = mergeStreakProgress(
      {
        xp: 40,
        currentStreak: 3,
        longestStreak: 3,
        lastActiveDate: new Date('2026-11-08T00:00:00.000Z'),
        freezesUsedThisWeek: 0,
      },
      {
        xp: 25,
        currentStreak: 4,
        longestStreak: 4,
        lastActiveDate: new Date('2026-11-09T00:00:00.000Z'),
        freezesUsedThisWeek: 1,
      },
    );
    expect(merged).toMatchObject({
      xp: 65,
      currentStreak: 4,
      longestStreak: 4,
      freezesUsedThisWeek: 1,
    });
    expect(dateOnlyKey(merged!.lastActiveDate!)).toBe('2026-11-09');
  });
});
