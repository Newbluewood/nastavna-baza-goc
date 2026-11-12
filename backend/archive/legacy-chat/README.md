# Legacy chat (archived 2026-11-09)

Production widget talk goes to **chat-agent** (`POST /api/chat/stream` on that service).

These files are not mounted and are not part of `npm test`:

| File | Was |
|------|-----|
| `siteGuideService.js` | `POST /api/chat/site-guide-turn` |
| `chatStayService.js` | `POST /api/chat/plan-stay`, `POST /api/chat/suggest-visit` |
| `geminiChatService.js` | `POST /api/chat/fallback` |
| `*.test.js` | Jest coverage for the site-guide path |

Still live on the site API:

- `POST /api/chat/reserve-stay` — creates the inquiry (the form's hands)
- `GET` / `POST /api/chat/history` — history for a logged-in guest

`budgetGate.js` and `chatRateLimit.js` stayed in `backend/middleware/` but nothing imports them after the route was removed.

**2026-11-13:** Behaviour re-ported on **chat-agent** (live path):
- `middleware/chatRateLimit.js` — ~12/min + relief cooldown + warning headers
- `middleware/budgetGate.js` + `services/aiBudget.js` — monthly EUR hard stop before LLM

To run the archived tests from `backend/`:

```bash
npx jest --testMatch "<rootDir>/archive/legacy-chat/**/*.test.js"
```
