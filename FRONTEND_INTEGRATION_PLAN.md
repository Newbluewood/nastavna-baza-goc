# Arhitektura Chat Agenta i Plan za Vue 3 Integraciju

Ovaj dokument služi kao "izvor istine" (Source of Truth) za vlasnika projekta i sve buduće AI agente koji budu radili na projektu. Detaljno opisuje trenutno stanje završenog Backend mikroservisa i jasan plan za predstojeću integraciju na Vue 3 Frontendu.

## 1. Šta smo do sada napravili (The Baby)
Razvili smo potpuno nezavisan, otporan i inteligentan **Agentic RAG sistem** za Nastavnu Bazu Goč.
Umesto da bude "ugrađen" u postojeći projekat, Agent živi svoj život kao odvojen API Mikroservis na Renderu.

### 1.1 Backend Arhitektura (Render Microservice)
- **Hostovanje:** Aplikacija je hostovana na `https://chat-agent-kbjc.onrender.com` i komunicira putem standardnih HTTP POST zahteva (`/api/chat`).
- **Mozak Operacije:** Koristimo `Anthropic Claude 3.5 Sonnet` model kao glavnog rezonatora (LLM Provider).
- **RAG (Retrieval-Augmented Generation):** Pre nego što odgovori korisniku, sistem pretvara korisnikovo pitanje u brojeve (Vektore) koristeći lokalni model (`Xenova/all-MiniLM-L6-v2`) i pretražuje lokalnu Qdrant bazu (preuzetu sa Aivena) za najsličnijim kontekstom (tekstovima o Goču).
- **Alati (Tool Calling):** Agent može "sam" da okine spoljne funkcije kada zatreba! Implementiran je alat `proveri_sobe` koji će kasnije ići direktno u bazu i proveravati raspoloživost.
- **Sigurnost:** Dodat je `express-rate-limit` koji štiti server od spamovanja (dozvoljava ograničen broj poruka), a na vrhu stoji i **CORS** politika koja dozvoljava samo komunikaciju sa pouzdanim frontendom.

---

## 2. Plan za sledeću fazu (Frontend Vue 3 Integracija)

Naš sledeći korak je da zamenimo starog i prostog "assistanta" na sajtu (Vue 3) sa ovim moćnim agentom. Ovaj deo mora biti dizajniran besprekorno i otporno.

### Korak 2.1: Uspostavljanje bezbedne grane (Git Flow)
Pošto već imamo živ Vue 3 projekat, **ne smemo direktno dirati `main` ili `develop` granu**.
- Prvi zadatak će biti pravljenje `feature/agentic-chat-ui` git grane. Ovde ćemo razvijati chat.

### Korak 2.2: Povezivanje API-ja
Kreiranje servisa na frontendu (npr. `agentService.js`) koji će slati POST zahteve na `https://chat-agent-kbjc.onrender.com/api/chat`.
- Payload koji se šalje mora sadržati trenutnu poruku i istoriju (zbog konteksta razgovora).
- Primer Payload-a: `{ "message": "Ima li slobodnih soba?", "history": [...] }`

### Korak 2.3: Upravljanje Stanjem (State Management)
Pravimo novi Pinia store (`useChatStore`) ili lokalni state unutar komponente:
- Pamćenje istorije razgovora (Sliding window od poslednjih 5 poruka da bismo uštedeli LLM tokene).
- Loading stanje dok čekamo Render da odgovori (Prikaz prelepe animacije "Agent kuca...").

### Korak 2.4: Vizuelni Dizajn (Wow Faktor)
Pošto smo radili vrhunski backend, UI mora biti u skladu sa najboljim modernim praksama.
- Glatke i prirodne animacije (Micro-animations).
- Podrška za prikazivanje kompleksnih odgovora (boldiran tekst, cene, liste) koje LLM vrati.
- Jasna vizuelna povratna informacija ukoliko okine "Rate Limit".

---

## 3. Tehnička Uputstva za Nove Agente
Ukoliko neki drugi LLM (Agent) preuzme ovaj fajl, bitno je da zna:
1. Ne diraj Render kod (repo: `chat-agent`), on je stabilan. Sve promene idu u frontend kod.
2. Ako Vue vraća CORS Error, znači da Render `cors()` middleware u `index.js` nije dobro podešen za Frontend Origin.
3. Ako vraća `500 Internal Error`, proveri Render Dashboard logove – obično je problem vezan za AI provajder ključeve.

Idemo na rad! 🚀
