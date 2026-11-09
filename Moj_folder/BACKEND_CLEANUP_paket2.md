# Backend cleanup — drugi paket

**Datum pregleda:** 2026-11-09  
**Posle:** prvi paket (mrtav `adminController`, galleryShape, cache invalidation, upload/bootstrap) + `nav_items` / Stranice meni.

---

## Pregled (šta sada vidiš)

| Hotspot | Stanje | Prioritet paketa 2 |
|---------|--------|--------------------|
| `controllers/admin/crudController.js` (~485 ln) | projects / staff / pages / themes / settings / hero / facilities+rooms u jednom fajlu | **P0 — split** |
| Barrel `controllers/admin/index.js` | već spreman za više modula | OK |
| `publicController.js` (~veći) | već ima helper-e iz A–C; ne dirati sada | kasnije |
| `siteGuideService.js` (~najveći) | legacy chat put; produkcija ide preko chat-agent | **van paketa** |
| Deps: `joi`, `handlebars`, `openai` | u `package.json`, runtime ih skoro ne koristi (`joi`/`handlebars` 0; `openai` samo standalone test; embedding ide preko `fetch`) | **P1 — higijena** |
| Logging | `console.log` u email/inquiry/chat/cancel; nema winston | **P2 — tanki logger**, ne full winston odmah |
| Jest | jak na AI/chat servisima; tanak na admin CRUD / nav sync | **P1 — ciljani testovi** |
| Validacija | ručni middleware; komentar „upgrade to Joi later“ | **van paketa** (ili tek posle split-a) |

---

## Cilj paketa 2

Sitniji, bezbedan BE cleanup: **čitljiviji admin moduli**, **čišći deps**, **malo više testova** — bez diranja legacy chata i bez FE feature-a.

---

## Redosled (uradi redom)

### 1. Split `crudController` (P0)

Izvući domene u zasebne fajlove, barrel ostaje isti API:

| Novi modul | Handler-i |
|------------|-----------|
| `projectsController.js` | get/create/update/delete projects |
| `staffController.js` | staff CRUD |
| `pagesController.js` | pages CRUD (+ navSync) |
| `themesController.js` | themes CRUD |
| `settingsController.js` | site_settings + hero_slides |
| `facilitiesController.js` | facilities/rooms admin |

Zajedničko: `utils/upsertEnTranslation.js` (facility/room EN upsert).

`crudController.js` → obrisati kad barrel uvozi nove module.  
Rute/`admin.js` se **ne** menjaju (i dalje destrukturiraju iz barrel-a).

**DoD:** `npm test` (relevantno) + `smoke:routes` OK; admin Stranice/Sobe i dalje rade.

### 2. Deps higijena (P1)

- Ukloniti neiskorišćene runtime deps: `joi`, `handlebars`, `openai` (standalone test prilagoditi ili označiti kao opcioni).
- Ne dirati `openai` API put u `embeddingService` (već `fetch`).

**DoD:** `npm ls` bez tih paketa; app start OK.

### 3. Ciljani Jest (P1)

Minimum:

- unit: `upsertEnTranslation` (mock db)
- unit: već postojeći `navPaths` / `navSync` behavior pokriti gde fali (bar path + ensureModule edge)

Ne ciljati full HTTP suite za ceo admin u ovom paketu.

### 4. Tanki logger (P2, opciono u istom PR-u ako ostane vreme)

- `utils/logger.js` — `info` / `warn` / `error` (wrapper oko console, `NODE_ENV` filter za debug)
- Zameniti najbučnije `console.log` u `emailService` / `inquiryService` (ne migracija celog BE na winston)

Winston ostaje **kasnije** ako zatreba nivoi + fajl/transport na Renderu.

---

## Namerno van paketa 2

- Legacy `/api/chat` + `siteGuideService` brisanje/arhiviranje  
- Full Joi validacija na sve rute  
- Image CDN / cookie / CMS rich editor (FE backlog)  
- Dalji split `publicController`  
- Premestanje `SingleNewsView` na PageTemplate  

---

## Definition of done (ceo paket 2)

- [x] `crudController.js` nestao; domene u zasebnim fajlovima  
- [x] Neiskorišćeni deps uklonjeni (`joi`, `handlebars`, `openai`)  
- [x] Jest za `upsertEnTranslation`  
- [x] Tanki `utils/logger.js` + email/inquiry  
- [ ] Commit na `main` kad korisnik potvrdi  

---

## Status

| Korak | Status |
|-------|--------|
| 1 Split crud | **urađeno** 2026-11-09 |
| 2 Deps | **urađeno** |
| 3 Jest | **urađeno** |
| 4 Logger | **urađeno** (tanki; winston kasnije) |
