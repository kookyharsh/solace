import { describe, expect, it } from 'vitest';
import { chooseCheckin } from './checkinPlanner.js';

describe('chooseCheckin', () => {
  it('prioritizes a non-repeated open loop', () => {
    const result = chooseCheckin({
      openLoops: [{ text: 'exam tomorrow' }, { text: 'football match next week' }],
      lowMoodCount: 0,
      habits: ['water'],
      recentTopics: ['exam tomorrow'],
    });
    expect(result?.source).toBe('loop');
    expect(result?.topic).toBe('football match next week');
  });

  it('falls back to an enabled habit when loops are repeated', () => {
    const result = chooseCheckin({
      openLoops: [{ text: 'exam tomorrow' }],
      lowMoodCount: 0,
      habits: ['water', 'stretch'],
      recentTopics: ['exam tomorrow', 'water'],
    });
    expect(result?.source).toBe('habit');
    expect(result?.topic).toBe('stretch');
  });
});
