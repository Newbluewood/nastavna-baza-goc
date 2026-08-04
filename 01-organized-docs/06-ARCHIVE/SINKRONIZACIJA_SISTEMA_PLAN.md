# 🚀 PLAN SINHRONIZACIJE: Goč Sajt + Chat Mikroservis (Maj 2026)

Ovaj fajl služi kao centralni dokument za usklađivanje koda između tri lokacije. **RADIMO DIREKTNO NA MAIN GRANI.**

## 🎯 CILJEVI
1. **Puna harmonizacija:** Identitčan kod na AWS-u i Renderu.
2. **Fix "Prazne forme":** AI mora da prepopuni polja (ime, email, datumi).
3. **Smart Fallback:** Gemini na sajtu mora da zna da otvori formu ako mikroservis padne.
4. **Baza & Mailovi:** Osigurati da rezervacije kreiraju naloge i šalju potvrde.

---

## 🛠️ STATUS IMPLEMENTACIJE

### Faza A: Mozak Agenta (Mikroservis)
- [x] Implementacija univerzalnog `llmProvider.js` (Claude + Gemini 2.5).
- [x] Pojačana Persona (`goc_persona.md`) za strogo popunjavanje formi.
- [x] Testiranje alata na Renderu (HTTPS podrška).

### Faza B: Backend Sajta
- [x] Ažuriranje `chatController.js` da podržava `action` objekte u fallback-u.
- [x] Ažuriranje `geminiChatService.js` za prepoznavanje tool_use.

### Faza C: Frontend Sajta
- [x] Usklađivanje `AgentChatWidget.vue` sa novim formatom podataka.
- [x] Reaktivno punjenje formi iz `chat.js` store-a.

---

## ⚠️ VAŽNE NAPOMENE
- **HTTPS:** Render verzija je primarna za Netlify sajt zbog SSL-a.
- **Identitet:** Agent se zove **Kozak**, fallback je **Gemini**.
- **Logika:** Rezervacije se upisuju u RDS MySQL bazu sajta.

---
*Plan kreiran: 13.05.2026. - Agent Antigravity*
