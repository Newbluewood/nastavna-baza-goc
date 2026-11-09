# Okvirna ponuda — Web platforma Nastavne baze Goč

**Klijent:** Šumarski fakultet Univerziteta u Beogradu / Nastavna baza Goč  
**Pripremio:** Nebojša Simović  
**Status:** nacrt za dogovor (nije finalni ugovor)  
**Datum:** novembar 2026.

---

## 1. Šta se isporučuje

Custom web platforma (nije WordPress šablon), spremna za produkcijski rad:

| Modul | Šta uključuje |
|--------|----------------|
| **A. Javni sajt** | Početna, smeštaj, restoran, vesti, edukacija, istraživanje, FAQ, „Istraži Goč“, kontakt; responzivno; jezik **SR / EN** |
| **B. CMS** | Admin panel: vesti, stranice, osoblje, projekti, teme, restoran/meni, hero, podešavanja; unos sr/en; pomoć prevoda (DeepL) |
| **C. Smeštaj i gosti** | Upiti/rezervacije (odobri / odbij / otkaži), mapa soba, nalog gosta, vaučeri, mejl obaveštenja, pravilo otkazivanja (min. 7 dana) |
| **D. AI chat agent** *(opciono kao poseban paket)* | Chat na sajtu, RAG preko baze znanja, predlog rezervacije / otvaranje forme; mesecni budžet potrošnje u CMS-u |
| **E. Isporuka i obuka** | Deploy na dogovoreni hosting (trenutno cloud; kasnije moguće `*.sfb.bg.ac.rs`), kratko uputstvo za administratore, demo tok |

**Tehnički stack (radi transparentnosti):** Vue 3 SPA, Node/Express API, MySQL, mejl (Brevo), opciono Qdrant + Claude/Gemini za chat.

---

## 2. Referentna tržišna vrednost (orijentacija)

Procena za **uporediv custom** projekat u regionu (agencija / iskusni freelancer), jednokratno:

| Paket | Obim | Orijentaciono tržište |
|--------|------|------------------------|
| A+B | Javni sajt + CMS + dvojezičnost | 4.500 – 7.000 € |
| C | Rezervacije, gosti, mejlovi, CRM | 2.500 – 4.000 € |
| D | AI chat agent (mikroservis + RAG) | 2.500 – 5.000 € |
| E | Deploy, dokumentacija, kratka obuka | 500 – 1.200 € |
| **Ukupno A–E** | **Cela platforma** | **≈ 10.000 – 17.000 €** |

Ovo nije cena koju tražiš od fakulteta — to je **referenca obima**, da bude jasno šta je urađeno.

*Napomena:* stari nacrt (~4.300 €) bio je za **WordPress** model. Ovaj projekat je custom aplikacija + operativni moduli + AI; tržišno je veći obim.

---

## 3. Povlašćena ponuda za fakultet / nastavnu bazu

Pristup: projekat se radi i kao doprinos nastavnoj bazi i fakultetu (entuzijazam / početnička profesionalna etapa), uz **transparentan popust** u odnosu na referentnu vrednost — ne „jeftino pa loše“, već svesno niža cena za instituciju.

### Predlog jednokratne cene (razvoj + isporuka)

Struktura po stavkama — **prvi red tržišna referenca (sredina), drugi red tvoja povlašćena cena:**

