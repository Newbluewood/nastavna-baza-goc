# Put ka deployu — naznake (nije IT brif)

Ovaj fajl je **za nas** (razvoj / go-live checklist), ne za mail/sastanak sa fakultetskim IT-om.

IT brif: [`IT_BRIEFING_priprema.md`](IT_BRIEFING_priprema.md)  
Ponuda / troškovi / pouzdanost: ostali fajlovi u `Moj_folder/`.

---

## Faze (podsetnik)

1. **0A** — IT briefing (teme 1–12) + finalna lista pitanja  
2. **0C** — ponuda klijentu  
3. **1** — odgovori IT + scenario (CNAME preferenca)  
4. **2** — detaljni deploy plan  
5. **Hardening pre / uz produkciju** ← naznake ispod  
6. **Go-live** (DNS, env, backup, smoke)

---

## Naznaka: Chat agent + FE bezbednost (hardening)

**Ne objašnjavati IT-u na sastanku** osim ako pitaju „da li AI piše u bazu rezervacija“ → kratko: *ne, samo predlaže formu; upis ide preko API-ja.*

### Potvrda hostinga (2026-11-12)

| Komponenta | Gde živi | Dokaz |
|------------|----------|-------|
| FE chat widget | Netlify → **Render** `https://chat-agent-kbjc.onrender.com` | live bundle `agentService-*.js` `baseURL`; lokalni `VITE_CHAT_API_URL` |
| Site API | Render `baza-goc-api` | env / deploy |
| MySQL | **Aiven** (`*.aivencloud.com`) | `DB_HOST` — baza, **nije** chat-agent |

Aiven ≠ stari agent. Agent je Render; Aiven je shared MySQL za API + agent.

Kad budemo **korake za deploy / produkcijski checklist**, uraditi ili eksplicitno odložiti:

| Prioritet | Stavka | Detalj |
|-----------|--------|--------|
| **P1** | Sanitize chat markdown | `marked` + `v-html` u `AgentChatWidget` → **DOMPurify** (XSS preko odgovora) — **urađeno** |
| **P1** | Uži MySQL user za agenta | least privilege — **Aiven + Render verifikovano 2026-11-12**: `goc_agent` (SELECT rooms OK; DELETE inquiries blocked); posle Render rebuild: health 200, `/api/rooms/resolve?name=101` vraća sobe, chat čita cene iz MySQL. Skripta: `backend/scripts/createAgentDbUser.js`. Kredencijali: `backend/.agent-db-credentials.local` (gitignored). |
| **P2** | Stroža `action` schema | whitelist tipova/polja — **urađeno** (FE `sanitizeChatAction` + chat-agent `sanitizeReservationAction`) |
| **P2** | Javni agent endpoint | Origin allowlist + burst/hourly chat limit — **urađeno** (`ALLOWED_ORIGINS`, `chatBurstLimiter`); kapča / short-lived token ostaju opciono kasnije |
| **P2** | PII u LLM | UI upozorenje + agent redakcija JMBG/pasoš/kartica + persona zabrana — **urađeno**; formalna politika/stranica ostaje opciono |
| **P2** | API abuse limit | Express in-memory rate limit na admin/guest login+register i inquiry/reserve-stay — **urađeno 2026-11-12** (`middleware/rateLimit.js`) |

### Render: zalepi `goc_agent` (obavezno — dashboard)

1. Otvori `backend/.agent-db-credentials.local` (lokalno, ne commit).
2. Render Dashboard → servis **chat-agent** (ne `baza-goc-api`) → **Environment**.
3. Postavi / zameni: `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_NAME`, `DB_PORT`, `DB_SSL=true` (vrednosti iz fajla).  
   Ako agent koristi samo `DATABASE_URL`, zameni user/password u URI-ju na `goc_agent` + novu lozinku; ukloni ili uskladi diskretne `DB_*` da ne pobede jedni druge.
4. **Save** → Manual Deploy / Auto redeploy.
5. Smoke: `GET https://chat-agent-kbjc.onrender.com/api/health` → 200; jedan chat / resolve sobe sa sajta.
6. Ako chat pukne na DB auth — vrati stari user privremeno, pa proveri da Aiven dozvoljava remote `goc_agent@%` (već kreiran).

**Site API ostaje na punom DB useru** (`avnadmin` / postojeći `DATABASE_URL`).

**Primeri i dubina:**  
[`CHAT_AGENT_rizici_primeri.md`](CHAT_AGENT_rizici_primeri.md)  
[`CHAT_AGENT_pristup_i_bezbednost.md`](CHAT_AGENT_pristup_i_bezbednost.md)

**Kada ući u plan izvršenja:** posle izabranog hosting scenarija (I2), **pre** ili **uz** prvi klijentski go-live — bar P1 (DOMPurify + DB user) ne ostavljati „za nekad“ ako chat ide uživo.

---

## Naznaka: Ostalo na putu (već dogovoreno)

