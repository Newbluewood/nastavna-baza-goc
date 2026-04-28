(Moved from docs/refactor-docs/MENTORSHIP_PLAN.md)

# Mentorship Plan - Baza Goc

Cilj: da ovaj projekat razumes dovoljno dobro da ga samostalno odrzavas, branis pred klijentom i bezbedno deploy-ujes.

## 1. Pravilo rada

- Jedan fokus po sesiji: jedna ruta ili jedan tok.
- Svaka izmena mora imati test dokaz (API odgovor, UI rezultat, ili SQL proveru).
- Posle svake sesije kratka beleška: sta je uradjeno, sta je rizik, sta je sledece.

## 2. Mentorski ciklus (ponavlja se)

1. Razumevanje: procitaj deo koda koji radimo.
2. Dijagnostika: sta je trenutno pogresno ili rizicno.
3. Ispravka: minimalna izmena sa jasnim razlogom.
4. Verifikacija: test + rezultat.
5. Dokumentacija: upis u docs/refactor-docs/REFACTORING_LOG.md.

## 3. Milestone-i

### M1 - Stabilizacija baze i SQL uskladjivanje

- Uskladiti backend rute sa realnom Aiven semom.
- Ne koristiti destruktivne skripte na aktivnoj bazi.
- Pripremiti bezbedan migrateDb.js.

### M2 - API konzistentnost

- Standardizovati shape odgovora.
- Srediti error poruke i status kodove.
- Dodati osnovnu validaciju ulaza (Joi).

### M3 - Frontend pouzdanost

- Stabilan rendering za sve kljucne rute.
- Ukloniti kriticne warninge koji mogu izazvati regresiju.
- Proveriti auth tok za admin i guest.

### M4 - Git + Deploy spremnost

- Branch strategija (feature -> PR -> merge).
- Pre-deploy checklist.
- Rollback plan.

## 4. Definicija "spremno za klijenta"

- Kriticni tokovi rade bez ručnih intervencija.
- Nema destruktivnih skripti u standardnom deploy putu.
- Imas kratku tehnicku dokumentaciju: arhitektura, env varijable, deploy koraci, rollback.

## 5. Sledeca mentorska sesija (Session 01)

Tema: SQL uskladjivanje ruta `admin`, `guest`, `cancel`, `public inquiries` sa trenutnom Aiven semom.

Cilj sesije:

- Detektovati sva neslaganja kolona.
- Ispraviti jednu grupu ruta end-to-end.
- Zabeleziti test rezultate i rizike.
