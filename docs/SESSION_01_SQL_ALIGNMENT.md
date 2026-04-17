# Session 01 - SQL Alignment

## Kontekst
Aktivna Aiven sema se razlikuje od delova backend koda.

## Cilj
Uskladiti rute koje jos koriste stare kolone (`name_sr`, `title_sr`, `published`, `likes_count`, itd.) i potvrditi rad kroz testove.

## Plan rada
1. Mapiraj route fajlove sa SQL neslaganjima.
2. Uskladi jednu po jednu rutu sa realnim kolonama.
3. Restart backend.
4. Testiraj endpoint-e.
5. Upisi rezultat u REFACTORING_LOG.md.

## Trenutni backlog neslaganja (prioritet)
1. backend/routes/admin.js ✅
- upiti koriste `f.name_sr`, `f.name_en`, `r.name_sr`, `r.name_en`.
- create news koristi `title_sr`, `title_en`, `content_sr`, `content_en`, `published`.

2. backend/routes/guest.js ✅
- upiti koriste `f.name_sr`, `f.name_en`, `rm.name_sr`, `rm.name_en`.

3. backend/routes/cancel.js ✅
- upiti koriste `f.name_sr`, `rm.name_sr`.

4. backend/routes/public.js ✅
- inquiry insert koristi kolone koje nisu potvrdene u aktuelnoj sem i treba ih uskladiti sa `inquiries` tabelom.

## Rezultat Session 01
- Sva 4 backlog fajla uskladjena sa trenutnom Aiven semom.
- Endpoint-i testirani i potvrdeni kroz API pozive (`200` gde je ocekivano).
- Frontend-kompatibilni response shape zadrzan/uskaldjen.

## Evidence (sa testova)
- `GET /api/admin/inquiries` -> 200
- `POST /api/admin/news` -> 200
- `POST /api/admin/guests/:id/vouchers` -> 200
- `GET /api/guests/reservations` -> 200
- `GET /api/cancel/:token` (invalid) -> 404 bez SQL greske
- `POST /api/inquiries` -> 200 + `newAccount`
- `GET /api/rooms/:id/availability` -> 200

## Sledeca sesija (Session 02)
Tema: Bezbedan `migrateDb.js` (non-destructive) + pre-deploy smoke checklist za Render/Netlify.

## Test dokazi koje cuvamo
- API status + body za svaku popravljenu rutu.
- Ako je UI ukljucen, screenshot ili opis toka.
- Kratak zapis: "problem -> fix -> rezultat".

## Definition of Done
- Nema SQL greske za target rute.
- Endpoint odgovori su konzistentni sa frontend ocekivanjem.
- Log update uradjen.
