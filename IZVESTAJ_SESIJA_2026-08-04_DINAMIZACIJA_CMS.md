# 📋 Izveštaj sesije: Dinamizacija sajta i CMS proširenje (04.08.2026)

Ovaj fajl je trag rada iz jedne duge sesije čiji je cilj bio prevesti sajt iz "našminkane" (delom hardkodovane) verzije u punu bazom-drivenu verziju gde admin panel kontroliše sav sadržaj, i otkloniti niz bagova otkrivenih usput. Sve izmene su na `main` grani, pushovane na GitHub — commit hash-evi ispod vode do tačnih diff-ova.

## 🎯 Polazna tačka

Sajt je već imao osnovni CMS (Странице, Вести, Особље, Пројекти, Резервације...), ali:
- Restoran, Vesti, Kontakt i Istraži Goč nisu imali hero sliku niti sadržaj povezan sa bazom
- Nije postojala CMS kontrola za hero karusel (Početna/Smeštaj) ni za galeriju na Početnoj
- Sadržaj je mestimično bio latinica umesto ćirilice (nedosledno sa ostatkom sajta)
- AI chat agent je za teme čitao iz statičkog JSON snapshot-a, ne iz baze

## ✅ Šta je urađeno (hronološki, po commit-ima)

### 1. `f660575` — hero_image za generičke CMS strane
- `pages` tabela dobila `hero_image` kolonu (ranije nije postojala, iako je kod već očekivao da postoji)
- Admin forma za Странице dobila upload polje za hero sliku
- Sanitizovane scratch skripte (`check_rest.js`, `scratch_check_db.js`, `scratch_fix_themes.js`) da čitaju kredencijale iz `.env` umesto hardkodovane Aiven lozinke u plain textu

### 2. `992f06f` — Restoran/Vesti/Kontakt/Istraži Goč postaju bazom-driveni
- Nove `pages` tabele: `restoran`, `vesti`, `kontakt`, `istrazi` (hero slika + sadržaj)
- Nova `site_settings` tabela (key-value, SR/EN) za footer i kontakt podatke — **napomena:** footer (adresa fakulteta) i Kontakt strana (fizička lokacija baze) su namerno različiti podaci, ne dele isti izvor
- Nova `staff_translations` tabela — pozicije osoblja se sada prevode na engleski
- Popravljen `getThemes`/`getThemeDetail` da poštuju traženi jezik (ranije uvek vraćali srpski)

### 3. `62bb9a5`, `f5650b3` — Hero karusel i galerija admin
- CRUD za `hero_slides` (Početna/Smeštaj karusel)
- **Otkriveno:** `/smestaj` stranica nikad nije čitala `hero_slides` iz baze — endpoint ih nije ni upitivao, karusel se uvek gradio iz naslovnih slika objekata. Povezano.
- Uređivanje slajdova **ugrađeno direktno u formu za Странице** (Почетна/Смештај) umesto posebnog CMS ekrana — korisnik je eksplicitno tražio ovu konsolidaciju
- Nova `project_translations` tabela (Projekti EN prevod)
- Novo: admin kontrola za naziv/opis/naslovnu sliku objekata (Уређивање соба) — ranije `updateFacility` nije postojao uopšte

### 4. `3883b22`, `4850512` — Sitna doslednost u adminu
- Facility `type` (`smestaj`) prikazivan sirovo u dropdown-u → mapiran na ćirilični label
- Dugme "Уреди цене" → "Уреди податке" (forma sad radi više od cena)

### 5. `aa74446` — Galerija soba
- Sobe su na frontendu imale lightbox galeriju (`media_gallery`, `entity_type='room'`) koja nikad nije imala admin UI. Dodato: naslovna slika sobe + dodavanje/brisanje slika u galeriji, sve u `/admin/sobe`

### 6. `f53493b` — Teme dobijaju pravi CMS + agent čita bazu uživo
- Nov admin ekran `/admin/teme` — pun CRUD (naziv/članak SR+EN, ikona, hero slika, ključne reči, redosled)
- **Značajna popravka:** `makeThemeFactsTurnIfAsked` (AI chat) je čitao isključivo `backend/data/goc-themes.json`, nikad `themes`/`theme_translations` tabele. Prebačeno na živ upit u bazu — potvrđeno testom da agent sada vidi izmene bez restarta/reseed-a
- `dc28ded` — uskladen i sam `goc-themes.json` sa ćiriličnim ispravkama (fajl ostaje kao seed/fallback referenca)

