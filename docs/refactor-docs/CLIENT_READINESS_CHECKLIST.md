# Client Readiness Checklist

Koristi ovu listu pre nego sto projekat pokazes klijentu ili pustis u produkciju.

## A. Funkcionalnost
- [ ] Home ucitava hero, vesti i galeriju bez greske.
- [ ] Smestaj lista i detalj rade.
- [ ] Vesti lista i single vest rade.
- [ ] Admin login radi i cuva token.
- [ ] Guest login/dashboard radi.
- [ ] Upit i rezervacija tok rade.

## B. API i baza
- [ ] Sve backend rute koriste kolone koje postoje u Aiven bazi.
- [ ] Nema SQL gresaka u logu za glavne tokove.
- [ ] Status kodovi su smisleni (200/201/400/401/404/500).
- [ ] CORS radi za aktivni frontend origin.

## C. Bezbednost i operativa
- [ ] Nema hardcoded credentials u kodu.
- [ ] `.env` vrednosti su postavljene na Render/Netlify.
- [ ] `setupDb.js` se ne pokrece na aktivnoj produkcionoj bazi.
- [ ] Postoji backup/snapshot pre schema migracija.

## D. Git i release
- [ ] Sve izmene idu kroz feature branch.
- [ ] PR ima opis, test dokaze i rizike.
- [ ] Merge tek nakon smoke testa.
- [ ] Tag/release beleška postoji.

## E. Dokazi za klijenta
- [ ] Kratak demo scenario (3-5 min) napisan.
- [ ] Lista poznatih ogranicenja i plan popravki.
- [ ] Kontakt i procedure za hitne ispravke.
