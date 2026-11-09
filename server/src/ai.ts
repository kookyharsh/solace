import type { Config } from './config.js';
import { isMoodCheckInRequest } from '@solace/contracts';

export interface CompanionReply {
  text: string;
  parts: Array<Record<string, unknown>>;
}
const crisisPattern =
  /\b(kill myself|suicide|self[- ]harm|hurt myself|end my life|want to die|no reason to live|not worth living|can't go on|cannot go on|hopeless)\b/i;

export function isCrisis(text: string) {
  return crisisPattern.test(text);
}

function localFallback(): CompanionReply {
  return {
    text: 'I’m here with you. Tell me a little more about what’s on your mind.',
    parts: [{ type: 'quick_replies', options: ['I feel low', 'I feel okay', 'I want to reflect'] }],
  };
}

export async function generateCompanionReply(
  text: string,
  config: Config,
  companionName?: string | null,
  context = '',
): Promise<CompanionReply> {
  if (isCrisis(text))
    return {
      text: 'I’m really glad you told me. You deserve support from a real person right now. Are you in immediate danger?',
      parts: [
        {
          type: 'crisis_card',
          helplines: [
            { country: 'India', name: 'Tele-MANAS', phone: '14416' },
            { country: 'Global', name: 'Find a helpline', url: 'https://findahelpline.com' },
          ],
        },
      ],
    };
  if (isMoodCheckInRequest(text))
    return {
      text: 'Let’s check in. Which of these feels closest right now?',
      parts: [{ type: 'mood_picker' }],
    };
  if (!config.GEMINI_API_KEY) return localFallback();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': config.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are ${companionName?.trim() || 'an unnamed'} warm wellness companion. Keep replies to 1-4 short sentences, ask one question, never diagnose. Do not claim to be human. Use the user's language when possible. When the user shares their mood or feelings, validate them with warmth and share a fascinating, unexpected curiosity or heartwarming wonder from nature, science, or history that matches their mood, then ask a fun or thoughtful open question to hook them into conversation. ${context ? `Known context (only use if relevant): ${context}` : ''} User says: ${text}`,
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 240 },
        }),
      },
    );
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`[Gemini API] Failed with status ${response.status}: ${errorText}`);
      return localFallback();
    }
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const answer =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? '')
        .join('')
        .trim() || 'I’m here with you. What would feel supportive right now?';
    return { text: answer, parts: [] };
  } catch (error) {
    console.warn('[Gemini API] Request exception:', error);
    return localFallback();
  }
}
