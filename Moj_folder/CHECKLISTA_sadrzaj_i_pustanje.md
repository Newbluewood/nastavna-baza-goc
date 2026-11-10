# Checklist — sadržaj i puštanje sajta (Nastavna baza Goč)

**Svrha:** svi učesnici vide šta je stiglo, šta fali, i gde je rad **blokiran čekanjem sadržaja** (ne razvoja).  
**Format dostave:** vidi § Format na dnu.  
**Status:** `[ ]` nije / `[~]` delimično / `[x]` gotovo

**Odgovorna osoba (klijent):** ________________  
**Kontakt za sadržaj:** ________________  
**Datum prvog pusta (cilj):** ________________  
**Rok za ostatak sadržaja:** ________________

**Poslednji tehnički audit sadržaja:** 2026-11-10 (live: Netlify + `baza-goc-api` + chat-agent).  
Većina teksta/slika je **demo/prezentaciona** — za klijentski go-live treba zamena stvarnim podacima.

---

## A. Minimum za prvi pust (MVP) — bez ovoga sajt ne ide uživo

### Opšte
- [x] Zvaničan naziv / potpis institucije na sajtu (SR) — footer: Наставна база Гоч / Шумарски факултет Универзитета у Београду
- [~] Kratak opis Nastavne baze Goč za početnu (SR, 1–2 pasusa) — postoji, ali je „Почетна презентациона страница“ / demo ton
- [~] Kontakt: adresa, telefon, email — footer: Брезнички пут бб, Краљево, `booking.goc@sfb.bg.ac.rs`, 036 815 102; settings `contact_*` još delom placeholder (`info@gvozdac.rs`)
- [x] Logo (PNG/SVG) + favicon — logo u headeru na Netlify
- [ ] Saglasnost da se sajt pusti sa MVP sadržajem (ostatak stiže do roka) — **čeka klijenta**

### Smeštaj (minimum)
- [x] Lista objekata / tipova smeštaja koji idu uživo — 5 objekata (Пирамида, Студенац, Власта, Борика, Гвоздац)
- [~] Za svaku sobu/jedinicu u MVP: naziv, kratak opis (SR), kapacitet, cena — npr. Пирамида 10 soba sa cenama; opisi/cene treba klijentska potvrda
- [~] Bar 1–2 fotografije po objektu — Пирамида/Студенац lokalni `/images/…`; Власта/Борика/Гвоздац Unsplash; galerije soba često prazne
- [x] Potvrđena pravila: check-in/out, otkazivanje — sistemsko pravilo min. 7 dana (u kodu/UI); klijent da potvrdi tekst za goste

### Operativa
- [~] Email na koji stižu upiti/rezervacije — footer `booking.goc@sfb.bg.ac.rs`; app šalje preko konfigurisanog mail providera (Brevo/SMTP u env) — **proveriti da li Render env ima iste vrednosti i da li mail stiže u inbox**
- [ ] Ko dobija CMS nalog(e) za prvi pust (ime + email) — **čeka klijenta**
- [~] Potvrda mejl domene / Brevo (ili fakultetski SMTP) — ključevi postoje u lokalnom/dev env; produkcijski inbox test (ne spam) još nije formalno zatvoren

**Blokada developera dok gore nije `[x]`:** **ne** za tehnički rad — sajt već živi na Netlify.  
**Blokada klijentskog go-live:** da — stavke koje fale: saglasnost MVP, CMS nalazi, potvrda kontakt/mail, zamena demo sadržaja.

---

## B. Pun sadržaj do dogovorenog roka (može posle MVP pusta)

### Stranice i tekstovi (SR)
- [~] Edukacija — ruta/API živi (`/edukacija`)
- [~] Istraživanje — živi (`/istrazivanje`)
- [~] FAQ — živi (`/faq`)
- [~] Restoran (opis + meni bar u osnovnoj verziji) — API `200`
- [~] Ostale CMS stranice po dogovoru — meni kompletan
- [~] Hero / početni slajdovi — 2 slajda; jedan Unsplash, jedan lokalni; subtitle „клијентску презентацију“

