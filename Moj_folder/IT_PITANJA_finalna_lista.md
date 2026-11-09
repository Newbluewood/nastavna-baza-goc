# Nastavna baza Goč — tehnički uslovi (poddomen i hosting)

**Adresati:** Fakultet šumarstva / SFB · RCUB · Univerzitet u Beogradu  

Molimo odgovore na pitanja ispod. Predloženi model za početak: **CNAME** zapis za `nastavnabazagoc.sfb.bg.ac.rs` ka postojećem frontend hostu; API, chat mikroservis, baza podataka i spoljni servisi (mejl, AI, vektorska baza) na managed cloud infrastrukturi. Alternativni model (hosting kod Vas) razmatramo ukoliko to zahtevaju Vaša pravila ili infrastruktura.

### Kako aplikacija trenutno radi

```text
Browser (Netlify SPA)
  ├─ REST  →  Express API (Render)  →  MySQL (Aiven)
  │              mejl Brevo, DeepL, opciono Qdrant/AI u API-ju
  └─ SSE   →  chat-agent (Render)   →  MySQL + Qdrant + Claude/Gemini
               action JSON  →  FE otvara formu
               submit forme →  opet Express (rezervacija)
```

Uz predloženi CNAME start, javni URL bi bio fakultetski (`nastavnabazagoc.sfb.bg.ac.rs` → Netlify), dok API i chat-agent ostaju na Renderu kao gore.

**Priprema (interna):** [`IT_BRIEFING_priprema.md`](IT_BRIEFING_priprema.md)

---

## Upit

**Predmet:** Nastavna baza Goč — poddomen i hosting (tehnički uslovi)

Poštovani,

radim web platformu za Nastavnu bazu Goč (javni sajt, CMS, rezervacije; opciono AI chat).  
Želimo javnu adresu tipa **`nastavnabazagoc.sfb.bg.ac.rs`**.

**Predlog za početak (minimalno opterećenje Vaše infrastrukture):**  
poddomen kao **CNAME** na postojeći frontend host (Netlify); HTTPS preko tog hosta (Let’s Encrypt).  
Backend (API), chat mikroservis, baza i spoljni servisi (mejl, AI, vektorska baza) ostaju na managed cloud-u. Mi održavamo te servise; Vi DNS poddomen.

Molim odgovore na pitanja ispod (dovoljno i u reply-u, tačka po tačka).  
Ukoliko preferirate drugačiji model (hosting na Vašoj infrastrukturi), navedite šta možete da podržite (statički sadržaj / PHP / Node.js / Docker).

Unapred hvala,  
[ime]  
[kontakt]

---

## Pitanja — osnovni model (CNAME)

### 1. Poddomen i DNS
- [ ] Možete li kreirati **`nastavnabazagoc.sfb.bg.ac.rs`**?
- [ ] Da li je prihvatljiv **CNAME** ka našem frontend hostu (tačan target dostavljamo iz Netlify panela)?
- [ ] Ko je **kontakt** za DNS izmene i koliki je uobičajeni rok?
- [ ] Da li je potreban interni ticket / odobrenje za novi poddomen?

**Odgovor:** _________________________________

### 2. HTTPS
- [ ] Da li je prihvatljivo da **HTTPS / Let’s Encrypt** ide preko frontend hosta (Netlify), bez ručne izdaje sertifikata kod Vas?

**Odgovor:** _________________________________

### 3. Podela odgovornosti
- [ ] Da li Vam odgovara podela: **Vi — DNS**; **mi —** Netlify / Render / baza / AI / mejl (održavanje softvera i cloud servisa)?
- [ ] Da li Vam je potreban **read-only** uvid u cloud status, ili je dovoljan naš kontakt?

**Odgovor:** _________________________________

### 4. Lokacija podataka / politika (GDPR / pravila fakulteta)
- [ ] Da li je prihvatljivo da **MySQL i API** budu na **EU managed cloud**-u (npr. Aiven / Render), dok je **javni URL** na `sfb.bg.ac.rs`?
- [ ] Ukoliko **nije** — da li baza mora biti u akademskoj mreži? (u tom slučaju važe dodatna pitanja ispod)
- [ ] Postoje li obavezni zahtevi pre go-live (politika privatnosti, kolačići, rok čuvanja podataka)?

**Odgovor:** _________________________________

### 5. Mejl (obaveštenja / From)
- [ ] Da li je prihvatljivo da transakcione mejlove šalje **Brevo** sa našeg API hosta?
- [ ] Ukoliko zahtevate **fakultetski SMTP** — ko dostavlja parametre i ko podešava **SPF/DKIM** za adresu pošiljaoca?

**Odgovor:** _________________________________

