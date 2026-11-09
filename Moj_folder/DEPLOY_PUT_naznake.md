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
- [ ] `npm run db:snapshot` urađen i odložen  
- [ ] Render disk na API za `uploads`  
- [ ] `FRONTEND_URL` / `ALLOWED_ORIGINS` na API + agent  
- [ ] Smoke API: `cd backend && npm run smoke:write-flow` (inquiry → admin → guest → cancel)  
- [ ] Smoke rute: `npm run smoke:routes`  
- [ ] Ručno: home, mejl (Brevo), chat widget  
- [ ] Admin CMS login  

---

*Ažurirati ovaj fajl kad se zatvori finalna IT lista i kad se krene detaljni deploy plan.*
