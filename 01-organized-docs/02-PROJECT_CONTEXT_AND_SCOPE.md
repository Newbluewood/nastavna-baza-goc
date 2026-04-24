# Project Context and Scope

# Project Context And Scope

## Infrastruktura

- Baza: Aiven MySQL
- Backend: Render
- Frontend: Netlify
- Mail servis: Brevo

## Potvrdjene poslovne funkcionalnosti

- Cancel rezervacije je dozvoljen samo ako postoji najmanje 7 dana do check-in datuma.
- Kod slanja inquiry zahteva:
  - ako gost ne postoji, sistem automatski kreira guest nalog
  - gost dobija obavestenje o prijemu upita
  - gost dobija podatke za logovanje na nalog
- Admin panel:
  - menja status upita (approve/reject/cancel)
  - dodeljuje vaučere gostu
- Guest panel:
  - pregled rezervacija i statusa
  - izmena lozinke
  - email notifikacije za approve/reject tok
- Voucher mehanika je namerno vezana za sajt interakciju (bez slanja vaučera emailom) radi vecih povratnih poseta.
- UX smer: dodatni predlozi obilazaka/aktivnosti na Gocu kao deo user care iskustva.

## Operativna odluka za trenutnu fazu

- Do feature zavrsetka i merge-a u main:
  - ne raditi hard reset produkcione/aktivne baze
  - fokus je na doradi koda i funkcionalnosti
- U release fazi:
  - uraditi hard reset baze
  - zatim inicijalno punjenje mock/prezentacionih podataka po potrebi

## Napomena o domenu smestaja

- Pilana nije smestajni objekat.
- U prezentacionim seed podacima koristiti samo objekte tipa smestaj.

## Backlog napomena (i18n audit)

- U kasnijoj fazi uraditi audit prikaza po jeziku (`sr`/`en`) da se pronadju delovi template-a ili sadrzaja koji ostaju neprevedeni ili meshaju jezike.
- Posebno proveriti: hero sekcije, staticki tekstovi, fallback poruke, admin forme i email template varijante.
