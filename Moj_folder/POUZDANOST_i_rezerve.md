# Pouzdanost cloud servisa i rezervne opcije

Radna beleška za razgovor sa klijentom / IT. Nije SLA ugovor.

## Zašto uopšte više servisa?

| Sloj | Trenutno (tipično) | Uloga |
|------|-------------------|--------|
| Frontend | Netlify | Statički Vue SPA |
| API | Render | Express, CMS, rezervacije |
| Baza | Aiven MySQL | Istina o sadržaju i rezervacijama |
| Chat agent | Render (drugi servis) | AI razgovor |
| Vektori | Qdrant cloud | RAG znanje |
| Mejl | Brevo | Obaveštenja |
| AI API | Claude / Gemini / DeepL | Chat i prevod |

Prednost: pad **jednog** retko ruši **sve**.  
Mana: više tačaka koje treba pratiti; zato postoji prioritet šta je „kritično“.

## Prioritet funkcija

1. **P0 — mora raditi:** javni sajt (čitanje), CMS, baza, unos/pregled rezervacija  
2. **P1 — jako poželjno:** mejl obaveštenja  
3. **P2 — dodatak:** AI chat, DeepL dugme  

Ako budžet/vreme ograniče rezervne mere, prvo štitiš P0.

## Matrica: pad → efekat → rezerva

| Servis | Efekat pada | Trenutna / predložena rezerva | Tipično vreme oporavka* |
|--------|-------------|-------------------------------|-------------------------|
| Netlify (FE) | Sajt ne otvara | Drugi statički host; kasnije SFB/RCUB; DNS | sati |
| Render API | Nema API/CMS/rezervacija | Redeploy; drugi Node host; isti kod | sati |
| Aiven MySQL | Sve „prazno“ / greške | Dump restore; druga MySQL (fakultet/RCUB/cloud) | sati–dan |
| Chat agent | Nema chata | Sajt ostaje; forma rezervacije ručno; UI poruka | sati ili ostavi ugašeno |
| Qdrant | AI bez dobrog znanja | Keyword/fallback; ili AI off | sati |
| Claude | AI slabiji / nestaje | Gemini fallback (gde je urađen) | automatski / minuti |
| Gemini | Nestaje i fallback | AI off; sajt radi | — |
| Brevo | Nema mejla | Upit ostaje u CMS; fakultetski SMTP kasnije | sati–dani |
| DeepL | Nema auto-prevoda | Ručni EN u CMS | — |

\*Bez 24/7 dežurstva — zavisi od toga kad neko primeti i reaguje.

## Šta već podržava arhitektura projekta

- **Glas vs ruke:** agent ne piše direktno u MySQL; rezervacija ide preko sajta → pad agenta ≠ gubitak rezervacionog toka.  
- **Graceful degradation AI:** sajt i CMS su zamišljeni da rade i kad AI nije dostupan.  
- **First deploy snapshot:** poznata tačka za restore sadržaja.  
- **Odvojeni repo agenta:** agent se može gasiti / menjati host bez redeploy celog sajta.

## Realne rezervne opcije (za dogovor, ne sve odjednom)

### Jeftino / odmah (preporuka u ponudi)
- [ ] Redovan dump baze (npr. nedeljno) + čuvanje upload foldera  
- [ ] First-deploy snapshot  
- [ ] Jasna poruka u chatu kad agent ne radi („koristite formu / kontakt“)  
- [ ] Lista status URL-ova (Netlify, Render, Aiven) za brzu proveru  

### Srednji nivo (održavanje / aneks)
- [ ] Drugi cloud nalog spreman za FE ili API (isti artifact)  
- [ ] Fakultetski SMTP kao rezervni mejl  
- [ ] Poddomen `*.sfb.bg.ac.rs` kao stabilna adresa (CNAME) čak i dok backend ostane cloud  

### Skupo / kasnije (obično ne treba fakultetu od dana 1)
- Automatski failover više regiona  
- Hot standby baza  
- 24/7 monitoring sa SMS dežurstvom  

## Pitanja za IT / klijenta (pouzdanost)

1. Da li fakultet/RCUB nudi **backup** i restore za hosting koji bi eventualno koristili?  
2. Da li sme **spoljni cloud** kao primarni ili samo kao privremeni sloj do prelaska?  
3. Ko je **kontakt u nuždi** (ti / IT fakulteta / RCUB helpdesk) ako sajt padne u petak uveče?  
4. Da li je prihvatljivo da **AI bude ugašen** dok traje incident, a rezervacije idu preko forme?  
5. Gde čuvati **kopije dump-ova** (van produkcionog servera)?  

## Jedna rečenica za klijenta

> Sajt i rezervacije su kritični i štite se backup-om i mogućnošću premštanja; AI chat je koristan dodatak koji sme privremeno da ne radi bez gašenja cele platforme.
