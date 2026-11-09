# Chat agent — pristup podacima, UI akcije, bezbednost

Radna beleška (nov 2026). Dopuna IT briefinga / arhitekture.

## Kako radi (glas vs ruke)

```text
Korisnik u chatu
    → FE (AgentChatWidget)  HTTPS/SSE
    → chat-agent (Render)
         ├─ LLM (Claude/Gemini)
         ├─ Qdrant (RAG)
         └─ MySQL: čitanje soba/sadržaja; upis usage + chat_messages
    ← SSE: tekst + opcioni action JSON
    → FE tumači action (npr. open_reservation_form)
    → otvara InquiryModal (popunjena polja)
    → korisnik potvrdi
    → site API (Express)  POST /api/inquiries  ← pravi upis rezervacije + mejl
```

**Agent ne kreira rezervaciju u bazi.** Predlaže akciju; **sajt** izvršava posle korisnika.

*(Stari tekst u ARCHITECTURE_AND_FUTURE.md kaže „agent nikad ne dira DB“ — to više nije tačno 100%: agent **čita** MySQL i **piše** ograničene tabele, ali ne inquiry/rezervaciju.)*

## Koliko ima pristup podacima

| Resurs | Agent | Napomena |
|--------|-------|----------|
| MySQL sobe / sadržaj | **read** | alati + ingest izvor |
| MySQL `ai_budget_monthly` | **write** | trošak AI |
| MySQL `chat_messages` | **write/read** | istorija četa |
| MySQL `guests` | **read** (hydrate) | profil za formu |
| MySQL inquiries / CMS write | **ne** | samo site API |
| Qdrant | read (+ ingest write) | RAG |
| LLM | šalje tekst razgovora | mogući PII u promptu |

## Komunikacija sa UI

1. Browser → `VITE_CHAT_API_URL` → `/api/chat/stream` (SSE).  
2. Chunkovi `type: text` → prikaz poruke.  
3. `type: action` → npr. `{ type: 'open_reservation_form', room_id, check_in, … }`.  
4. Pinia `chat.js` → `openInquiryFromAction` → modal.  
5. Submit → **Express**, ne agent.

Dakle akcije **utiču na app** (otvaraju UI, prefill), ali **ne zaobilaze** API za trajni upis rezervacije.

## Koliko je ovo bezbedno rešeno

### Dobro (namerno)
- Rezervacija / mejl / CMS write idu kroz **site API** + postojeća pravila.  
- Agent nema tool koji radi `INSERT` u inquiries.  
- AI pad ≠ pad rezervacionog toka (forma i dalje postoji).  
- Odvojen servis — može se ugasiti bez gašenja sajta.

### Rizici / rupe (realno)
| Rizik | Nivo | Šta uraditi dugoročno |
|-------|------|------------------------|
| Agent ima DB kredencijale (šire nego „samo read“) | srednji | poseban MySQL user: read + samo `chat_messages` / `ai_budget_*` |
| Zlonameran/prompt-injection tekst → čudan `action` JSON | srednji | strogi allowlist tipova akcija + validacija polja na FE **i** pre submita na API |
| Javni agent endpoint (svaki posetilac) | srednji | rate limit, budžet (već delom); opciono origin check |
| PII u LLM promptu | srednji–visok (privatnost) | minimizacija; politika; ne logovati suviše |
| Dokument kaže „ne dira DB“ a kod dira | nizak (proces) | ažurirati docs |

### Ocena za klijenta / IT
**Arhitektura je zdrava za produkciju fakultetskog sajta** (glas/ruke).  
Nije „AI ima root na sve“.  
Nije ni „zero trust savršenstvo“ — treba DB least-privilege + čvršća validacija action payload-a kao hardening (nije blokator za CNAME start).
