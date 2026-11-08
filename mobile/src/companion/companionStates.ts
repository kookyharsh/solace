import type { StateId } from './engine/states';

export const companionStates = {
  idle: 'idle',
  thinking: 'thinking',
  caring: 'sleep',
  happy: 'wide',
  wink: 'wink',
  proud: 'exclaim',
} as const satisfies Record<string, StateId>;

export type CompanionState = keyof typeof companionStates;
