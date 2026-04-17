# Refaktorisanje Baza Goč - Log promena

## Pregled
Ovaj dokument prati refaktorisanje aplikacije "Nastavna baza Goč" od monolitne strukture ka modularnoj arhitekturi.

## Datum početka: April 17, 2026

---

## ✅ Završeni koraci

### 1. Kreiranje nove strukture foldera (April 17, 2026)
**Backend:**
- `routes/` - API endpoint-i
- `controllers/` - Poslovna logika
- `services/` - Servisi (email, auth, etc.)
- `middleware/` - Middleware funkcije
- `config/` - Konstante i konfiguracija
- `utils/` - Utility funkcije
- `email-templates/` - HTML template-i za email

**Frontend:**
- `src/services/` - API servis
- `src/constants/` - Konstante
- `src/locales/` - Prevodi

### 2. Konstante i konfiguracija (April 17, 2026)
- Kreiran `backend/config/constants.js` sa:
  - INQUIRY_STATUS (novo, obradjeno, odbijeno, otkazano)
  - LANGUAGES (sr, en)
  - USER_ROLES (admin, guest)
  - EMAIL_TEMPLATES (approved, rejected, confirmation, reset_password)

- Kreiran `frontend/src/constants/index.js` sa istim konstantama

### 3. Utility funkcije (April 17, 2026)
- Kreiran `backend/utils/dateUtils.js` sa:
  - formatDate() - Formatira datum u DD.MM.YYYY
  - isAfterDays() - Proverava da li je datum posle N dana
  - parseDate() - Parsira string u Date objekat

### 4. Email template-i (April 17, 2026)
Premesteni svi inline HTML template-i u separate fajlove:
- `email-templates/approved.html`
- `email-templates/rejected.html`
- `email-templates/confirmation.html`
- `email-templates/reset_password.html`
- `email-templates/cancelConfirmed.html`
- `email-templates/guestCreated.html`
- `email-templates/guestExists.html`

Template-i koriste {{variable}} sintaksu za zamenu.

### 5. Email servis (April 17, 2026)
- Kreiran `backend/services/emailService.js`
- Funkcije za slanje različitih tipova email-a
- Podrška za Brevo API i SMTP fallback
- Koristi template-e iz fajlova

### 6. Middleware (April 17, 2026)
**Auth middleware:**
- `backend/middleware/auth.js`
- Ujedinjeni admin i guest auth
- Factory pattern za različite tipove auth-a

**Validation middleware:**
- `backend/middleware/validation.js`
- Jednostavna validacija (spremno za Joi)

**Error handler:**
- `backend/middleware/errorHandler.js`
- Centralizovano rukovanje greškama

### 7. Routes (April 17, 2026)
Podeljene rute u separate fajlove:
- `routes/public.js` - Javni endpoint-i (home, facilities, news, inquiries)
- `routes/auth.js` - Admin login i translate
- `routes/admin.js` - Admin funkcije (inquiries, news, guests, vouchers)
- `routes/guest.js` - Guest funkcije (login, profile, reservations)
- `routes/cancel.js` - Cancel funkcionalnost

### 8. Refaktorisan index.js (April 17, 2026)
- Uklonjen sav stari kod (900+ linija)
- Sada samo setup i route mounting
- Koristi sve nove module

### 9. Frontend API servis (April 17, 2026)
- `frontend/src/services/api.js`
- Klasa sa metodama za sve API pozive
- Automatsko dodavanje auth token-a
- Centralizovana error handling

### 10. Frontend prevodi (April 17, 2026)
- `frontend/src/locales/index.js`
- Osnovni prevodi za srpski i engleski
- Custom i18n implementacija u lang store-u (bez vue-i18n biblioteke zbog instalacionih problema)
- `langStore.t()` funkcija za prevode
- Ažurirani App.vue, navigacija i footer koriste prevode

### 12. Refaktorisanje frontend komponenti (April 17, 2026)
- Zamenjeni direktni fetch pozivi sa API servisom u svim komponentama:
  - `HomeView.vue` - koristi `api.getHome()`
  - `SmestajView.vue` - koristi `api.getFacilities()`
  - `VestiView.vue` - koristi `api.getNews()`
  - `SingleNewsView.vue` - koristi `api.getNewsItem()` i `api.likeNews()`
  - `SmestajSingleView.vue` - koristi `api.getFacility()`
  - `InquiryModal.vue` - koristi `api.checkAvailability()` i `api.submitInquiry()`
