# Checklist — sadržaj i puštanje sajta (Nastavna baza Goč)

**Svrha:** svi učesnici vide šta je stiglo, šta fali, i gde je rad **blokiran čekanjem sadržaja** (ne razvoja).  
**Format dostave:** vidi § Format na dnu.  
**Status:** `[ ]` nije / `[~]` delimično / `[x]` gotovo

**Odgovorna osoba (klijent):** ________________  
**Kontakt za sadržaj:** ________________  
**Datum prvog pusta (cilj):** ________________  
**Rok za ostatak sadržaja:** ________________

---

## A. Minimum za prvi pust (MVP) — bez ovoga sajt ne ide uživo

### Opšte
- [ ] Zvaničan naziv / potpis institucije na sajtu (SR)
- [ ] Kratak opis Nastavne baze Goč za početnu (SR, 1–2 pasusa)
- [ ] Kontakt: adresa, telefon, email, (opciono mapa/koordinate)
- [ ] Logo (PNG/SVG) + favicon ako postoji
- [ ] Saglasnost da se sajt pusti sa MVP sadržajem (ostatak stiže do roka)

### Smeštaj (minimum)
- [ ] Lista objekata / tipova smeštaja koji idu uživo
- [ ] Za svaku sobu/jedinicu u MVP: naziv, kratak opis (SR), kapacitet, cena (ili „na upit“)
- [ ] Bar 1–2 fotografije po objektu ili po tipu sobe (vidi format slika)
- [ ] Potvrđena pravila: check-in/out, otkazivanje (sistem već ima pravilo min. 7 dana)

### Operativa
- [ ] Email na koji stižu upiti/rezervacije (admin prima obaveštenja)
- [ ] Ko dobija CMS nalog(e) za prvi pust (ime + email)
- [ ] Potvrda mejl domene / Brevo (ili fakultetski SMTP) — da mejlovi ne idu u spam

**Blokada developera dok gore nije `[x]`:** da / ne — stavke koje fale: _______________

---

## B. Pun sadržaj do dogovorenog roka (može posle MVP pusta)

### Stranice i tekstovi (SR)
- [ ] Edukacija
- [ ] Istraživanje
- [ ] FAQ
- [ ] Restoran (opis + meni bar u osnovnoj verziji)
- [ ] Ostale CMS stranice po dogovoru
- [ ] Hero / početni slajdovi (tekst + slike)

### „Istraži Goč“ / teme
- [ ] Lista tema
- [ ] Tekstovi + slike po temi

### Osoblje / projekti / vesti
- [ ] Osoblje (ime, uloga, foto, kontakt po potrebi)
- [ ] Projekti
- [ ] Početne vesti (ili dogovor da CMS tim unosi sam)

### Engleski (EN)
- [ ] Prioritetni EN tekstovi za MVP stranice **ili** dogovor: EN dopunjava CMS + DeepL posle pusta
- [ ] EN za smeštaj (nazivi/opisi) do roka

### Smeštaj — dopuna
- [ ] Sve sobe/jedinice sa opisima i cenama
- [ ] Komplet fotografija
- [ ] Posebni uslovi / napomene za goste

---

## C. Posle predaje — CMS i backup

- [ ] Obuka / kratko uputstvo za CMS urađeno
- [ ] CMS nalozi dodeljeni dogovorenim osobama
- [ ] Dogovoreno: izmene sadržaja ubuduće rade **oni** preko CMS-a
- [ ] **First deploy backup** sačuvan (baza + uploadi) — datum: ________  
  _(dev: `cd backend && npm run db:snapshot` → `backend/backups/…`, van gita)_
- [ ] Klijent zna kome javlja ako treba restore na tu tačku

---

## D. Hosting / IT (paralelno, ne meša se sa sadržajem)

- [ ] Dogovor sa IT (fakultet/univerzitet) za poddomen / server
- [ ] Privremeni cloud URL OK do prelaska na `*.sfb.bg.ac.rs`
- [ ] Ko plaća mesečne API/hosting troškove do prelaska

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