| # | Stavka | Šta pokriva |
|---|--------|-------------|
| **1** | **Javni sajt (SR/EN)** | Početna, smeštaj-prikaz, restoran, vesti, edukacija, istraživanje, FAQ, Istraži Goč, kontakt, responzivni UI |
| | Tržišna | **3.000 €** |
| | Povlašćena | **1.200 €** |
| **2** | **CMS** | Admin: vesti, stranice, osoblje, projekti, teme, meni, hero, podešavanja; sr/en unos; DeepL dugme |
| | Tržišna | **2.500 €** |
| | Povlašćena | **1.000 €** |
| **3** | **Smeštaj, gosti, rezervacije** | Upiti, odobri/odbij/otkaži, mapa soba, nalog gosta, vaučeri, pravilo 7 dana |
| | Tržišna | **2.400 €** |
| | Povlašćena | **1.000 €** |
| **4** | **Mejl tokovi** | Brevo: prijem upita, login podaci, odobrenje/odbijanje |
| | Tržišna | **800 €** |
| | Povlašćena | **300 €** |
| **5** | **AI chat agent** | Mikroservis, RAG (Qdrant), Claude+Gemini fallback, akcije/forme, prikaz potrošnje u CMS |
| | Tržišna | **3.500 €** |
| | Povlašćena | **1.200 €** |
| **6** | **Deploy + kratka admin dokumentacija** | Postavljanje na dogovoreni hosting, smoke provera, kratko uputstvo za CMS |
| | Tržišna | **800 €** |
| | Povlašćena | **300 €** |

**Zbir (jednokratno)**

| Varijanta | Tržišna | Povlašćena |
|-----------|---------|------------|
| Bez AI (stavke 1–4 + 6) | **9.500 €** | **3.800 €** |
| Sa AI (stavke 1–6) | **13.000 €** | **5.000 €** |

**Preporuka za prvu ponudu klijentu:**  
**5.000 €** — komplet (sa AI), ili **3.800 €** ako AI ostaje faza 2.

Popust: reda **≈ 60 %** ispod tržišne reference (snižena cena za fakultet / NB, uz jasan obim).

### Održavanje (opciono, mesečno)

| Stavka | Predlog |
|--------|---------|
| Tehnička podrška + softver/cloud briga (do dogovorenog broja sati/mes) | **80 – 150 € / mes** |
| Bez održavanja | hitne ispravke grešaka 30 dana od isporuke; posle satnica |

*(Odvojeno od računa infrastrukture ispod.)*

---

## 4. Mesečni troškovi infrastrukture (nisu tvoja „satnica“)

Klijent plaća cloud **odvojeno** (ili ti pa refakturišeš). Brojke ~ USD/EUR orijentacija (proveri dashboard pre potpisa).

### Minimalni **plaćeni** setup (produkcija bez free sleep)

| Servis | Uloga | Plan koji ima smisla | ~ €/mes |
|--------|--------|----------------------|---------|
| **Netlify** (ili Vercel) | samo Vue `dist` / SPA | Free često dosta; Pro ako treba tim/privatni repo | **0 – 20** |
| **Render** ×2 | API Express + chat-agent (uvek budni) | Starter **$7** po servisu | **≈ 14** |
| **Aiven MySQL** | baza | Developer **$5** (ne Free — Free nestaje/ograničen) | **≈ 5** |
| **Qdrant** | vektori za AI | Free za mali KB; Standard kad poraste | **0 – ~25+** |
| **Brevo** | mejl | Free tier često OK na početku | **0 – 25** |
| **DeepL** | prevod CMS | po potrošnji / Free API limit | **0 – 10** |
| **AI (Claude/Gemini)** | chat | **cap u app** 10–20 € | **10 – 20** (dogovor) |

**Zbir infrastrukture (realan minimum za produkciju):** ≈ **30 – 50 €/mes** (+ AI cap), bez tvog održavanja.  
**Sa tvojim održavanjem 80–150 €:** ukupno prema klijentu ≈ **110 – 200 €/mes**.

Detalji + zašto ne Vercel za API: [`MESCNI_TROSKOVI_cloud.md`](MESCNI_TROSKOVI_cloud.md).

**Predlog u ponudi:** fakultet snosi cloud račune (ili ti pa fakturišeš 1:1); tvoj paušal pokriva brigu o softveru.

---

## 5. Kada sajt može da krene — sadržaj, checklist, CMS, backup

### Odgovor na pitanje „kada radimo uživo?“

