# Solace AI

Solace AI is a chat-first wellness companion foundation with a runnable Expo mobile client, Express API, PostgreSQL persistence, guest sessions, optional Google sign-in, Gemini-backed replies, wellness check-ins, mood history, and lightweight gamification. Advanced offline sync, production push delivery, and the full Bloub animation port remain follow-up work.

## Architecture

```text
mobile (Expo Router, UI tokens) --> server (Express, auth, Zod) --> PostgreSQL
                                     |
                                     +--> Google ID token verification
packages/contracts ------------------+--> shared request/response schemas
references/ -------------------------+--> Bloub source for Phase 2
```

## Requirements and setup

Node 22.13+ and pnpm 11+, PostgreSQL 16+, and an Android device or emulator with the Android SDK for device checks. Copy `server/.env.example` to `server/.env`, set a real Google OAuth client ID and random JWT secret, and optionally set `GEMINI_API_KEY` for live Gemini responses (`GEMINI_MODEL` defaults to `gemini-2.5-flash`). Without a Gemini key, the API uses a deterministic local fallback so development remains runnable. Gemini is called only from the server; the key never ships in the mobile bundle. Copy `mobile/.env.example` to `mobile/.env`, setting the API address reachable from your device (`10.0.2.2` is the Android emulator's host address). Never commit `.env` files.

Run `docker compose up -d` to start the optional local database defined in `compose.yaml`. For Supabase, use the project's PostgreSQL connection string as `DATABASE_URL`; migrations need a direct database connection. Keep credentials only in the server environment.

Run `pnpm install`, `pnpm db:generate`, `pnpm db:migrate`, and `pnpm dev`. Use `pnpm --filter @solace/mobile android` for a local development build, or `eas build --profile development --platform android` after signing in to EAS. The preview profile produces an APK. Run `pnpm check`, `pnpm build`, `pnpm --filter @solace/server test`, and `pnpm --filter @solace/mobile export:android` before reviewing a phase.

## API

`GET /health` checks the process; `GET /ready` checks the database. `POST /auth/google` accepts `{idToken}`, verifies it with Google and returns access and refresh tokens. `POST /auth/guest` creates a local guest session. `POST /auth/refresh` accepts `{refreshToken}` and rotates it. `GET /me` requires a Bearer access token. Chat, conversation history, mood logging, gamification, export, and account deletion are available behind the same auth middleware. Errors are `{error:{code,message}}`.

## Phase gate

The next phase should wait until the foundation passes local checks and an Android development build has been exercised on a device. External Google credentials, an optional Gemini key, and EAS access are needed for live provider and cloud build checks. The supplied `references/` directory is intentionally preserved for the Bloub port.
