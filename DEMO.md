# Solace AI demo (3 minutes)

1. Start PostgreSQL, run `pnpm db:migrate`, then start the API and Expo development build.
2. On first launch, name the companion (or leave it unnamed), choose a mood, and enter as a guest. The consent switches explain memory and notifications.
3. In Chat, ask “show my mood this week”, “what’s my XP?”, or “help me breathe”. The server returns structured chart, XP, streak, quote, and activity parts; the mobile client renders them in the conversation.
4. Open Wellness to log a mood, view the weekly chart, complete breathing, grounding, and gratitude exercises, and see XP and achievements.
5. Open Chat history, continue a saved conversation, or open Today for the journal timeline.
6. In Settings, rename the companion, schedule a gentle reminder, review/delete memories, and export data.
7. For the notification demo, grant notification permission, schedule a reminder, then use the Reply action. The reply is persisted as a notification-source chat message and earns XP.
8. For safety, send “I want to die” and verify the crisis card with Tele-MANAS 14416 and a global helpline link.

Live Gemini responses require `GEMINI_API_KEY` in `server/.env`; without it, the deterministic fallback keeps the demo runnable. Google OAuth and EAS builds require external credentials.
