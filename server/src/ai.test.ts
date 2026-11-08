import { describe, expect, it } from 'vitest';
import { generateCompanionReply, isCrisis } from './ai.js';
import type { Config } from './config.js';

const config: Config = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  PORT: 4000,
  CORS_ORIGINS: '*',
  GOOGLE_CLIENT_ID: 'test-client-id',
  JWT_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789',
  JWT_ISSUER: 'solace-test',
  GEMINI_API_KEY: '',
  GEMINI_MODEL: 'gemini-2.5-flash',
  EXPO_PUSH_ACCESS_TOKEN: '',
};

describe('companion safety', () => {
  it('detects direct and indirect crisis language', () => {
    expect(isCrisis('I want to die')).toBe(true);
    expect(isCrisis('I cannot go on')).toBe(true);
    expect(isCrisis('I had a rough day')).toBe(false);
  });
  it('returns a crisis card without calling a provider', async () => {
    const reply = await generateCompanionReply('I might hurt myself', config);
    expect(reply.parts[0]?.type).toBe('crisis_card');
  });
});
