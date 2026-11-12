# Env mapa po servisima (2026-11-13)

Produkcijski chat-agent host: **`https://chat-agent-psjk.onrender.com`**  
Site API: **`https://baza-goc-api.onrender.com`**  
FE: Netlify (`nastavnabazagoc.netlify.app`)

Ne commitovati prave secrete. Lokalni `.env` fajlovi su gitignored.

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

## Render → baza-goc-api (site)

Obavezno za „Osveži znanje“ / auto-ingest:

```
INGEST_WEBHOOK_URL=https://chat-agent-psjk.onrender.com/api/ingest
INGEST_WEBHOOK_SECRET=<isti string kao na chat-agent>
```

Ostalo (već tipično na servisu): `DATABASE_URL` ili `DB_*`, `JWT_*`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, email/Brevo, PostHog personal key, …

Lokalni mirror: `backend/.env` (+ `.env.example`).

---

## Render → chat-agent

```
# DB — least privilege (iz backend/.agent-db-credentials.local)
DB_HOST=…
DB_USER=goc_agent
DB_PASSWORD=…
DB_NAME=defaultdb
DB_PORT=25232
DB_SSL=true

INGEST_WEBHOOK_SECRET=<isti kao baza-goc-api>
ALLOWED_ORIGINS=https://nastavnabazagoc.netlify.app,…

# LLM / RAG
ANTHROPIC_API_KEY=…
GEMINI_API_KEY=…
EMBEDDING_MODE=GEMINI
QDRANT_URL=…
QDRANT_API_KEY=…
AI_MODEL=claude-sonnet-4-6
AI_FALLBACK_MODEL=gemini-2.5-flash

# Opciono
CRON_SECRET=…
CHAT_RATE_* / AI_BUDGET_* / INGEST_DEBOUNCE_MS
```

Lokalni mirror: `chat-agent/.env` (generisan; ne u gitu). Primer: `chat-agent/.env.example`.

---

## Netlify → frontend

```
VITE_API_BASE_URL=https://baza-goc-api.onrender.com
VITE_CHAT_API_URL=https://chat-agent-psjk.onrender.com
VITE_POSTHOG_KEY=…
VITE_POSTHOG_HOST=…
```

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

## Brzi smoke

1. `GET https://chat-agent-psjk.onrender.com/api/health` → 200  
2. `GET https://baza-goc-api.onrender.com/api/health` → 200  
3. CMS → **Osveži znanje** → 202 (ne 502)  
4. Widget chat na produkciji  
