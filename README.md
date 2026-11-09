# Solace AI

Solace AI is a chat-first wellness companion with a runnable Expo mobile client, Express API, PostgreSQL persistence, guest sessions, Google sign-in infrastructure, Gemini-backed replies, contextual check-ins, mood history, rewards, exercises, notifications, and a ported Bloub companion renderer. The mobile storage boundary is deliberately isolated so WatermelonDB can be introduced without changing the feature APIs.

## Architecture

```text
mobile (Expo Router, UI tokens, offline repository) --> server (Express, auth, Gemini, Zod) --> PostgreSQL
       |                                                     |
       +--> Expo Push + Google AuthSession                  +--> Google ID token verification
packages/contracts ------------------------------------------+--> shared request/response schemas
mobile/src/companion/BLoub.LICENSE --------------------------+--> Bloub MIT attribution
```

## Requirements and setup

Node 22.13+ and pnpm 11+, PostgreSQL 16+, and an Android device or emulator with the Android SDK for device checks. Copy `server/.env.example` to `server/.env`, set Google web and Android OAuth client IDs plus a random JWT secret, and optionally set `GEMINI_API_KEY` for live Gemini responses (`GEMINI_MODEL` defaults to `gemini-2.5-flash`). Register the Android OAuth client for package `ai.solace.app` and the SHA-1 certificate used to sign the APK. Set the server `GOOGLE_CLIENT_ID` to the comma-separated web and Android client IDs. Without a Gemini key, the API uses a deterministic local fallback so development remains runnable. Set `EXPO_PUSH_ACCESS_TOKEN` when enabling server-driven Expo Push delivery. Gemini is called only from the server; the key never ships in the mobile bundle. Copy `mobile/.env.example` to `mobile/.env`, setting the API address reachable from your device (`10.0.2.2` is the Android emulator's host address) and the platform-specific Google client IDs. Never commit `.env` files.

Run `docker compose up -d` to start the optional local database defined in `compose.yaml`. For Supabase, use the project's PostgreSQL connection string as `DATABASE_URL`; migrations need a direct database connection. Keep credentials only in the server environment.

Run `pnpm install`, `pnpm db:generate`, `pnpm db:migrate`, and `pnpm dev`. Seed the quote catalog with `pnpm --filter @solace/server db:seed`. Use `pnpm --filter @solace/mobile android` for a local development build, or `eas build --profile development --platform android` after signing in to EAS. The preview profile produces an APK. Run `pnpm mobile:doctor`, `pnpm check`, `pnpm build`, `pnpm --filter @solace/server test`, and `pnpm --filter @solace/mobile export:android` before reviewing a release.

## Production API

The EAS `preview` profile is configured to call `https://solace-api-hackathon.onrender.com`. Configure the corresponding Render service with the existing production `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, and `JWT_ISSUER` as protected environment variables before distributing the APK.

## API

`GET /health` checks the process; `GET /ready` checks the database. `POST /auth/google` accepts `{idToken}`, verifies it with Google and returns access and refresh tokens. `POST /auth/guest` creates a local guest session. `POST /auth/refresh` accepts `{refreshToken}` and rotates it. `GET /me` requires a Bearer access token. Chat, conversation history, mood logging, gamification, export, and account deletion are available behind the same auth middleware. Errors are `{error:{code,message}}`.

## Verification notes

The repository checks cover workspace typechecking, linting, formatting, backend tests/builds, PostgreSQL migrations/seeding, and an Android JavaScript bundle export. A physical Android development build still requires an Android SDK/device or emulator; EAS, Google OAuth, Expo Push, and live Gemini responses require the corresponding external credentials. The Bloub engine is shipped under `mobile/src/companion` with its MIT attribution.