- Dodani prevodi za InquiryModal u `locales/index.js`
- Ažurirani template-i da koriste `langStore.t()` umesto uslovnog renderovanja
- Frontend sada koristi centralizovan API servis za sve HTTP pozive

### 13. Konfiguracija (April 17, 2026)
- Ažuriran `.env.example` sa svim promenljivama
- Dodane zavisnosti u `package.json` (joi, dayjs, handlebars)
- CORS konfiguracija sa whitelist-om

### 14. Debug-ovanje backend API konekcije (April 17, 2026)
- Problem: Routes registrovani ali vraćaju 404
- Uzrok: Express server se bind-ovao samo na localhost, ne na 0.0.0.0
- Rešenje: Promenjen `app.listen(PORT)` u `app.listen(PORT, '0.0.0.0')`
- Dodan request logging middleware za debugging
- Testirani endpoint-i: `/api/test` i `/api/home` vraćaju 200 OK
- API sada funkcioniše i vraća podatke iz MySQL baze

### 15. Frontend/API kompatibilnost i export fix (April 17, 2026)
- Ispravljen export u `frontend/src/services/api.js`:
  - sa `export const apiService = new ApiService()`
  - na `export default new ApiService()`
- Rešen error u browser-u: "does not provide an export named 'default'"
- U `HomeView.vue` mapirani backend podaci na frontend format (`facilities` -> `galleryItems`)

### 16. CORS i admin login stabilizacija (April 17, 2026)
- Dodat `http://localhost:5174` u dozvoljene CORS origine
- Urađena robusnija CORS konfiguracija (dinamički origin + eksplicitna CORS zaglavlja)
- Verifikovan preflight (`OPTIONS /api/admin/login`) i login (`POST /api/admin/login`) sa ispravnim CORS zaglavljima
- Otkriven i uklonjen problem sa više Node procesa na portu 3000 (konflikt instanci backend-a)

### 17. Ispravke backend SQL upita prema realnoj šemi baze (April 17, 2026)
- `news` tabela u bazi koristi kolone (`title`, `excerpt`, `content`, `likes`) umesto (`title_sr`, `title_en`, `content_sr`, `content_en`, `likes_count`)
- Uklonjen uslov `published = 1` gde kolona ne postoji u trenutnoj šemi
- Ispravljen `/api/home` da vraća realne `news` i `facilities` podatke
- Ispravljen `/api/news` list endpoint prema stvarnoj šemi

### 18. Smeštaj podaci i filtriranje tipova objekata (April 17, 2026)
- Uklonjena `Пилана` iz liste smeštajnih kapaciteta
- `backend/routes/public.js` (`/api/smestaj`) sada vraća samo objekte tipa `smestaj`
- U frontend-u dodat fallback za slučaj kada endpoint vrati niz umesto objekta sa `facilities`

### 19. Razdvajanje hero fallback logike (April 17, 2026)
- Sprečeno da `Home` i `Smestaj` imaju identičan hero sadržaj iz fallback-a
- `Home` fallback hero koristi `news` podatke
- `Smestaj` fallback hero koristi smeštajne objekte

### 20. Stabilizacija hero slider-a (April 17, 2026)
- Rešen bug "slider zabode na istom slajdu"
- Uvedena stabilnija autoplay logika:
  - umesto čistog `setInterval`, koristi se restartable timer pristup
  - reset/autoplay kontrola pri promeni vidljivosti taba (`visibilitychange`)
  - zaštita za granice `currentSlide` kada se lista slajdova promeni
- Ispravka primenjena u:
  - `frontend/src/components/PageTemplate.vue`
  - `frontend/src/views/SmestajView.vue`

### 21. Finalna ispravka news detail/like endpoint-a (April 17, 2026)
- Ispravljen `GET /api/news/:id`:
  - podržava i numerički `id` i `slug`
  - koristi realnu DB šemu (`title`, `excerpt`, `content`, `likes`)
  - vraća `gallery` niz iz `media_gallery` za frontend lightbox
- Ispravljen `POST /api/news/:id/like`:
  - usklađen sa kolonom `likes` (umesto `likes_count`)
  - podržava i `id` i `slug` bez SQL konverzionih grešaka
  - vraća ažuriran broj lajkova u odgovoru
