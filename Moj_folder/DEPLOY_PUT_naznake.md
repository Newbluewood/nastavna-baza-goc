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

Kad budemo **korake za deploy / produkcijski checklist**, uraditi ili eksplicitno odložiti:

| Prioritet | Stavka | Detalj |
|-----------|--------|--------|
| **P1** | Sanitize chat markdown | `marked` + `v-html` u `AgentChatWidget` → **DOMPurify** (XSS preko odgovora) — **urađeno** |
| **P1** | Uži MySQL user za agenta | least privilege — **urađeno** (`goc_agent` na Aiven + Render chat-agent). Skripta: `backend/scripts/createAgentDbUser.js` |
| **P2** | Stroža `action` schema | whitelist tipova/polja — **urađeno** (FE `sanitizeChatAction` + chat-agent `sanitizeReservationAction`) |
| **P2** | Javni agent endpoint | Origin allowlist + burst/hourly chat limit — **urađeno** (`ALLOWED_ORIGINS`, `chatBurstLimiter`); kapča / short-lived token ostaju opciono kasnije |
| **P2** | PII u LLM | UI upozorenje + agent redakcija JMBG/pasoš/kartica + persona zabrana — **urađeno**; formalna politika/stranica ostaje opciono |

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

### 2) Render persistent disk (API servis) — **ručno na Renderu**
- Disk mount npr. `/opt/render/project/src/backend/public/uploads` (isti path koji Express servirа).  
- Bez diska: novi deploy = gubitak lokalnih upload-a.  
- Alternativa kasnije: S3/Blob; **ne** BLOB u MySQL.

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
- [ ] Render disk na API za `uploads` — **još ručno** (nema `RENDER_API_KEY` u okruženju; CLI nije podešen)  
- [ ] `FRONTEND_URL` / `ALLOWED_ORIGINS` na API + agent (fakultetski origin)  
- [x] Smoke API: `cd backend && npm run smoke:write-flow` — **prošlo 2026-11-10** (lokalni API + Aiven)  
- [x] Smoke rute: `npm run smoke:routes` — **prošlo 2026-11-10**  
- [x] Chat agent live scenario `reservation_piramida_101` — **prošlo 2026-11-10** vs `https://chat-agent-kbjc.onrender.com` (`npm run test:agent`)  
- [ ] Ručno: home, mejl (Brevo), chat widget na Netlify  
- [ ] Admin CMS login (produkcija)

### Render disk (uploads) — ručni koraci
1. [Render Dashboard](https://dashboard.render.com) → servis **baza-goc-api** (site API) → **Disks** → **Add disk**  
2. Mount path: `/opt/render/project/src/backend/public/uploads` (isti path koji Express servirа)  
3. Size: start **1 GB** (dovoljno za trenutni `uploads.zip` ~1.1 MB + rast)  
4. Save → **Manual Deploy** / sačekaj redeploy  
5. U CMS uploaduj test sliku → redeploy ponovo → proveri da slika i dalje postoji na `/uploads/...`  
6. Opciono: raspakuj lokalni `uploads.zip` na disk (Shell/SFTP) ako produkcija nema sve fajlove  

Bez ovoga: novi deploy briše lokalne upload-e sa ephemeranog FS.

---

## Scoreboard ka produkcijskom 10/10 (2026-11-10)

| Traka | Ocena | Stanje |
|-------|------:|--------|
| Chat-agent kod / ugovor | ~9/10 | Cleanup + golden/live scenariji na `main`; P3 sitno ostaje |
| Sajt API + FE | ~8.5/10 | Backend paket 2 urađen; smoke routes + write-flow zeleni; cold-start fail-open |
| Chat hardening | ~9/10 | DOMPurify, goc_agent, action contract, origin/burst, PII |
| Ops / go-live | ~6.5/10 | Snapshot lokalno urađen; čeka: Render uploads disk, kopija snapshota van mašine, fakultetski CNAME/origins |
| Sadržaj MVP | ~3–5/10 | `CHECKLISTA_sadrzaj_i_pustanje.md` još otvorena |

**Ukupno ~8.2/10**. Sledeći skok: **Render disk** (ručno u Dashboardu) + kopija `backend/backups/2026-11-10T00-03-01-796` van repoa; zatim Brevo/Netlify ručni smoke i sadržaj.

---

*Ažurirati ovaj fajl kad se zatvori finalna IT lista i kad se krene detaljni deploy plan.*
