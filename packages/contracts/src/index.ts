import { z } from 'zod';

export const googleAuthRequest = z.object({ idToken: z.string().min(20).max(8192) });
export const refreshRequest = z.object({ refreshToken: z.string().min(32).max(4096) });
export const userResponse = z.object({
  id: z.string().uuid(),
  email: z.email(),
  name: z.string().nullable(),
  nickname: z.string().nullable(),
  companionName: z.string().nullable(),
  timezone: z.string(),
});
export const authResponse = z.object({
  user: userResponse,
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
});
export const conversationCreateRequest = z.object({ title: z.string().trim().max(120).optional() });
export const chatRequest = z.object({
  conversationId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(4000),
});
export const moodRequest = z.object({
  score: z.number().int().min(1).max(5),
  note: z.string().trim().max(1000).optional(),
});
export const xpEventRequest = z.object({
  type: z.string().trim().min(1).max(80),
  amount: z.number().int().min(0).max(1000),
  eventKey: z.string().trim().min(1).max(160),
});
export const errorResponse = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type UserResponse = z.infer<typeof userResponse>;
