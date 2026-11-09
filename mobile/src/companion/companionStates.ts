import type { StateId } from './engine/states';
import type { ExpressionId } from './engine/expressions';

export const companionStates = {
  idle: { pose: 'idle', face: 'neutre', label: 'Solace companion' },
  listening: { pose: 'idle', face: 'attentif', label: 'Solace is listening' },
  thinking: { pose: 'thinking', face: 'curieux', label: 'Solace is thinking' },
  speaking: { pose: 'idle', face: 'curieux', label: 'Solace is replying' },
  caring: { pose: 'idle', face: 'triste', label: 'Solace is showing concern' },
  happy: { pose: 'idle', face: 'heureux', label: 'Solace is smiling' },
  wink: { pose: 'wink', face: 'neutre', label: 'Solace is winking' },
  proud: { pose: 'idle', face: 'fier', label: 'Solace is celebrating' },
} as const satisfies Record<string, { pose: StateId; face: ExpressionId; label: string }>;

export type CompanionState = keyof typeof companionStates;

export function reactionForMood(score?: number): CompanionState {
  if (score === undefined || score === 3) return 'listening';
  if (score < 3) return 'caring';
  return score >= 5 ? 'proud' : 'happy';
}

export function reactionForMessage(text: string): CompanionState {
  const message = text.toLowerCase().replace(/’/g, "'");
  if (
    /\b(?:i feel|i am|i'm) (?:very |really |so )?(?:sad|low|lonely|scared|anxious|overwhelmed|upset|tired|not (?:okay|good|happy))\b/.test(
      message,
    )
  )
    return 'caring';
  if (/\bi (?:finally )?(?:managed to|finished|passed my|got the job|did it)\b/.test(message))
    return 'proud';
  if (/\b(?:i feel|i am|i'm) (?:really |so )?(?:good|great|happy|relieved)\b/.test(message))
    return 'happy';
  return 'speaking';
}

export function asCompanionState(value: unknown): CompanionState | undefined {
  return typeof value === 'string' && Object.hasOwn(companionStates, value)
    ? (value as CompanionState)
    : undefined;
}