### 6. Informativno — izlazni servisi (sa našeg cloud-a, ne sa Vašeg servera)
Sa naših Render servisa idu HTTPS pozivi ka: **Aiven MySQL, Brevo, DeepL, Anthropic, Google Gemini, Qdrant Cloud, Open-Meteo**.  
API ključevi su u env na cloud-u, ne u frontendu.

- [ ] Da li je ovaj model (outbound sa cloud infrastrukture) prihvatljiv uz CNAME scenarij?

**Odgovor:** _________________________________

### 7. Chat agent (informativno)
Chat je odvojen mikroservis (**Server-Sent Events / streaming HTTPS**; **nije WebSocket**). Predlažemo da ostane na cloud-u; sajt i CMS funkcionišu i bez chata.

- [ ] Da li je cloud agent prihvatljiv?

**Odgovor:** _________________________________

---

## Dodatna pitanja — ukoliko se razmatra hosting na Vašoj infrastrukturi

Ovaj odeljak važi samo ako umesto CNAME modela tražite smeštaj frontenda, API-ja ili baze na Vašoj strani. Ukoliko je CNAME model prihvatljiv, odgovori na ova pitanja nisu potrebni.

### 8. Šta server može da pokrene
- [ ] Za ovaj poddomen: da li podržavate samo **statičke** fajlove, **PHP**, **Node.js** (dugovečni proces) i/ili **Docker**?
- [ ] Da li je to RCUB, server fakulteta, ili spoljni VPS?

**Odgovor:** _________________________________

### 9. Frontend na Vašoj strani (umesto CNAME ka Netlify)
- [ ] Da li je moguć upload gotovog **`dist`** paketa?
- [ ] Da li možete SPA fallback (nepostojeći path → `index.html`)?

**Odgovor:** _________________________________

### 10. Backend (Express / Node) na Vašoj strani
- [ ] Kako držite dugovečne servise (**systemd / PM2 / Docker**)?
- [ ] Ko postavlja **env** tajne? Ko radi restart / deploy?
- [ ] Da li je moguć SSH pristup za developera?

**Odgovor:** _________________________________

### 11. MySQL na Vašoj strani
- [ ] Nova baza (odvojena od WordPress instance)?
- [ ] Ko kreira korisnika baze?
- [ ] Kakva je backup politika?
- [ ] Ukoliko API ostane na cloud-u: da li je moguć **allowlist IP** + SSL za remote pristup (API, chat-agent i ingest moraju u istu bazu)?  
  Ukoliko remote pristup **nije** dozvoljen, API mora biti bliže bazi ili baza ostaje na cloud-u.

**Odgovor:** _________________________________

### 12. Disk za CMS slike
- [ ] Kvota (GB), backup foldera, način serviranja javnih URL-ova slika?

**Odgovor:** _________________________________

### 13. Agent / SSE na Vašoj strani
- [ ] Da li je moguć duži proxy timeout za **SSE / streaming HTTPS**?
- [ ] Da li je moguć odvojen path ili port?

**Odgovor:** _________________________________

### 14. Outbound sa Vašeg servera (ukoliko je API kod Vas)
- [ ] Da li je dozvoljen HTTPS 443 ka Brevo, DeepL, LLM, Qdrant (i ka bazi ukoliko je spolja)?
- [ ] Postoji li allowlist / proxy?

**Odgovor:** _________________________________

### 15. Qdrant
- [ ] Da li je prihvatljiv Qdrant Cloud, self-host (Docker) kod Vas, ili rad bez vektorske baze?

**Odgovor:** _________________________________

### 16. Radno vreme podrške
- [ ] Kontakt i radno vreme za DNS i eventualne incidente na serveru?

**Odgovor:** _________________________________

---

## Beleške posle razgovora

| # | Tema | Odgovor | Scenario (CNAME / hibrid / on-prem) |
|---|------|---------|-------------------------------------|
| 1 | DNS / CNAME | | |
| 2 | HTTPS | | |
| 3 | Podela uloga | | |
| 4 | Lokacija podataka | | |
| 5 | Mejl | | |
| 6 | Outbound (cloud) | | |
| 7 | Agent (cloud) | | |
| 8+ | Dodatna pitanja | | |

**Izabrani scenario:** _______________________  
**Datum / učesnici:** _______________________

---

## Napomena uz predloženi model

> Za Vašu infrastrukturu je najjednostavnije i najbezbednije da držite DNS poddomen, dok aplikacija i tajne ostanu na izolovanom cloud okruženju. Ukoliko politika zahteva bazu ili API na Vašoj strani, prilagodićemo model — za to su predviđena dodatna pitanja u odeljku iznad.