### „Istraži Goč“ / teme
- [x] Lista tema — sekcija „Откријте Гоч“ + API themes `200`
- [~] Tekstovi + slike po temi — sadržaj postoji; treba klijentska redaktura

### Osoblje / projekti / vesti
- [~] Osoblje — 5 profila, ali placeholder foto + demo email (`@goc.rs`)
- [~] Projekti — lista postoji (delom demo)
- [~] Početne vesti — 7 vesti; bar jedna eksplicitno kaže da je demo za UI

### Engleski (EN)
- [~] Prioritetni EN tekstovi za MVP — lang switch radi; home EN `Teaching Base Goč`, facility EN npr. Hotel Pyramid
- [~] EN za smeštaj — delimično preko prevoda; treba revizija

### Smeštaj — dopuna
- [ ] Sve sobe/jedinice sa opisima i cenama — potpuna klijentska provera
- [ ] Komplet fotografija — lokalne cover + prazne galerije
- [ ] Posebni uslovi / napomene za goste — tekst za goste nije finalan

---

## C. Posle predaje — CMS i backup

- [ ] Obuka / kratko uputstvo za CMS urađeno
- [ ] CMS nalozi dodeljeni dogovorenim osobama
- [ ] Dogovoreno: izmene sadržaja ubuduće rade **oni** preko CMS-a
- [x] **First deploy backup** sačuvan (baza + uploadi) — datum: **2026-11-10**  
  _(dev: `backend/backups/2026-11-10T00-03-01-796/`, van gita; kopirati offline)_
- [ ] Klijent zna kome javlja ako treba restore na tu tačku

---

## D. Hosting / IT (paralelno, ne meša se sa sadržajem)

- [ ] Dogovor sa IT (fakultet/univerzitet) za poddomen / server
- [x] Privremeni cloud URL OK do prelaska na `*.sfb.bg.ac.rs` — `https://nastavnabazagoc.netlify.app/`
- [ ] Ko plaća mesečne API/hosting troškove do prelaska

---

## E. Tehnički prolaz produkcije (2026-11-10) — nije sadržaj, ali ide uz pust

| Provera | Rezultat |
|---------|----------|
| Netlify home | `200`, UI + chat widget + nav |
| API `/api/health` | `ok` + `db: true` |
| API home / smeštaj / kontakt settings | `200` |
| Admin login UI | `/admin/login` živi („Админ Пријава“) |
| Chat-agent health | `200` |
| Live reservation scenario | `reservation_piramida_101` prošao vs Render |
| Smoke write-flow / routes | prošli lokalno vs Aiven |
| Render persistent uploads disk | **N/A** na free planu (git + snapshot politika) |

---

## Format dostave sadržaja

| Tip | Kako dostaviti |
|-----|----------------|
| Tekst SR/EN | Word, Google Doc ili Markdown — **jedan doc po stranici** ili jasno označene sekcije |
| Cene / sobe | Tabela (Excel/Sheets): objekat, soba, kapacitet, cena, napomena |
| Slike | JPG/WebP/PNG; po mogućnosti max ~2000 px širine; naziv fajla npr. `piramida-soba-101-01.jpg` |
| Logo | SVG ili PNG na providnoj pozadini |
| Kontakti | Jedna lista: uloga → email/telefon |
| Zabranjeno | Skrenute PDF-ove cele knjižice bez izdvojenog teksta (usporava unos) |

Predaja: jedan folder (Drive/WeTransfer) + mail „sadržaj za MVP“ ili „sadržaj dopuna — rok …“.

---

## Legenda statusa za deljenje

| Oznaka | Značenje |
|--------|----------|
| Čeka klijenta | Blokada na sadržaju / odluci |
| Čeka developera | Tehnički rad |
| Čeka IT | Domen / server / DNS |
| Gotovo | Stavka zatvorena |

*Ažuriraj ovu listu i šalji učesnicima posle svake veće predaje sadržaja.*
