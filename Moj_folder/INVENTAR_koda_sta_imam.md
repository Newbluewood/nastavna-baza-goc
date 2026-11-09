# Inventar koda — šta stvarno imaš

Datum: 2026-11-08.  
Aktivan repo: `D:\DesktopSSD\Projekti\baza-goc-priprema`  
(Ne mešati sa starom kopijom `D:\DesktopSSD\baza-goc-priprema`.)

Svrha: orijentacija posle razvoja „prompt po prompt“ + test na Netlify.  
Chat-agent hardening → `DEPLOY_PUT_naznake.md` (nije ovde).

---

## 1. Koren — šta je šta

| Folder / fajl | Šta je |
|---------------|--------|
| `frontend/` | Vue 3 + Vite SPA → Netlify |
| `backend/` | Express API → Render |
| `01-organized-docs/` | Docs (delom zastareli) |
| `Moj_folder/` | Ponuda, IT brif, checkliste — nije runtime |
| `README.md` | **Najbolji** start — čitaj prvo |

Šum: `frontend/dist/` (build), dupli asseti u `frontend/public` i `backend/public`, `backend/docs/*.json` (legacy RAG za **in-repo** chat, ne za eksterni agent).

Chat agent = **poseban repo** (`chat-agent`), nije u ovom monorepu.

---

## 2. Kako sistem stoji (produkcija)

```text
Browser (Netlify SPA)
  ├─ REST  →  Express API (Render)  →  MySQL (Aiven)
  │              mejl Brevo, DeepL, opciono Qdrant/AI u API-ju
  └─ SSE   →  chat-agent (Render)   →  MySQL + Qdrant + Claude/Gemini
               action JSON  →  FE otvara formu
               submit forme →  opet Express (rezervacija)
```

---

## 3. Frontend — mapa

**Ulaz:** `main.js` → `App.vue` (javni shell + uvek `AgentChatWidget` + `InquiryModal`).

**Router:** javno / gost / admin (JWT u `localStorage`).

**Stores:** `lang`, `settings`, `guest`, `chat` (SSE + akcije rezervacije).

**Servisi:**
- `api.js` — skoro sav sajt API (veliki fajl)
- `agentService.js` — samo eksterni agent (SSE)

**Najteži fajlovi (tu je „prompt nasleđe“):**
- `AgentChatWidget.vue` (~960 ln)
- guest `DashboardView`, admin News/Restaurant/Rooms/Reservations (~600+)
- `InquiryModal.vue`, `api.js`, `stores/chat.js`

Admin view-i: sličan CRUD pattern kopiran (npr. `getImageUrl`), bez zajedničkog data-layera.

---

## 4. Backend — mapa

**Ulaz:** `server.js` listen; `index.js` app + CORS + rute.

| Prefiks | Uloga |
|---------|--------|
| `/api` | javni sajt (keš) |
| `/api/admin` | login + CMS |
| `/api/guests` | portal gosta |
| `/api/cancel` | otkaz tokenom |
| `/api/ai` | admin AI (proofread…) |
| `/api/chat` | inquiry (`reserve-stay`) + history; AI ide na chat-agent |

**Bitni servisi:** `inquiryService`, `emailService`, `aiBudgetService`, `publicController`…  
**Legacy monolit:** arhiviran u `backend/archive/legacy-chat/` (nije na rutama).  
**Mrtav kod:** `adminController.js` (nije importovan) — ostatak refaktora.  
**Joi** u package.json, validacija i dalje ručna.

**Opasne skripte (NE na produkciji):** `db:init:*`, `restart-site*` — vidi README.

---

## 5. Dva chat sistema (važno da ne pomešaš)

| Put | Gde | Status |
|-----|-----|--------|
| **Produkcija** | Widget → `VITE_CHAT_API_URL` → chat-agent SSE | Ono što vidiš na sajtu |
| **Ruke na sajtu** | `POST /api/chat/reserve-stay` + `/api/chat/history` | Forma upisuje inquiry; istorija za ulogovanog gosta |
| **Arhiva** | `backend/archive/legacy-chat/` | `siteGuideService`, plan-stay, suggest-visit, fallback — rute ugašene 2026-11-09 |

---

## 6. Docs — čemu verovati

| Veruj | Oprez / zastarelo |
|-------|-------------------|
| Koren `README.md` | `09-ARCHITECTURE.md` (`StayAssistantPanel`…) |
| `02-PROJECT_CONTEXT_AND_SCOPE.md` (poslovna pravila) | `00-PROJECT_CONTEXT-SR.md`, README-FRONTEND/BACKEND checkliste |
| `Moj_folder` (ponuda/IT) | `frontend/README.md` (Vite template) |

---

## 7. „Prompt debt“ — šta osećaš kao haos

1. Veliki god-fajlovi (chat widget, siteGuide, api.js)  
2. Dupli chat stack (agent + legacy API)  
3. Dupli static asseti / commitovan `dist`  
4. Scratch skripte, `console.log` šum  
5. Kopiran admin CRUD  
6. Docs koji lažu o imenima komponenti  
7. `winston` referenca bez paketā u dependencies (rizično za Gemini logger)

Nema mnogo TODO komentara — dug je u **strukturi**, ne u nalepnicama.

---

## 8. Predložene ture (redom) — „šta imam“

1. **Jedna javna stranica do MySQL** — npr. smeštaj: view → `api.js` → `public.js` → `publicController`  
2. **Rezervacija E2E** — InquiryModal → POST inquiries → mejl → admin rezervacije → gost dashboard / cancel — **API smoke:** `backend/tests/smokeTestWriteFlow.js` (`npm run smoke:write-flow`); mejl ostaje ručna/Brevo provera  
3. **Chat glas/ruke** — `chat.js` + `agentService` → action → forma → API (pa tek legacy siteGuide)  
4. **Jedan CMS resurs** — npr. vesti ili teme + DeepL dugme  
5. **Opasne zone** — `migrateDb` vs `InitialConfigDB` / `resetSite` (šta README zabranjuje)

---

## 9. Šta dalje (kad kažeš)

Ne refaktorisati sve odjednom. Posle orijentacije tipično:
- tura 1 ili 3 uživo (zajedno u chatu), ili  
- mali P1 sa deploy puta (DOMPurify), ili  
- spisak „mrtvo / legacy / ne dirati produkciju“.

### Tura 1 urađena (2026-11-08) — `/smestaj` → MySQL

```text
URL /smestaj
  → router → SmestajView.vue (loadData)
  → api.getFacilities(lang) → GET {VITE_API_BASE_URL}/api/smestaj?lang=
  → backend index.js mount /api → routes/public.js
  → cacheMiddleware → getFacilities (publicController)
  → SQL: facilities (+ translations), pages slug smestaj, hero_slides
  → JSON { pageTitle, textContent, facilities, slides }
  → Vue filter type==='smestaj' (backend već filtrira) + prikaz kartica
```

### Tura 1b urađena — `/smestaj/:id` jedan objekat

```text
Klik na listi → router.push(/smestaj/{id})
  → SmestajSingleView.vue loadData
  → api.getFacility(id, lang) → GET /api/smestaj/:id?lang=
  → getFacility: facilities by id + rooms (+ translations, gallery)
  → JSON objekat sa rooms[]
  → UI: opis objekta, lista soba, dugme → InquiryModal
  → ?openInquiry=1&roomId=… (deep link iz chata) takođe otvara modal
```