### 7. `470ac81` — Dva bag-a otkrivena kroz stvarnu upotrebu
- **Auth redirect trap:** istekao/nevažeći token je vraćao HTTP 403 umesto 401; frontend ga nikad nije brisao iz `localStorage`; router gard je zato beskonačno vraćao korisnika na `/admin/vesti` umesto na login formu. Popravljeno na oba kraja (backend status kod + frontend čisti token na 401)
- **Meni restorana:** `getRestaurantMenu` je spajao `restaurant_menu_item_translations` tabelu koja ne postoji (`restaurant_menu_items` već ima svoju `lang` kolonu). Upit ispravljen; usput vraćen pravi meni od **26 stavki** iz `piramida-meni.json` (bio je sveden na 3 demo artikla)

### 8. `b7e1c03` — Ikonice tema
- PNG ikonice tema imale punu belu pozadinu (ne providnu) → obrađene (Python/Pillow/numpy) da budu providne i tesno isečene oko sadržaja
- **Otkriveno:** ikonice/hero slike tema su postojale samo na frontend-u, admin CMS ih je tražio sa backend-a (404). Kopirane u `backend/public/`, dodata `/themes` static ruta

## 🗄️ Izmene direktno u bazi (NE prate se kroz git — ovo je jedini trag)

Baza je zajednička (Aiven MySQL) i za lokalni dev i za produkciju (Netlify + Render), pa su sve izmene ODMAH uživo:

- Ćirilična konverzija: `pages.content` (edukacija, istraživanje), `theme_translations.name/article` (4+ teme), `rooms.meal_info` (svih 31 soba), `attractions.name/description` (7 zapisa)
- Popunjen engleski prevod: `staff_translations`, `project_translations`, `theme_translations` (sve teme), `page_translations` (6 strana)
- Novi redovi: `pages` (restoran/vesti/kontakt/istrazi), `site_settings` (15 ključeva), `restaurant_menu_items` (26 stavki, zamenjeno 3 demo)
- Nove tabele: `site_settings`, `staff_translations`, `project_translations`

**Ako neko nastavi rad na drugoj mašini/branch-u:** ove izmene su već na živoj bazi, ne treba ih ponavljati. Kod (git) i baza (Aiven) su sada usklađeni.

## ⚠️ Poznata ograničenja / za kasnije

- **Attractions (planinarenje/vidikovci, ne-restoran tip)** — nema CMS UI, isti gap kao teme pre popravke. Menja se samo direktnim DB pristupom
- **`goc-themes.json`, `atractions.json`, `piramida-meni.json` i sl.** — istorijski seed fajlovi, više se ne čitaju u runtime-u (osim `goc-themes.json` kao mrtav fallback koji trenutno niko ne poziva)
- **`site_kb` (Qdrant)** — i dalje ručno održavana konfiguracija (`site-structure.json`, `features.json`); ne prati bazu automatski, treba ručno ažurirati + `seed-site-kb.js` ako se dodaju nove strane/funkcije
- **Weather widget** — gotov endpoint (`/api/weather/forecast`), nikad prikazan kao vidljiv UI element — namerno van obima ove sesije
- **Nav linkovi i logo u header-u** — namerno ostali van CMS-a (struktura sajta, ne sadržaj)

## 🔑 Pristup

- Admin panel: `/admin/login`, podrazumevani nalog `admin` / `admin123` (env `ADMIN_SEED_USERNAME`/`ADMIN_SEED_PASSWORD` ako je menjano)
- Nakon ručne izmene baze (mimo admin panela), obavezno očistiti keš (dugme "Очисти кеш" u adminu ili `POST /api/admin/system/purge-cache`) — javni GET endpoint-i keširaju 5 min

---
*Izveštaj sastavio: Claude (Claude Code) — sesija završena zbog pune kontekstualne memorije. Za nastavak, ovaj fajl + `git log` su glavni izvor istine o tome šta je urađeno.*
