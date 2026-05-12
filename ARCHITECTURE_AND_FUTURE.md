# 🧠 Arhitektura i Filozofija AI Sistema (Future-Proof Design)

Ovaj dokument opisuje arhitektonske odluke donete tokom razvoja Goč AI Agenta, sa fokusom na skalabilnost, otpornost i prenosivost.

---

## 1. Koncept: "Razdvajanje Glasa od Ruku" (Decoupling)

Sistem je dizajniran tako da AI Agent (Mikroservis) služi isključivo kao **intelektualni sloj**, dok Sajt (Frontend/Backend) služi kao **izvršni sloj**.

- **Glas (Agent):** Priča sa korisnikom, pretražuje bazu znanja (RAG) i donosi odluke o tome koju akciju treba preduzeti.
- **Ruke (Sajt):** Otvara forme, upisuje u bazu podataka, šalje mailove i procesira logiku rezervacije.

**Prednost:** Agent nikada ne dodiruje direktno bazu podataka sajta (sigurnost). On samo šalje "instrukciju" (Action Object) koju sajt razume i izvršava.

---

## 2. LLM Gateway & Fallback Resilience

Sistem ne zavisi od jednog AI modela. Implementiran je **Gateway obrazac**:
1. **Primarni model (Claude Sonnet 4.6):** Koristi se za visoku preciznost i kompleksno razmišljanje.
2. **Sekundarni model (Gemini 2.5 Flash):** Automatski preuzima ulogu ako primarni model ostane bez kredita ili postane nedostupan.

**Inovacija:** Fallback sistem nije samo tekstualni. I Gemini je obučen da koristi iste alate kao Claude, čime se obezbeđuje kontinuitet funkcionalnosti (npr. otvaranje forme radi čak i u fallback modu).

---

## 3. Pametno Prepopunjavanje Formi (Smart Pre-filling)

Problem "prazne forme" je rešen na tri nivoa:
- **AI Disciplina:** Persona strogo nalaže popunjavanje svih polja u alatu.
- **Backend Mapiranje:** Logika u `llmProvider.js` automatski ispravlja greške u imenovanju polja (`args` vs `input`).
- **Frontend Fallback:** Ako AI zaboravi podatak, Vue Store ga povuči iz ulogovanog profila korisnika.

---

## 4. Buduća Primena (White-Labeling)

Ovaj sistem je dizajniran da bude **univerzalan**. Da biste ga primenili na bilo koji drugi projekat (npr. prodaja nekretnina, zakazivanje pregleda), potrebno je uraditi samo tri stvari:

1. **Promena Persone:** Zameniti `goc_persona.md` novim instrukcijama.
2. **Novi Alati:** Definisati nove JSON šeme u `tools/` folderu.
3. **Znanje:** Obnoviti vektorsku bazu u Qdrantu novim podacima.

---

## 5. Tehnički Stack
- **Backend:** Node.js (Express)
- **AI:** Anthropic Claude & Google Gemini (Multi-modal)
- **Vektorska baza:** Qdrant (Hybrid search)
- **Frontend:** Vue 3 (Composition API) + Pinia Store

---
*Dokument kreiran: Maj 2026. - Vizija stabilnog i univerzalnog AI asistenta.*
