# Arhitektura projekta — Nastavna baza Goč

**Poslednje ažuriranje:** 23. April 2026  
**Grana:** `development`

---

## Git tok grana

```
main            ← stabilna produkcija, nikad direktno pushuješ
  └── development   ← integracijska grana, svi featurei se spajaju ovde
        └── asistant-features   ← feature grana za chat assistant
        └── feature/ime-featurea  ← svaki novi feature dobija svoju granu
```

**Pravilo:** Nova grana se uvek pravi iz `development`:

```bash
git checkout development
git checkout -b feature/ime-featurea
```

Kad je feature gotov → merge u `development` → kad je sve stabilno → merge `development` u `main`.

---

## Backend arhitektura

### Entry point

- **`backend/server.js`** — jedini koji poziva `app.listen()`, startuje server
- **`backend/index.js`** (ili `app.js`) — Express app konfiguracija, middleware, rute

### Servisi (`backend/services/`)

| Servis                       | Svrha                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aiService.js`               | AI pipeline V2: `processAssistantMessageV2`, `decideChatTurn`, `composeChatReply` — odlučuje o toku razgovora (rezervacija, info, weather, small-talk)    |
| `chatService.js`             | Perzistentna chat istorija: `saveChatMessage`, `getChatMessages` — čita/piše `chat_messages` tabelu                                                       |
| `embeddingService.js`        | Vektorske reprezentacije teksta — podrška za `local` (vlastiti Python servis na `:8000`) ili `openai` (text-embedding-ada-002), kontroliše se kroz `.env` |
| `vectorSearchService.js`     | Semantičko pretraživanje (Qdrant ili lokalni) — koristi embeddings da pronađe relevantne činjenice                                                        |
| `chatContextGuardService.js` | Guard za kontekst razgovora — sprečava spam, overflow, off-topic                                                                                          |
| `chatStayService.js`         | Logika za smeštaj: pretraga slobodnih soba, sugestije poseta, preporuke                                                                                   |
| `emailService.js`            | Slanje emailova (Brevo/Nodemailer)                                                                                                                        |
| `weatherService.js`          | Vremenska prognoza za Goč                                                                                                                                 |
| `inquiryService.js`          | Upravljanje upitima za rezervacije                                                                                                                        |

### AI pipeline tok (V2)

```
Korisnikov poruka
    │
    ▼
decideChatTurn()        ← šalje AI-u: "šta korisnik hoće?"
    │                      vraća: { mode, missing, criteria, followUp }
    ▼
composeChatReply()      ← na osnovu moda gradi odgovor
    │   ├── 'info'      → pretraga docs JSON-ova (keyword ili vector search)
    │   ├── 'booking'   → chatStayService (slobodne sobe, sugestije)
    │   ├── 'weather'   → weatherService
    │   └── 'small_talk'→ direktan AI odgovor
    ▼
Odgovor korisniku
```

### Docs baza znanja (`backend/docs/`)

JSON fajlovi koje AI koristi kao RAG (Retrieval Augmented Generation):
`faq.json`, `prices.json`, `events.json`, `contacts.json`, `atractions.json`, `piramida-meni.json`, `campus.json`, `labs.json`, `sawmill.json`, `wooddryer.json`, `news.json`, `announcements.json`, `goc-gvozdac-okolina.json`

### Logging (`backend/logger.js`)

Winston sa dnevnom rotacijom:

- `logs/requests-YYYY-MM-DD.log` — svi HTTP requestovi (14 dana)
- `logs/qa-YYYY-MM-DD.log` — AI pitanja i odgovori (30 dana)
- `logs/qa-user-{id}-YYYY-MM-DD.log` — per-user Q&A istorija

### Baza podataka

Nova tabela u migraciji:

```sql
CREATE TABLE chat_messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  guest_id   INT NULL,          -- FK na guests.id, NULL za neregistrovane
  role       ENUM('user','assistant'),
  message    TEXT,
  session_id VARCHAR(255) NULL, -- grupišu poruke u sesiju
  meta       JSON NULL,         -- dodatni kontekst (lang, mood, itd.)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Testovi (`backend/tests/`)

