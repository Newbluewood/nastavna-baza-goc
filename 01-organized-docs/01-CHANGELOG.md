# Project Change Log

Document all significant changes here. Use date, author, and a short description.

## Example

---

## Workflow and Major Changes

- 2026-05-03 (Antigravity): **Full SQL Migration & Multilingual Sync**:
    - Successfully migrated all static JSON data (Themes, Attractions, Restaurants, News, FAQ, Prices, Campus) to AWS RDS MySQL.
    - Implemented a robust `base_table + translation_table` architecture for full SR/EN support across all dynamic site content.
    - Created a new premium `/restoran` module with categorized menus and high-quality "Forest Vibe" imagery for Paviljon Pečenjara and Restoran Piramida.
    - Refactored `publicController.js` and `api.js` to serve content exclusively from the database, decoupling the frontend from local file dependency.
    - Standardized dynamic routing for `/edukacija`, `/istrazivanje`, and `/faq` with automatic route watching for seamless navigation.
    - Enabled static file serving for `/images` on the backend to support persistent visual assets.

- 2026-04-23 (user): Created 01-organized-docs folder and started systematic documentation.
- 2026-04-23 (user): Moved all legacy context and implementation docs to 01-organized-docs for unified onboarding and tracking.
- 2026-04-23 (user): Added backend and frontend checklists for chat history and new chat button features.
- 2026-04-23 (user): Persistent chat history implemented (see 07-CHAT_HISTORY_IMPLEMENTATION.md).
- 2026-04-23 (user): Database schema updated with chat_messages table, session_id, and meta fields.
- 2026-04-23 (user): All tests reorganized into tests/jest and tests/standalone; robust skipping if DB missing.
- 2026-04-23 (user): Migration and seeding scripts updated for .env-driven DB selection and safety.
- 2026-04-23 (user): Logging system (requestLogger, qaLogger) integrated and documented.
- 2026-04-23 (user): All info/context docs now systematically organized for all collaborators.

## Git Grane i Arhitektura — 2026-04-23 (Copilot session)

- 2026-04-23: Kreirana grana `development` iz `main` — nova integracijska grana.
- 2026-04-23: Ceo BCKUP sadržaj (nova arhitektura) importovan na `development` — 110 fajlova, 8402 insertions.
- 2026-04-23: Grana `asistant-features` rebasovana iznad `development` (čista istorija).
- 2026-04-23: Stari `dev` obrisan lokalno i na remote-u.
- 2026-04-23: Nova arhitektura uključuje: `server.js`/`app.js` split, `chatService.js`, `embeddingService.js`, `vectorSearchService.js`, `logger.js` (Winston), reorganizovani testovi (`tests/jest/`, `tests/standalone/`), prošireni `backend/docs/`.
- 2026-04-23: Tok grana: `main` ← `development` ← `asistant-features` (i buduće feature grane).
- Vidi: 09-ARCHITECTURE.md za detaljan opis nove arhitekture.

---
