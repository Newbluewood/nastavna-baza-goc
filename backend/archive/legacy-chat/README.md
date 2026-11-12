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

`budgetGate.js` and `chatRateLimit.js` stayed in `backend/middleware/` but nothing imports them on the **site** API after the route was removed (**orphan na sajtu**).

**2026-11-13:** Behaviour re-ported on **chat-agent** (live path):
- `middleware/chatRateLimit.js` — ~12/min + relief cooldown ~2 min + warning headers
- `middleware/budgetGate.js` + `services/aiBudget.js` (site mirror: `aiBudgetService.js`) — monthly EUR hard stop before LLM (default 20 € global / 2 € per user → graceful fallback)
- CMS `chat_query_events` writes — `services/chatQueryAnalytics.js` (was `recordSiteGuideQuery` in archived `chatController.siteGuideTurn`)

To run the archived tests from `backend/`:

```bash
npx jest --testMatch "<rootDir>/archive/legacy-chat/**/*.test.js"
```