```
tests/
  jest/           ← Jest testovi (npm test)
    aiService.restoran.test.js
    aiService.topics.test.js
    chatHistory.test.js
    embeddingService.test.js
    semanticSearch.test.js
    weather.test.js
  standalone/     ← Standalone skripte (node script.js, bez Jest)
    chatHistory_test.js
    embeddingService_test.js
    ...
```

---

## Frontend arhitektura

### Glavne komponente (`frontend/src/components/`)

| Komponenta               | Svrha                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| `StayAssistantPanel.vue` | Chat assistant widget (floating panel), rezervacioni flow, gost forma |
| `InquiryModal.vue`       | Modal za upit/rezervaciju                                             |
| `ReservationForm.vue`    | Forma za rezervaciju                                                  |
| `PageTemplate.vue`       | Wrapper za CMS stranice                                               |
| `ImageLightbox.vue`      | Lightbox za slike                                                     |

### Pinia store-ovi

- `guest.js` — `isLoggedIn`, `guestData`, `guest_token`
- `lang.js` — `currentLang`, `t()` (i18n)

### API servis (`frontend/src/services/api.js`)

Centralizovane sve API funkcije, uključujući:

- `chatPlanStay`, `chatReserveStay`, `chatSuggestVisit` — AI chat
- `getChatHistory`, `saveChatMessage` — perzistentna istorija
- `getReservations`, `createReservation`, itd.

---

## Plan: Chat assistant kao nezavisna komponenta

Cilj je da `StayAssistantPanel.vue` postane plug-in komponenta:

- Sopstvena konfiguracija (API URL, tema, jezik)
- Bez zavisnosti od projekat-specifičnih store-ova
- Može se importovati u bilo koji Vue 3 projekat

Ovo je dugoročni refaktor — planiran kao zasebna grana kada `asistant-features` bude stabilna na `development`.

---

## Resetovanje sajta (`resetSite.js`)

Orchestrator koji u jednom koraku dovodi sajt na prezentaciono stanje:

| Komanda                                 | Šta radi                                                  |
| --------------------------------------- | --------------------------------------------------------- |
| `npm run restart-site`                  | **DRY RUN** — prikazuje šta bi uradio, ne menja ništa     |
| `npm run restart-site:run`              | **Izvršava** reset baze + seed + sanity check             |
| `npm run restart-site:full`             | Kao `:run`, plus smoke testovi (server mora biti upaljen) |
| `node resetSite.js --verbose`           | DRY RUN sa punim SQL outputom (za debug)                  |
| `node resetSite.js --execute --verbose` | Execute + pun output                                      |

**Redosled koraka:**

1. `createDefaultDb` — kreira bazu ako ne postoji
2. `setupDb` — kreira sve tabele
3. `migrateDb` — dodaje kolone/izmene _(sažeto: X izmena, Y preskočeno)_
4. `presentationDBmockData` — seed _(sažeto: N operacija, tipovi × broj)_
5. `dbSanityCheck` — verifikuje stanje baze
6. `smokeTestRoutes` — testira API rute _(samo uz `--smoke`)_
7. `smokeTestWriteFlow` — testira write flow _(samo uz `--smoke`)_

> **Output:** Koraci 3 i 4 prikazuju kompaktan sažetak. Dodaj `--verbose` za pun SQL dump.

---

## Korisne komande

```bash
# Resetovanje sajta
cd backend
npm run restart-site              # dry run (šta bi uradilo)
npm run restart-site:run          # stvarni reset
npm run restart-site:full         # reset + smoke testovi
node resetSite.js --verbose       # dry run, pun SQL output

# Backend
npm run dev          # razvoj
npm test             # Jest testovi
npm run migrate:run  # samo migracije
npm run db:seed:presentation:run  # samo seed data

# Frontend
cd frontend
npm run dev          # Vite dev server (localhost:5173)
npm run build        # produkcioni build
```