- Verifikacija:
  - `GET /api/news/new-nbgoc-site` -> `200 OK`
  - `POST /api/news/new-nbgoc-site/like` -> `200 OK` + `{"likes": ...}`

### 22. Session 01 - SQL uskladjivanje ruta (April 17, 2026)
- `backend/routes/admin.js` uskladjen sa realnom semom:
  - inquiries join preko `target_room_id -> rooms -> facilities`
  - create reservation koristi status `confirmed` i validan `cancel_token` format
  - create news koristi `title/excerpt/content/cover_image/slug` + `news_translations` za EN
  - vouchers vise ne koriste nepostojecu `vouchers` tabelu, vec JSON polje `guests.vouchers`
- `backend/routes/guest.js` uskladjen:
  - auth koristi `req.user` (u skladu sa middleware)
  - `GET /me` i broj rezervacija koriste status `confirmed`
  - dodata ruta `PUT /api/guests/password`
  - `GET /api/guests/reservations` vraca shape koji frontend dashboard ocekuje
  - redeem voucher radi nad `guests.vouchers` JSON
- `backend/routes/cancel.js` uskladjen:
  - koristi `f.name` / `rm.name` i `target_room_id`
  - reservation status prebacen na `confirmed/cancelled`
- `backend/routes/public.js` + validacija uskladjeni:
  - inquiry payload koristi `email`, `phone`, `target_room_id`
  - insert ide u postojece kolone `inquiries` tabele
  - odgovor vraca `newAccount` (frontend kompatibilno)
  - availability endpoint podrzava i listu zauzetih termina i date-range proveru

- Verifikacija (manual API testovi):
  - `GET /api/admin/inquiries` -> `200 OK`
  - `POST /api/admin/news` -> `200 OK`
  - `POST /api/admin/guests/:id/vouchers` -> `200 OK`
  - `GET /api/guests/reservations` (valid JWT) -> `200 OK`
  - `PUT /api/guests/password` -> validan auth flow (`401` za pogresnu lozinku)
  - `GET /api/cancel/:token` (invalid) -> `404` bez SQL greske
  - `POST /api/inquiries` -> `200 OK` + `newAccount`
  - `GET /api/rooms/:id/availability` -> `200 OK` (lista)
  - `GET /api/rooms/:id/availability?start=...&end=...` -> `200 OK` (available/conflicts)

### 23. Session 02 - Non-destructive DB migracija (April 17, 2026)
- Dodat `backend/migrateDb.js` kao bezbedna alternativa za `setupDb.js`.
- Skripta je idempotentna i ne koristi destruktivne operacije (`DROP`, `TRUNCATE`, `DELETE`).
- Uvedena dva moda rada:
  - `npm run migrate:dry` (plan bez izmena)
  - `npm run migrate:run` (realna primena)
- Dodate provere i uskladjivanja:
  - kolone: `inquiries.guest_id`, `reservations.guest_id`, `reservations.cancel_token`, `reservations.inquiry_id`, `news.slug`, `news.likes`
  - indeksi: `idx_reservations_room_dates`, `idx_inquiries_guest_id`, `uq_news_slug`
  - FK: `fk_inquiries_guest_id`, `fk_reservations_guest_id`, `fk_reservations_inquiry_id`
- Verifikacija:
  - `npm run migrate:dry` -> uspesan plan
  - `npm run migrate:run` -> uspesna primena bez gubitka podataka

### 24. DB lifecycle skripte za demo i clean delivery state (April 17, 2026)
- Dodat `backend/InitialConfigDB.js` za clean delivery state:
  - resetuje podatke
  - resetuje auto-increment ID vrednosti
  - ostavlja semu netaknutom
  - reseeduje admin nalog i osnovne pages zapise
- Dodat `backend/presentationDBmockData.js` za klijentsku prezentaciju:
  - radi clean reset
  - puni placeholder objekte, sobe, vesti, slajdove i galeriju
- Dodat `backend/dbLifecycleShared.js` da oba toka koriste isti reset/seed mehanizam
- Dodate npm skripte:
  - `db:init:dry`, `db:init:run`
  - `db:seed:presentation:dry`, `db:seed:presentation:run`

