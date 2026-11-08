# Solace AI

Phase 1 foundation for a chat-first wellness companion. The mobile app currently contains navigation and a component showcase; chat, onboarding, Bloub animation, notifications and other product features start in later phases.

## Architecture

```text
mobile (Expo Router, UI tokens) --> server (Express, auth, Zod) --> PostgreSQL
                                     |
                                     +--> Google ID token verification
packages/contracts ------------------+--> shared request/response schemas
references/ -------------------------+--> Bloub source for Phase 2
```

## Requirements and setup

Node 22.13+ and pnpm 11+, PostgreSQL 16+, and an Android device or emulator with the Android SDK for device checks. Copy `server/.env.example` to `server/.env`, set a real Google OAuth client ID and a random JWT secret, and use a local PostgreSQL database. Copy `mobile/.env.example` to `mobile/.env`, setting the API address reachable from your device (`10.0.2.2` is the Android emulator's host address). Never commit `.env` files.

Run `docker compose up -d` to start the optional local database defined in `compose.yaml`. For Supabase, use the project's PostgreSQL connection string as `DATABASE_URL`; migrations need a direct database connection. Keep credentials only in the server environment.

Run `pnpm install`, `pnpm db:generate`, `pnpm db:migrate`, and `pnpm dev`. Use `pnpm --filter @solace/mobile android` for a local development build, or `eas build --profile development --platform android` after signing in to EAS. The preview profile produces an APK. Run `pnpm check`, `pnpm build`, `pnpm --filter @solace/server test`, and `pnpm --filter @solace/mobile export:android` before reviewing a phase.

## API

`GET /health` checks the process; `GET /ready` checks the database. `POST /auth/google` accepts `{idToken}`, verifies it with Google and returns access and refresh tokens. `POST /auth/refresh` accepts `{refreshToken}` and rotates it. `GET /me` requires a Bearer access token. Errors are `{error:{code,message}}`. The mobile authentication flow and guest merge are scheduled for Phase 3.

## Phase gate

Phase 2 must wait until the foundation passes local checks and an Android development build has been exercised on a device. External credentials and EAS access are needed for live Google and cloud build checks.
