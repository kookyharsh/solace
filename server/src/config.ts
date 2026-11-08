import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:8081'),
  GOOGLE_CLIENT_ID: z.string().min(10),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('solace-api'),
  GEMINI_API_KEY: z.string().min(10),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
});

export type Config = z.infer<typeof schema>;
export function readConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  return schema.parse(environment);
}
