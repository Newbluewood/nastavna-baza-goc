# Env mapa po servisima (2026-11-13)

Produkcijski chat-agent host: **`https://chat-agent-psjk.onrender.com`**  
Site API: **`https://baza-goc-api.onrender.com`**  
FE: Netlify (`nastavnabazagoc.netlify.app`)

Ne commitovati prave secrete. Lokalni `.env` fajlovi su gitignored.

**Kanonski spisak imena ključeva (required / optional):** [`backend/env.manifest.json`](../backend/env.manifest.json)  
**Diff samo imena (bez vrednosti):** iz `backend/` → `npm run env:diff -- --service=api`

---

## Gde se pojavljuje chat-agent URL

| Mesto | Varijabla / tekst | Mora biti |
|-------|-------------------|-----------|
| Netlify → Environment | `VITE_CHAT_API_URL` | `https://chat-agent-psjk.onrender.com` |
| `frontend/.env` (lokal) | `VITE_CHAT_API_URL` | isto |
| `frontend/.env.example` | `VITE_CHAT_API_URL` | isto (primer) |
| Render → **baza-goc-api** | `INGEST_WEBHOOK_URL` | `https://chat-agent-psjk.onrender.com/api/ingest` |
| `backend/.env` (lokal) | `INGEST_WEBHOOK_URL` | isto |
| CMS greška (kod) | očekivani host u poruci | `chat-agent-psjk` |
| Docs (`DEPLOY_PUT_naznake.md`, pipeline) | host u tabelama | `chat-agent-psjk` |

Widget **ne** čita `INGEST_*`. Samo `VITE_CHAT_API_URL` → `/api/chat/stream`.

---

## Kanonski ključevi — baza-goc-api (Render)

**Required** (CMS ingest + auth + CORS):

```
# requiredOneOf: DATABASE_URL | DB_HOST (+ DB_USER/PASSWORD/NAME/PORT)
JWT_SECRET
GUEST_JWT_SECRET
FRONTEND_URL
ALLOWED_ORIGINS
INGEST_WEBHOOK_URL    # https://chat-agent-psjk.onrender.com/api/ingest
INGEST_WEBHOOK_SECRET # isti string kao na chat-agent
```

**Optional** (email, PostHog CMS, weather, vector na site API, rate limits, seed…):  
vidi `services.api.optional` u `env.manifest.json`.

Lokalni mirror: `backend/.env` (+ `.env.example`).

---

## Kanonski ključevi — chat-agent (Render)

**Required:**

```
DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / DB_PORT
INGEST_WEBHOOK_SECRET   # isti kao baza-goc-api
QDRANT_URL / QDRANT_API_KEY
EMBEDDING_MODE
ALLOWED_ORIGINS
# bar jedan: ANTHROPIC_API_KEY ili GEMINI_API_KEY
```

**Optional:** `CRON_SECRET`, `INGEST_DEBOUNCE_MS`, `CHAT_RATE_*`, `AI_BUDGET_*`, modeli, HF…  
vidi `services.agent.optional` u `env.manifest.json`.

Lokalni mirror: `chat-agent/.env` (generisan; ne u gitu). Primer: `chat-agent/.env.example`.

---

## Kanonski ključevi — Netlify FE

**Required:**

```
VITE_API_BASE_URL=https://baza-goc-api.onrender.com
VITE_CHAT_API_URL=https://chat-agent-psjk.onrender.com
```

**Optional:** `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_AGENT_ENABLED`.

Lokal: `frontend/.env`.

---

## Parovi koji MORAJU da se poklapaju

| Par | Servisi |
|-----|---------|
| `INGEST_WEBHOOK_SECRET` | baza-goc-api ↔ chat-agent |
| `INGEST_WEBHOOK_URL` host | baza-goc-api → tačno `chat-agent-psjk…/api/ingest` |
| `VITE_CHAT_API_URL` | Netlify / lokal FE → isti host agenta |
| Qdrant URL/key | chat-agent (ingest + RAG); site API Qdrant samo ako `USE_VECTOR_SEARCH` |
| MySQL | site = full user; agent = `goc_agent` |

---

## Diff ritual (bez secret vrednosti)

1. Render → Environment → copy **imena** ključeva (jedno po liniji) u npr. `backend/render-baza-goc-api.keys.txt` (gitignored ako hoćeš).
2. Iz `backend/`:

```bash
npm run env:diff -- --service=api --remote=render-baza-goc-api.keys.txt
npm run env:diff -- --service=agent --remote=render-chat-agent.keys.txt
npm run env:diff -- --service=fe
```

Izlaz: `missing on local`, `missing on remote`, `extra vs manifest` — **nikad vrednosti**.

---

## Brzi smoke

1. `GET https://chat-agent-psjk.onrender.com/api/health` → 200  
2. `GET https://baza-goc-api.onrender.com/api/health` → 200  
3. CMS → **Osveži znanje** → 202 (ne 502)  
4. Widget chat na produkciji  