Sajt **tehnički** može biti spreman, ali **javni pust** zavisi od sadržaja koji dostavi klijent.

> Čim dostavite **minimum sadržaja** u dogovorenom formatu (vidi checklistu), sajt se može pustiti.  
> Ostali sadržaj može stizati do dogovorenog roka — ili ga nakon obuke **sami unosite u CMS**.

Zajednička lista sa ček-poljima: [`CHECKLISTA_sadrzaj_i_pustanje.md`](CHECKLISTA_sadrzaj_i_pustanje.md) — šalje se učesnicima da svi vide šta fali i gde si ti blokiran (npr. čekaš tekstove/fotografije, ne kod).

### Dva nivoa sadržaja

| Nivo | Značenje |
|------|----------|
| **Minimum za prvi pust (MVP)** | Dovoljno da sajt nije prazan i da rezervacije/kontakt imaju smisla |
| **Pun sadržaj do roka** | Ostale stranice, vesti, galerije, EN prevodi, sitni tekstovi — do datuma X ili putem CMS-a |

### CMS — ko šta radi posle predaje

- Osobama kojima dodeliš **CMS nalog** mogu same da **dodaju, menjaju i brišu** sadržaj (vesti, stranice, sobe, meni, itd.), bez novog developera za svaku izmenu.
- Ti nisi dugoročni „unosilac teksta“ — osim dogovorenog prvog kruga / obuke.
- *(Trenutno: admin nalozi sa pristupom panelu. Fino zrnasto „više uloga“ (npr. samo vesti) može biti kasniji dodatak ako zatreba.)*

### First deploy kao backup (zaštita od slučajnog brisanja)

Pri **prvom zvaničnom deployu / predaji** čuva se **snapshot** (backup baze + dogovoreni upload fajlovi) kao referentna tačka.

- Ako neko u CMS-u slučajno obriše ili pokvari sadržaj, može se **vratiti na stanje prvog deploya** (ili kasniji dogovoreni backup).
- To nije zamena za redovne backup-e hostinga — već **poznata bezbedna tačka** na dan predaje.
- Uključeno u stavku **Deploy + dokumentacija**; učestaliji backup-i / restore na zahtev = održavanje ili satnica.

### Pouzdanost cloud servisa i rezervne opcije

Sistem je **namerno podeljen** na više servisa. Ako jedan padne, ostali često i dalje rade — ali ne sve funkcije.

| Ako padne… | Šta korisnik vidi | Rezerva / šta radimo |
|------------|-------------------|----------------------|
| **Frontend host** (npr. Netlify) | Ceo sajt nedostupan | Privremeni deploy na drugi host / fakultetski server kad bude spreman; DNS prebacivanje |
| **API** (npr. Render) | Sajt „školjka“ može da se učita, CMS/rezervacije ne rade | Redeploy API-ja; kasnije isti kod na SFB/RCUB ili drugom VPS-u |
| **MySQL** (npr. Aiven) | Nema sadržaja ni rezervacija | Redovni dump + first-deploy snapshot; restore na istu ili drugu MySQL instancu |
| **Chat agent** | Chat ne radi; **ostatak sajta radi** (forme, CMS, rezervacije ručno) | Agent je opcion; može se privremeno ugasiti u UI |
| **Qdrant** | AI slabije / bez RAG znanja | Agent/fallback bez vektora ili isključen chat |
| **Claude / Gemini** | Nema pametnog chata / prevoda | Već postoji ideja graceful degradation: sajt radi bez AI; Claude↔Gemini fallback gde je urađen |
| **Brevo / mejl** | Upiti se snimaju u bazi, mejl možda ne stigne | Admin vidi upit u CMS-u; rezervni SMTP (fakultet) kad IT potvrdi |
| **DeepL** | Nema jednim klikom SR→EN | Ručni unos EN u CMS |

**Princip za klijenta:** kritičan put je **javni sajt + CMS + baza + rezervacije**. AI chat i automatski prevod su **dodatak** — njihov pad ne sme da „ugasi“ nastavnu bazu.

