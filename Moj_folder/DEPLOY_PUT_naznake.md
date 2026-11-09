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
| **P2** | PII u LLM | UI upozorenje; politika; opciona redakcija |

**Primeri i dubina:**  
[`CHAT_AGENT_rizici_primeri.md`](CHAT_AGENT_rizici_primeri.md)  
[`CHAT_AGENT_pristup_i_bezbednost.md`](CHAT_AGENT_pristup_i_bezbednost.md)

**Kada ući u plan izvršenja:** posle izabranog hosting scenarija (I2), **pre** ili **uz** prvi klijentski go-live — bar P1 (DOMPurify + DB user) ne ostavljati „za nekad“ ako chat ide uživo.

---

## Naznaka: Ostalo na putu (već dogovoreno)

- First-deploy snapshot (baza + `uploads`)  
- Render persistent disk (ili S3 kasnije) — ne BLOB u MySQL  
- Env: `FRONTEND_URL` / `ALLOWED_ORIGINS` posle CNAME  
- Mesečno: infrastruktura vs tvoje održavanje (cenovnik)  
- Exit / predaja pristupa u ugovoru  

---

*Ažurirati ovaj fajl kad se zatvori finalna IT lista i kad se krene detaljni deploy plan.*