### 25. Smoke test ruta i release handbook (April 17, 2026)
- Dodat `backend/smokeTestRoutes.js` za automatizovanu proveru kljucnih ruta:
  - public read rute
  - admin login + admin read rute
  - guest login + guest read rute
  - cancel invalid token ponasanje
- Smoke test radi minimalno-invazivno:
  - privremeni smoke guest se uklanja po zavrsetku
  - like counter se vraca na prethodnu vrednost
- Verifikacija:
  - `npm run smoke:routes` -> uspesno
- Dodat release runbook u `docs/RELEASE_HANDBOOK.md`

### 26. Write-flow smoke + robustnost email/date tokova (April 17, 2026)
- Dodat `backend/smokeTestWriteFlow.js`:
  - inquiry -> admin approval -> reservation + cancel token -> cancel flow
  - DB verifikacija statusa i cleanup test podataka
- Dodata npm skripta `smoke:write-flow` i agregat `smoke:all`
- Ojacane rute da email greske ne obaraju poslovnu transakciju:
  - `backend/routes/admin.js`
  - `backend/routes/cancel.js`
- Ispravljena date robustnost:
  - `backend/utils/dateUtils.js` (`isAfterDays` za Date i string)
  - `backend/services/emailService.js` (`sendApproved` cancel deadline)
- Verifikacija:
  - `npm run smoke:write-flow` -> uspesno
  - `npm run smoke:all` -> uspesno

### 27. Scope i release policy dokumentovani (April 17, 2026)
- Dodat `docs/PROJECT_CONTEXT_AND_SCOPE.md` sa:
  - infrastrukturnim kontekstom (Aiven/Render/Netlify/Brevo)
  - potvrdjenim poslovnim funkcionalnostima
  - pravilom: bez hard reset-a dok se ne dodje do merge/release faze
- `docs/RELEASE_HANDBOOK.md` uskladjen sa aktivnom razvojnom politikom

---

## 🔄 Trenutni status
- Backend: ✅ Modularna struktura, API i admin login stabilni na portu 3000, CORS podešen za lokalni razvoj
- Frontend: ✅ i18n implementiran, API servis integrisan, hero slider stabilizovan, lokalno testiran na portu 5174
- Testovi: ❌ Nisu implementirani
- Dokumentacija: ⏳ Ova datoteka

---

## 📋 Sledeći koraci (po prioritetu)

### Visoki prioritet
1. **Dodati Joi validaciju** - Zameniti jednostavnu validaciju pravom bibliotekom
2. **Dodati Day.js** - Za bolje rukovanje datumima
3. **Kreirati controllers** - Izdvojiti logiku iz routes
4. **Harmonizovati status/poruke API odgovora** - standardizacija success/error payload-a

### Srednji prioritet
5. **Dodati transakcije** - Za kritične DB operacije
6. **Dodati logging** - Winston za strukturirane logove
7. **Dodati rate limiting** - Za auth endpoint-e

### Niski prioritet
8. **Dodati testove** - Jest + Supertest
9. **Dodati caching** - Redis za performanse
10. **Dodati monitoring** - Health check endpoint-i
11. **Optimizovati query-je** - N+1 problem, indeksi

---

## 📊 Metrike poboljšanja

### Pre refaktorisanja:
- Backend: 1 fajl (index.js) - 900+ linija
- Frontend: Direktni fetch pozivi u komponentama
- Email: Inline HTML stringovi
- Konstante: Hardkodovane u kodu
- Validacija: Ručna u endpoint-ima

### Posle refaktorisanja:
- Backend: 20+ fajlova, modularna struktura
- Frontend: Centralizovan API servis
- Email: Separate template fajlovi
- Konstante: Centralizovane u config fajlovima
- Validacija: Middleware sloj

---

## 🔧 Tehnologije korišćene
- Node.js + Express
- MySQL2
- Vue.js 3
- JWT za autentifikaciju
- Nodemailer + Brevo API za email
- bcryptjs za hash-ovanje
- Joi za validaciju (planirano)
- Day.js za datume (planirano)
- Handlebars za template-e (jednostavna implementacija)

---

## 📝 Napomene
- Kod je još uvek u razvojnoj fazi, ne za produkciju
- Bezbednosne mere (CORS, rate limiting) su poboljšane ali ne kompletne
- API konekcija je popravljena - backend sluša na 0.0.0.0
- Testovi će biti dodani u sledećoj fazi
- Dokumentacija će biti proširena sa API specifikacijom