### 1) First-deploy snapshot — **skripta spremna**
```bash
cd backend
npm run db:snapshot
```
Izlaz: `backend/backups/<timestamp>/` (`*.sql` + `uploads.zip` + `MANIFEST.txt`, **gitignored**).  
Sačuvati van repoa (disk/cloud enkriptovano). Ponoviti pre većih migracija / go-live.

### 2) Uploads na Render **free** planu — **nema persistent disk**
- Free Web Service **ne podržava** Disks → upload-i na FS nestaju posle redeploy-a.  
- **MVP politika (sada):**
  1. Kritične slike koje moraju preživeti deploy → u gitu (`backend/public/uploads/…` / statički asseti), ne samo CMS upload na live FS.  
  2. Posle svakog deploy-a: po potrebi restaurirati iz `backups/.../uploads.zip` (lokalni snapshot) ili ponovo uploadovati kroz CMS.  
  3. `npm run db:snapshot` pre većih izmena — offline kopija.  
- **Kasnije (plaćeni plan ili objekat storage):** Render Disk **ili** S3/R2/Blob; **ne** BLOB u MySQL.

### 3) Env posle CNAME — **čekа IT / DNS**
Kad poddomen živi (npr. `https://nastavnabazagoc.sfb.bg.ac.rs`):

| Servis | Env | Akcija |
|--------|-----|--------|
| Site API (Render) | `FRONTEND_URL`, `ALLOWED_ORIGINS` | dodaj novi origin pored Netlify |
| Chat-agent (Render) | `ALLOWED_ORIGINS` | isto |
| Netlify FE | domain + `VITE_*` ako treba | CNAME / custom domain |

Dok CNAME nema: ostaje Netlify URL — ne dirati.

### 4) Još ugovor / operativa
- Mesečno: infrastruktura vs tvoje održavanje (cenovnik)  
- Exit / predaja pristupa u ugovoru  

---

## Go-live mini-check (posle CNAME)
- [x] `npm run db:snapshot` — **urađeno 2026-11-10** → `backend/backups/2026-11-10T00-03-01-796/` (`defaultdb.sql` ~134 KB, `uploads.zip` ~1.1 MB, `MANIFEST.txt`). **gitignored** — kopirati van repoa (OneDrive/enkriptovan disk).  
- [~] Persistent uploads — **N/A na Render free** (nema Disks). Koristiti git + snapshot/re-upload politiku iz §2.  
- [ ] `FRONTEND_URL` / `ALLOWED_ORIGINS` na API + agent (fakultetski origin)  
- [x] Smoke API: `cd backend && npm run smoke:write-flow` — **prošlo 2026-11-10** (lokalni API + Aiven)  
- [x] Smoke rute: `npm run smoke:routes` — **prošlo 2026-11-10**  
- [x] Chat agent live scenario `reservation_piramida_101` — **prošlo 2026-11-10** vs `https://chat-agent-kbjc.onrender.com` (`npm run test:agent`)  
- [x] Ručno/Netlify: home + nav + chat widget — **2026-11-10** (`nastavnabazagoc.netlify.app`)  
- [x] Mejl (Brevo/SMTP) — **2026-11-10** stvarni inquiry potvrda stigla odmah, nije spam (gost Nebojsa Simovic; SR+EN telo)  
- [x] Admin CMS login UI — `/admin/login` živi (produkcija)

### Kad / ako bude plaćeni plan — Disk koraci
1. Render Dashboard → **baza-goc-api** → **Disks** → **Add disk**  
2. Mount: `/opt/render/project/src/backend/public/uploads`  
3. ~1 GB → redeploy → CMS test upload → drugi redeploy → slika mora ostati

---

## Scoreboard ka produkcijskom 10/10 (2026-11-10)

| Traka | Ocena | Stanje |
|-------|------:|--------|
| Chat-agent kod / ugovor | ~9/10 | Cleanup + golden/live scenariji na `main`; P3 sitno ostaje |
| Sajt API + FE | ~8.5/10 | Backend paket 2 urađen; smoke routes + write-flow zeleni; cold-start fail-open |
| Chat hardening | ~9.5/10 | DOMPurify, `goc_agent` Aiven+Render (2026-11-12 smoke OK), action/origin/burst/PII; API login/inquiry rate limit |
| Ops / go-live | ~8.5/10 | Netlify+API+admin+chat+inquiry mejl OK; snapshot OK; free-plan uploads; čeka fakultetski CNAME/origins |
| Sadržaj MVP | ~5.5/10 | Struktura/MVP skelet na produkciji; dosta demo teksta/slika; čeka klijentsku saglasnost + CMS naloge + finalne kontakte |

**Ukupno ~8.7/10**. Mejl tok zatvoren. Sledeći skok: klijentska zamena demo sadržaja (checklist A) + IT CNAME kad bude.

---

*Ažurirati ovaj fajl kad se zatvori finalna IT lista i kad se krene detaljni deploy plan.*
