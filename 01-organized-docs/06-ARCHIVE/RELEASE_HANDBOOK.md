# Release Handbook

## Svrha

Ovaj dokument razdvaja tri operativna moda rada nad bazom i aplikacijom:

- schema migration
- clean initial delivery state
- presentation/demo seed state

## Aktivna razvojna politika

- Tokom aktivnog razvoja i dok branch nije spreman za merge u main:
  - nema hard reset-a aktivne baze
  - radi se iskljucivo dorada koda i funkcionalnosti
- Hard reset + odabrani seed tok izvrsava se tek u release fazi.

## Komande

### 1. Schema migracije

- `npm.cmd run migrate:dry`
- `npm.cmd run migrate:run`

### 2. Cista baza za isporuku (`InitialConfigDB.js`)

- `npm.cmd run db:init:dry`
- `npm.cmd run db:init:run`

Efekat:

- resetuje podatke i auto-increment ID vrednosti
- zadrzava semu baze
- reseeduje admin nalog
- vraca samo osnovne page zapise (`pocetna`, `smestaj`)
- nema gostiju, upita, rezervacija, objekata, soba, vesti ni galerije

### 3. Demo baza za prezentaciju (`presentationDBmockData.js`)

- `npm.cmd run db:seed:presentation:dry`
- `npm.cmd run db:seed:presentation:run`

Efekat:

- radi clean reset kao i initial config
- zatim ubacuje placeholder sadrzaj za demo:
  - objekte
  - sobe
  - vesti
  - hero slajdove
  - galeriju

### 4. Smoke test ruta

- `npm.cmd run smoke:routes`

### 5. Write-flow smoke test

- `npm.cmd run smoke:write-flow`

Pokriće:

- submit inquiry
- admin approval (`obradjeno`) i kreiranje reservation zapisa
- valid cancel token flow (`GET` + `POST`)
- DB potvrda statusa (`reservations.cancelled`, `inquiries.otkazano`)
- cleanup test podataka na kraju

### 6. Aggregate smoke

- `npm.cmd run smoke:all`

### 7. DB sanity check

- report mode: `npm.cmd run db:sanity`
- initial mode: `node dbSanityCheck.js --mode=initial`
- presentation mode: `node dbSanityCheck.js --mode=presentation`

Pokriće:

- public read rute
- admin login i osnovni admin read endpoint-i
- guest login i guest dashboard read endpoint-i
- invalid cancel token expected behavior

## Preporuceni release flow

### A. Lokalna validacija pre deploy-a

1. Pokreni backend.
2. `npm.cmd run migrate:dry`
3. `npm.cmd run smoke:routes`
4. `npm.cmd run smoke:write-flow`
5. `npm.cmd run db:sanity`

### B. Prezentacija klijentu

1. Snapshot/backup baze.
2. `npm.cmd run db:seed:presentation:run`
3. `node dbSanityCheck.js --mode=presentation`
4. `npm.cmd run smoke:all`
5. Demo aplikacije.

### C. Cista baza za isporuku

1. Snapshot/backup baze.
2. `npm.cmd run db:init:run`
3. `npm.cmd run migrate:run`
4. `node dbSanityCheck.js --mode=initial`
5. `npm.cmd run smoke:all`

## Production deploy checklist (Render + Netlify + Aiven)

### 1. Freeze i priprema

1. Zakljucaj feature branch i napravi release branch/tag.
2. Potvrdi da su env varijable popunjene na Render i Netlify.
3. Napravi backup/snapshot Aiven baze.

### 2. Backend deploy (Render)

1. Deployuj backend release commit.
2. Proveri health/basic endpoint (`/api/test`).
3. Pokreni `migrate:dry`, zatim `migrate:run` nad ciljanom bazom.
4. Pokreni `smoke:routes` i `smoke:write-flow`.

### 3. Frontend deploy (Netlify)

1. Deploy frontend release commit.
2. Potvrdi `VITE_API_BASE_URL` i redirect pravila.
3. Otvori glavne rute i proveri network pozive ka backendu.

### 4. Post-deploy provera

1. Login admin i guest.
2. Kreiranje inquiry iz UI.
3. Obrada inquiry iz admin panela.
4. Cancel flow preko tokena.
5. Provera logova (Render + DB slow/error log).

### 5. Rollback plan

1. Ako smoke test padne: stop rollout frontend-a.
2. Vrati backend na prethodni stabilan release.
3. Po potrebi vrati DB iz snapshot-a.
4. Otvori incident zapis: uzrok, impact, remediation.

## Operativna pravila

- `setupDb.js` ne koristiti nad aktivnom cloud bazom.
- Uvek prvo koristiti `:dry` komandu.
- `db:init:*` i `db:seed:presentation:*` su destruktivni za podatke, ali ne za semu.
- Za PowerShell okruzenje koristi `npm.cmd`, ne `npm`, zbog execution policy ogranicenja.
- Prezentacioni seed je smestaj-centric: ne ubacivati nesmestajne objekte (npr. pilana) u prezentacioni tok.

## Napomena o admin nalogu

- Podrazumevani seed koristi:
  - username: `admin`
  - password: `admin123`
- Moze se promeniti preko env promenljivih:
  - `ADMIN_SEED_USERNAME`
  - `ADMIN_SEED_PASSWORD`