**Šta već imamo / planiramo kao rezervu:**
1. First-deploy + povremeni backup baze/upload-a  
2. AI kao neobavezan sloj (sajt bez chata i dalje koristan)  
3. Dva LLM pravca gde je urađeno (primarni + fallback model)  
4. Dugoročno: poddomen na fakultetu / RCUB kao **stabilnija „krovna“ adresa**, cloud kao radni sloj dok IT ne preuzme deo  
5. Dokumentovan restore postupak (kome se javlja, gde je dump)

**Šta nije uključeno bez posebnog dogovora:** automatski multi-region failover, 24/7 dežurstvo, garancija 99.99 % uptime kao kod banke. Za fakultetski sajt realno je: brza dijagnoza + restore iz backupa + privremeno gašenje AI ako treba.

Detaljnija matrica: [`POUZDANOST_i_rezerve.md`](POUZDANOST_i_rezerve.md).

---

## 6. Šta jeste / nije uključeno

**Uključeno u jednokratnu cenu (A–E po izboru):**
- isporuka funkcionalnosti iz tabele u §1
- ispravke grešaka 30 dana od zvanične predaje
- kratko pisano uputstvo za CMS (admin)
- jedan krug usklađivanja sadržaja pri predaji (uz checklistu)
- **snapshot / backup stanja na first deploy** (vidi §5)

**Nije uključeno (osim ako se dopiše):**
- izrada kompletnog vizuelnog rebrendinga / nove fotografije
- dugoročno punjenje sadržaja umesto admin tima
- migracija na `*.sfb.bg.ac.rs` ako IT zahteva veliki custom rad — dogovor **posle** odgovora IT-a
- štampa, marketing, Google Ads
- garancija da AI uvek odgovara savršeno (AI je pomoćni sloj; sajt radi i bez njega)

---

## 7. Predlog teksta za klijenta (kratko)

> Predmet: web platforma Nastavne baze Goč — dvojezični javni sajt, CMS, portal za goste i rezervacije, uz opcioni AI asistent.  
>  
> Referentna tržišna vrednost uporedivog custom rešenja: oko 10.000–17.000 €.  
> Povlašćena cena za Šumarski fakultet / NB Goč: **5.000 €** (sa AI) ili **3.800 €** (bez AI), jednokratno.  
> Opciono održavanje: 80–150 € mesečno.  
> Mesečni troškovi hostinga i AI API-ja vode se odvojeno (cap potrošnje AI dogovaramo unapred).  
>  
> **Rok puštanja** zavisi od dostave sadržaja: šaljemo zajedničku checklistu (minimum za prvi pust + ostatak do roka). Posle predaje, dodeljeni CMS nalozi sami uređuju sadržaj. Pri prvom deployu čuvamo backup tačku za eventualni povratak.  
>  
> Hosting na poddomenu fakulteta (`nastavnabazagoc.sfb.bg.ac.rs`) usklađuje se sa IT službom nakon potvrde tehničkih uslova.

---

## 8. Napomene za tebe (ne mora u mail klijentu)

- Brojke su **okvir**; možeš pomeriti ±10–15 % posle razgovora.
- Ne potpisuj fiksnu cenu migracije na SFB server dok nemaš odgovore IT-a.
- Checklistu ažuriraj i šalji učesnicima (Drive/Word sa checkboxima) — ista stavka „čekam od vas“ = ti nisi u kašnjenju koda.
- Tehnički backup na first deploy dogovoriti eksplicitno (dump MySQL + kopija `/uploads`) pre nego što im daš produkcione CMS lozinke.
- Kad klijent prihvati okvir: aneks sa rokom, plaćanjem, i datumom „ostatak sadržaja do …“.

---

*Dokument: okvirna ponuda — radna verzija. Finalni PDF/Word posle tvoje korekcije iznosa.*
