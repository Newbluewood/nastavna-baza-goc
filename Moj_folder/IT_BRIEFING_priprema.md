# IT briefing — priprema za razgovor (SFB / RCUB / Univerzitet)

Živi dokument: prolazimo teme **jednu po jednu**. Posle svake teme ovde ostaje kratak sažetak + pitanje koje ćeš postaviti.

**Van ovog brifa:** chat-agent hardening / XSS / DB least-privilege → [`DEPLOY_PUT_naznake.md`](DEPLOY_PUT_naznake.md) (put ka deployu, ne za IT sastanak).

**Cilj:** jedan kompletan set pitanja, bez dopisivanja „svakih 5 minuta“ posle sastanka.  
**Kontekst spoja:** `sfb.bg.ac.rs` je sada WordPress na spoljnjem hostu (LeaseWeb); DNS delom RCUB; `nastavnabazagoc.sfb.bg.ac.rs` još ne postoji. RCUB javno nudi hosting tipa Joomla/SQL/SSH — ne obećava Node/Docker.

**Tri scenarija (ne forsirati odmah):**
1. Full on-prem — FE+API(+agent)+MySQL kod njih; AI ključevi i dalje spolja  
2. Hibrid — FE+API±MySQL kod njih; agent/Qdrant/AI/mejl cloud  
3. Samo DNS/CNAME — `*.sfb.bg.ac.rs` → postojeći Netlify/Render  

---

## Status prolaska

| # | Tema | Status |
|---|------|--------|
| 1 | Šta server može da pokrene (HTML/PHP/Node/Docker) | **gotovo** |
| 2 | Statički FE / reverse proxy / SPA fallback | **gotovo** (SPA ostaje ~90% odluka) |
| 3 | Node API kao dugovečni proces | **gotovo** |
| 4 | Chat-agent + SSE | **gotovo** (fraza za IT: SSE / streaming HTTPS, NE WebSocket) |
| 5 | MySQL/MariaDB | **gotovo** (API+agent+ingest trebaju DB; allowlist ako baza kod njih) |
| 6 | Disk za upload | **gotovo** |
| 7 | HTTPS i DNS poddomena | **gotovo** (koraci CNAME→Netlify→LE HTTPS upisani) |
| 8 | Outbound HTTPS | **gotovo** (tabela inventara upisana) |
| 9 | Email (SMTP vs Brevo) | **gotovo** |
| 10 | Qdrant | **gotovo** |
| 11 | Pristup i održavanje | **gotovo** |
| 12 | Ograničenja (CPU/RAM/firewall/GDPR) | **gotovo** |

---

## Tema 1 — Šta server uopšte može da pokrene

### Zašto se ovo pita
Odgovor određuje da li tvoj **Express API** i **chat-agent** uopšte mogu da žive „kod njih“, ili samo statički frontend / samo DNS.

### Šta znače opcije (tvoj jezik)

| Kažu… | U praksi | Tvoj projekat |
|-------|----------|---------------|
| **Samo statički HTML/CSS/JS** | Upload fajlova, nema server-programa | Može samo **Vue build** (folder `dist`). API mora ostati spolja (Render) |
| **PHP** (Apache/Nginx + PHP) | Klasičan fakultetski/RCUB hosting, WP/Joomla | Tvoj backend **nije PHP** — API ne staje ovde bez velikog prepisivanja |
| **Node.js** | Mogu da pokrenu `node server.js` kao servis | **API može kod njih** (uz PM2/systemd — tema 3) |
| **Docker** | Kontejneri po specifikaciji | Najfleksibilnije: API + agent + opciono Qdrant u compose-u |
| **Mešavina** | npr. samo statički + PHP, Node „po dogovoru“ | Često vodi na **hibrid** ili **samo CNAME** |

### Šta je dobar / loš odgovor
- **Dobar:** jasno „imamo Node X“ ili „samo PHP/statički“ ili „Docker na zahtev“ + ko odobrava.  
- **Loš/nejasan:** „stavite sajt pa vidimo“ bez navođenja runtime-a.  
- **Upisati u belešku:** tačan runtime + verzija ako znaju (npr. Node 20) + da li je RCUB, fakultetski server, ili opet spoljni VPS.

### Pitanje koje postavljaš (kopiraj)
> Za poddomen tipa `nastavnabazagoc.sfb.bg.ac.rs`: da li hosting podržava samo statičke fajlove, PHP, Node.js kao dugovečni proces, i/ili Docker? Da li je to RCUB web hosting, server fakulteta, ili spoljni VPS? Koja je dozvoljena verzija runtimes-a?

### Tvoji odgovori od IT-a (popuni posle)
- Runtime: _______________  
- Gde hostuju: RCUB / fakultet / VPS / drugo: _______________  
- Napomena: _______________  

### Sažetak razgovora (Cursor + ti)
*(dopunjava se dok prolazimo)*

- **2026-11-08:** Krenuli Tema 1. Bitno: bez Node/Docker kod njih → API ostaje cloud; kod njih najviše statički FE ili samo DNS. RCUB javni opis = Joomla/SQL, ne Node.
- **2026-11-08 (dopuna):** Objašnjen Docker + rupa backend-a. Zaključak: prepis Express→Python **ne pokriva sve scenarije**; rupa nije „jezik“ nego **da li sme dugovečni proces** (Node ili Python ili Docker). `dist` pokriva samo frontend. Baza dump pokriva šemu/podatke, ne API.
- **2026-11-08 (šta insistirati):** Skripta ispod — redosled: 1) opiši slojeve, 2) pitaj runtime, 3) ako samo PHP → prvo hibrid/CNAME (ne prepis), Docker kao opcija ako žele više on-prem, 4) agent+Qdrant+ključevi spolja/env.

### Šta da insistiraš (redosled na sastanku)

**Ne insistiraj odmah na Docker-u kao jedinom rešenju.** Insistiraj na jasnom odgovoru: *šta sme da radi non-stop na hostu za ovaj poddomen.*

1. **Opis aplikacije** (tvoj tekst, učišćen)  
2. **Pitanje:** statički / PHP / Node / Docker?  
3. **Ako samo PHP/statički** → predloži **hibrid ili samo DNS** (API + agent na cloud). To je najbrže i najjeftinije za njih.  
4. **Ako žele sve „kod vas“** → onda Node *ili* Docker (Docker = kutija da ne namećeš njihovom adminu ručni Node).  
5. **Nikad kao prvi predlog:** prepis celog Express-a u PHP/Python zbog hostinga.

### Skripta koju možeš reći (približno)

> Struktura aplikacije ima nekoliko slojeva.  
>  
> **1. Frontend** — Vue 3. Ako ne možete Node build na serveru, ja isporučujem gotov **`dist`**. First deploy čuvamo kao backup; uvek mogu dati novi `dist`.  
>  
> **2. Backend** — Express (Node.js). To je motor: CMS, rezervacije, mejl okidači, API za frontend. To nije PHP fajl za upload — treba **dugovečni proces** ili kontejner.  
>  
> **3. Chat agent** — poseban mikroservis. Može ostati na cloud-u ako vam to odgovara; sajt radi i bez njega.  
>  
> **4. MySQL** — baza sadržaja i rezervacija (kod vas ili cloud).  
>  
> **5. Tajne (API ključevi)** — nisu u kodu; trebaju **env / secret** na hostu (ili cloud dashboard).  
>  
> **6. Mejl, vektorska baza (Qdrant), AI** — spoljni servisi preko HTTPS.  
>  
> Pitam: za `nastavnabazagoc.sfb.bg.ac.rs` šta možete — samo statički, PHP, Node, Docker?  
>  
> **Ako imate samo PHP:** predlažem da poddomen pokazuje na naš cloud (ili kod vas samo `dist`), a backend + agent ostanu cloud dok ne bude Node/Docker.  
> **Ako želite više lokalno:** jedan Docker (ili Node+PM2) za API; agent po potrebi i dalje cloud.

### Ako kažu „samo PHP“ — šta predlažeš (redom)

| Prioritet | Predlog | Zašto |
|-----------|---------|--------|
| **1 (najbolji start)** | Poddomen CNAME → Netlify; API+agent na Render; baza Aiven (ili MySQL kod njih remote) | Minimalan napor IT-a; radi odmah |
| **2** | Kod njih samo `dist` (Nginx); API i dalje Render | Fakultetski URL za sajt, motor spolja |
| **3** | Docker/Node kod njih za API | Samo ako žele on-prem i imaju ko da održava |
| **Ne** | Prepis u PHP | Meseci rada, gubiš postojeći CMS/API |

### Šta je najbezbednije **za njihov server**?

IT često misli „sve kod nas = bezbednije“. Za **napadnu površinu njihovog servera** obrnuto važi:

| Opcija | Rizik po *njihov* server | Napomena |
|--------|--------------------------|----------|
| **Samo DNS/CNAME** (sve na cloud) | **Najniži** | Kod njih skoro ništa ne radi; drže samo DNS/poddomen. Nema tvojih procesa, uploada, API ključeva na njihovoj mašini |
| **Samo `dist` kod njih** | Nizak | Statički fajlovi; mali napadni profil. Motor i dalje spolja |
| **API (Node/Docker) kod njih** | Srednji–visok | Dugovečni proces, `.env` tajne, upload folder, rupe u app-u = njihov host |
| **API + agent + Qdrant kod njih** | **Najviši** | Više procesa + AI ključevi na njihovoj mreži |

**Rečenica za njih:**  
> Ako vam je prioritet da ne širite napadnu površinu na univerzitetskim serverima, najbezbednije je da `nastavnabazagoc.sfb.bg.ac.rs` samo pokazuje (DNS) na već izolovan cloud, a da kod vas ne živi Node ni API ključevi.

**Drugo pitanje (GDPR / podaci):** gde smeju stajati podaci gostiju (ime, email, rezervacije)? To je *lokalitet podataka*, ne isto što i „bezbednost web servera“. Ako traže podatke u akademskoj mreži → MySQL kod njih (ili RCUB), a FE/API i dalje mogu hibrid.

- **2026-11-08:** Za njihov server najbezbednije = CNAME/samo DNS ili samo statički `dist`; pun on-prem API/agent = najveći rizik po njihov host.
- **2026-11-08:** Granica održavanja + ko drži cloud naloge — vidi odeljak ispod.

### Ko drži pristupe (cloud instance) i granica održavanja

**Preporuka za tvoj model (povlašćena cena, ti kao autor):**  
Ti držiš **vlasništvo** Netlify / Render / Aiven / Qdrant / Brevo / AI ključeva. IT fakulteta drži **DNS poddomen** (i eventualno njihov server ako ikad nešto hostuju).

| Pristup | Ko | Zašto |
|---------|-----|--------|
| DNS `nastavnabazagoc.sfb.bg.ac.rs` | **IT** | Njihov domen; bezbednost + institucionalna kontrola |
| Netlify, Render (API), Render (agent) | **Ti** (vlasnik) | Ti deploy-uješ, vidiš logove, plaćaš/pratish plan |
| Aiven / MySQL | **Ti** (ili zajednički read-only kasnije) | Backup, migracije, restore |
| Qdrant, Brevo, Anthropic/Gemini, DeepL | **Ti** | Ključevi, budžet, rotacija |
| CMS nalozi na sajtu | **Klijent** (admin) + ti kao super-admin po potrebi | Sadržaj menjaju oni |
| „Dajte IT-u sve instance“ | **Ne na početku** | Mešaju se odgovornosti; rizik da neko restartuje/briše bez tebe; GDPR/billing nejasni |

**Ako baš traže uvid:** read-only / member uloga na jednom dashboardu, ili mesečni status — ne full owner svima.

**Granica održavanja (jasno reci klijentu):**

| Tip | Primer | Ko reaguje |
|-----|--------|------------|
| **Sadržaj** | Pogrešan tekst, obrisana vest, cena sobe | Klijent preko CMS-a |
| **Softver / app** | Bug u rezervaciji, CMS greška, deploy nove verzije | **Ti** (uključeno 30 dana / pa održavanje) |
| **Infrastruktura cloud** | Render sleep/pad, istek kartice, Aiven down | **Ti** (pratish) + status page provajdera |
| **DNS / fakultetski domen** | Poddomen ne pokazuje, cert na njihovoj strani | **IT** |
| **Korisničke lozinke CMS** | Zaboravljena lozinka | Ti ili procedura reset |
| **AI potrošnja / ključ** | Chat ugašen zbog budžeta | Ti + dogovor sa klijentom o cap-u |

### Šta može da „crkne“ — očekivane intervencije

| Simptom | Verovatni sloj | Prva provera | Ko |
|---------|----------------|--------------|-----|
| Sajt se ne otvara na `*.sfb.bg.ac.rs` | DNS / Netlify | Da li otvara netlify.app URL? Ako da → DNS/IT. Ako ne → Netlify/deploy | IT vs ti |
| Sajt otvara, prazno / greške podataka | API ili MySQL | Render API health; Aiven status; CORS/`VITE_API` | Ti |
| CMS login ne radi | API / JWT / env | Render env, `JWT_SECRET`, logovi | Ti |
| Rezervacija ne šalje mejl | Brevo / SMTP | Upit ipak u CMS? Ako da → samo mejl | Ti |
| Chat ne radi, ostatak radi | Agent / LLM / Qdrant | Agent URL, ključevi, budžet | Ti (nije hitno kao P0) |
| Slike nestale | Disk upload / putanje | `/uploads` na API hostu | Ti |
| Spor ili 502 | Render cold start / pad | Redeploy, logovi | Ti |
| „Neko je obrisao sadržaj“ | CMS korisnik | Restore sa first-deploy / dump | Ti + dogovor |

**Očekivanje (realno, bez 24/7):**  
P0 (sajt/CMS/baza) — reaguješ u radnom vremenu (npr. isti / sledeći radni dan).  
P2 (chat) — može sačekati.  
IT — samo kad je DNS/njihov server.

**Jedna rečenica za klijenta:**  
> Ja održavam aplikaciju i cloud servise; IT drži fakultetski DNS; vi u CMS-u držite sadržaj. Ako sajt ne radi na vašem domenu a radi na privremenom URL-u — to je IT; ako ne radi ni tamo — to sam ja.

**Veza sa ponudom:** ako ti držiš instance + softver → mora postojati **naplaćeno održavanje** (u okvirnoj ponudi 80–150 €/mes) ili eksplicitno „bez paušala = samo 30 dana ispravki grešaka, posle satnica“. Cloud računi (Render/Aiven/AI) i dalje **odvojeni** od tvoje naknade za rad.

### Vlasništvo vs „iznajmljivanje“ — praksa za ugovor

Ako su **svi cloud nalozi na tvoje ime**, operativno deluje kao da im **hostuješ** app. To nije greška, ali ugovor mora da kaže šta je čije i šta kad prestaneš.

| Model | Šta znači | Kad ima smisla |
|-------|-----------|----------------|
| **A. Predaja / work-for-hire** | Kod + pravo korišćenja su **klijentovi**. Ti razviješ, održavaš po ugovoru. Na kraju (ili od starta) nalozi/repos pređu na njih; ti ostaješ admin po potrebi | Fakultet/javna ustanova — žele da „imaju“ sistem |
| **B. Hostovani servis (kao zakup)** | Ti držiš infra; oni plaćaju mesečno za rad + hosting. Prestankom ugovora: export podataka + gasenje ili plaćena predaja | Ako baš hoćeš SaaS model |
| **C. Hibrid (česta praksa za freelancere)** | **IP/kod** klijentov (GitHub org fakulteta ili tvoj repo sa licencom „za klijenta“); **billing cloud** na klijenta čim može; **ti** održavaš uz paušal. Exit klauzula: predaja pristupa u N dana | **Preporuka za tebe + SFB** |

**Šta uraditi u praksi (da ne izgleda kao večiti zakup):**
1. U ugovoru: *softver razvijen za NB Goč / fakultet; pravo korišćenja i izvorni kod pripadaju naručiocu posle isplate (ili po aneksu).*  
2. Cloud računi idealno **na fakultet** (kartica/potraživanje), ti kao tehnički admin — onda nije „tvoja app na tvojoj kartici“.  
3. Dok je na tvom nalogu: u ugovoru piše *privremeno hostovanje u tvoje ime uz mesečno održavanje; podaci su klijentovi; na zahtev predaja u roku od X dana.*  
4. **Exit paket** (naplati jednokratno npr. 1× mesečni paušal ili fiksno): transfer Render/Netlify/Aiven, lista env (bez slanja tajni mejlom), dump baze, uputstvo, obuka 1h.  
5. **Ne** „evo lozinke pa snalazite se“ bez dokumentacije — ni fer ni bezbedno.

**Posle ugovora / prestanka održavanja — opcije:**
- predaja svega + oni (ili drugi firmware) održavaju;  
- ili nastave da te plaćaju;  
- ili eksport podataka i gasenje hosta (ako neće predaju / ne plaćaju) — mora pisati u ugovoru da nema iznenađenja.

- **2026-11-08:** Vlasništvo: preporuka model C (kod/IP klijent, billing što pre na njih, ti admin + paušal, exit predaja). Ne mešati „držim instance zbog održavanja“ sa „app je zauvek moja“.
- **2026-11-08:** **Radna preferenca za komunikaciju:** start **CNAME** (najjednostavnije za tebe i IT). Kasniji prelazak na njihov server ili dublji hibrid = poseban korak kad zatraže. Klijent (nastavna baza) ne mora da razume CNAME/Render — očekuje: sajt radi + poštovanje pravila fakulteta/zakona; tehniku vodiš ti + IT.

### Kako komunicirati (dva jezika)

**Klijentu (NB / fakultetski naručilac):**  
> Sajt će biti na adresi fakulteta. Tehnički hosting i održavanje softvera dogovaramo sa IT-om tako da sajt radi stabilno i u skladu sa pravilima ustanove. Vi u CMS-u vodite sadržaj; mi brinemo da sistem radi. Ako jednog dana želite sve potpuno „u kući“, to je posebna faza.

**IT-u:**  
> Predlog A (start): CNAME `nastavnabazagoc.sfb.bg.ac.rs` → postojeći FE; API + agent cloud. Minimalan rizik po vaš server.  
> Predlog B (kasnije): hibrid ili on-prem ako vi to zahtevate / odobrite runtime.

Ne forsirati Docker/Node kod njih na prvom sastanku ako CNAME prolazi.

### Gde se čuvaju API ključevi (reci im jasno)

- **Ne** u GitHub-u, **ne** u `dist`, **ne** u Word fajlu.  
- Na cloud-u: env vars (Render/Netlify).  
- Kod njih: env fajl van web root-a ili secrets koje postavi admin; ti kažeš *imena* promenljivih, oni (ili ti preko SSH) upišu *vrednosti*.  
- Lista tipičnih: `JWT_SECRET`, `DATABASE_URL`, `BREVO_*`, `DEEPL_*`, `ANTHROPIC_*` / `GEMINI_*`, `QDRANT_*`, `VITE_API_BASE_URL` (FE build-time).

### Mini-rečnik (za Temu 1 + scenarije)

**`dist` folder**  
Gotov frontend (HTML/CSS/JS). Host ga samo „servira kao fajlove“. Bez backend procesa: nema CMS logina, rezervacija, mejlova iz tvog API-ja.

**Docker (jednostavno)**  
Kutija: unutra je tvoja app + tačan runtime (npr. Node 20) + zavisnosti. IT ne mora da instalira „isti Node kao kod tebe“ — pokrene kontejner.  
Docker **nije** zamena za dozvolu da nešto radi non-stop; samo olakšava *kako* se to pokreće.

**Rupa = backend**  
Nešto mora stalno da sluša port (Express), čita `.env`, priča sa MySQL, šalje mejl, prima upload.

**CNAME (DNS zapis)**  
Nalog u DNS-u: „ime A pokazuje na ime B“. Primer: `nastavnabazagoc.sfb.bg.ac.rs` → `nesto.netlify.app`. Korisnik vidi fakultetski URL; server i dalje može biti Netlify. IT samo podesi DNS, ne mora da hostuje kod.

**Samo DNS / CNAME scenario**  
Kod fakulteta: skoro ništa osim DNS. Ceo sajt+API+agent na cloud. Najmanja napadna površina po njihov server.

**Hibrid**  
Deo kod njih, deo spolja. Tipično: poddomen/FE kod njih ili CNAME, a **API + agent + (često) AI** na cloud. Ili: samo `dist` na njihovom Nginxu, API na Renderu.

**Dugovečni HTTP (long-running process)**  
Program koji **ne prestaje** kad jedan browser završi zahtev — non-stop sluša port (npr. `:3000`). Express/PM2/Docker. Suprotno od klasičnog PHP-a: tamo Apache pokrene skriptu, odgovori, proces nestane.

**Reverse proxy**  
„Vrata“ ispred (Nginx/Apache/Caddy): prima `https://domen/...`, prosleđuje unutra na `http://127.0.0.1:3000`. Drži HTTPS cert; tvoj Node ne mora da bude direktno na internetu na 443.

**env (environment variables)**  
Tajne i podešavanja **van koda**: `DATABASE_URL`, `JWT_SECRET`, `BREVO_API_KEY`… Na Renderu = dashboard; na serveru = fajl van public foldera ili systemd. Nikad u `dist` ni u Gitu.

**disk (za upload)**  
Trajni prostor gde CMS čuva slike (`/uploads`). Mora da preživi restart; treba kvota i backup. Free Render bez diska = upload može nestati posle redeploy.

**Prepis u Python?**  
Ne rešava „samo PHP“ hosting. Rupa je dugovečni proces + proxy + env + disk, ne jezik.

- **2026-11-08:** Pojmovi CNAME, hibrid, samo DNS, dugovečni HTTP, reverse proxy, env, disk — objašnjeni korisniku; upisani ovde.
- **2026-11-08:** Razjašnjeno: šema Nginx→Express je **on-prem**; kod **samo CNAME** fakultet nema Nginx — proxy je unutar Netlify/Render, Express dugovečni živi na Renderu.

### Dve šeme (ne mešati)

**A) Samo CNAME (ono što najčešće predlažeš IT-u)** — kod fakulteta NEMA Nginx ni Express:

```text
Browser
  → DNS CNAME  nastavnabazagoc.sfb.bg.ac.rs  →  Netlify
  → (stranica zove API)  api-xxx.onrender.com  →  Render proxy  →  tvoj Express (dugovečni)
  → (chat)  agent-xxx.onrender.com  →  drugi Express
```

Fakultet: samo DNS. Nginx/proxy + disk + env: **na Render/Netlify** (ti ih vidiš kao dashboard, ne kao „instaliraj Nginx“).

**B) API kod njih** — tek tu ulaze Nginx + dugovečni Express na njihovoj mašini:

```text
Browser → DNS → njihov Nginx (HTTPS) → Express :3000 → env + disk + MySQL
```

---

## Tema 2 — Statički frontend / SPA fallback / kako `dist` ide na poddomen

### Zašto se ovo pita
Vue 3 nije „jedan `index.html` sa linkovima“. Posle `npm run build` dobiješ **`dist/`** (statički fajlovi). Router koristi putanje tipa `/admin/login`, `/smestaj/...`. Ako server za nepoznat fajl vrati 404 umesto `index.html`, **osvežavanje stranice puca**.

### Tri načina da `dist` živi na `nastavnabazagoc.sfb.bg.ac.rs`

| Način | Šta radiš ti | Šta radi IT | SPA fallback |
|-------|----------------|-------------|--------------|
| **A) CNAME → Netlify** | Push/`dist` na Netlify; imaš `_redirects` / SPA pravilo | Samo DNS CNAME | Netlify već rešava (`/* → /index.html`) |
| **B) CNAME → Vercel** | Isto, FE na Vercel | Samo DNS | Vercel rewrite za SPA |
| **C) Upload `dist` kod njih** | Daješ zip/`dist` | Nginx/Apache serviše folder | **Mora** pravilo: nepostojeći path → `index.html` |

Kod A/B ti **ne** podešavaš njihov Nginx. Kod C — moraš im dati gotov snippet.

### Šta je SPA fallback (jednostavno)
Korisnik otvori `/admin/login` ili refresh na `/smestaj/123`:
- **Bez fallbacka:** server traži folder `/admin/login` na disku → **404**
- **Sa fallbackom:** „nema tog fajla? vrati `index.html`, Vue router će snimiti putanju“ → **radi**

Na Netlify u projektu tipično: `public/_redirects` sa `/*    /index.html   200`.

### FE i dalje zove API
`dist` je samo školjka. U build-u su urađeni URL-ovi (`VITE_API_BASE_URL`, `VITE_CHAT_API_URL`).  
Poddomen fakulteta ≠ API automatski na istom serveru — browser zove Render (ili drugi API host), osim ako IT ne napravi i `api.` poddomen (to je već tema 3 / hibrid).

### Pitanje koje postavljaš
> Za frontend na `nastavnabazagoc.sfb.bg.ac.rs`: da li preferirate **CNAME** na naš postojeći FE host (Netlify/Vercel), ili upload statičkog `dist` kod vas? Ako kod vas — da li možete SPA fallback (svi nepostojeći path-ovi → `index.html`)?

### Dobar / loš odgovor
- **Dobar:** „CNAME na Netlify“ ili „dajte `dist` + evo Nginx config sa try_files“  
- **Loš:** „stavite fajlove u public_html“ bez pomena fallbacka / bez HTTPS  

### Tvoji odgovori od IT-a
- FE način: CNAME / upload dist: _______________  
- SPA fallback potvrđen: da / ne  
- Napomena: _______________  

### Sažetak razgovora
- **2026-11-08:** Tema 2 otvorena. Ključ: `dist` + SPA fallback; CNAME najmanje posla za IT; API URL odvojen od FE domena.
- **2026-11-08:** Odluka za plan: **ne refaktorisati na SSR** sada. SPA + `dist` bolje sedi uz fakultetski hosting (CNAME/statički), postojeći Netlify, cenu i rok. SSR (npr. Nuxt) tek ako kasnije eksplicitno zatreba SEO/marketing van onoga što SPA + meta već pokrivaju — i to kao poseban projekat, ne uslov za go-live.
- **2026-11-08:** CMS dashboard (prijave smeštaja, struktura, upotreba sajta) **ne zahteva SSR** — brojevi iz MySQL (inquiries/rezervacije) + opciono lagani pageview događaji; isti obrazac kao `/admin/ai` usage. SSR ≠ analitika.

### Nginx primer (samo ako upload kod njih — ne učiti napamet)

```nginx
server {
  server_name nastavnabazagoc.sfb.bg.ac.rs;
  root /var/www/nastavnabazagoc/dist;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

`try_files … /index.html` = SPA fallback.

---

## Tema 3 — Node API kao dugovečni proces (PM2 / systemd / port / env)

### Zašto se ovo pita
Express **nije** „ubaci fajl u `public_html`“. Mora da **radi non-stop**, restartuje se posle pada/reboot-a, čita tajne iz **env**, sluša **port** iza proxy-ja. Bez toga nema CMS ni rezervacija na tom hostu.

### Kod „samo CNAME“ — šta ti treba od IT-a ovde?
**Skoro ništa.** API ostaje na Renderu: oni već drže dugovečni proces, proxy, env dashboard.  
Ovu temu **detaljno** otvaraš samo ako žele API **kod njih**.

### Ako API ide kod njih — šta znači svaki pojam

| Pojam | Jednostavno | Zašto bitan |
|-------|-------------|-------------|
| **Port** | Broj na koji Express sluša, npr. `3000` | Nginx (proxy) šalje saobraćaj na taj port; nije 80/443 direktno na Node |
| **env** | Tajne van koda (`DATABASE_URL`, `JWT_SECRET`, Brevo…) | Bez ovoga app ne sme u produkciju; IT/ti upisuju vrednosti |
| **PM2** | Mali „čuvar“ Node procesa: start, restart ako crkne, logovi | Često na VPS-u |
| **systemd** | Isto čuvanje, ali ugrađeno u Linux (`.service` fajl) | Često preferira fakultetski/RCUB admin |
| **Docker** | Kutija koja već sadrži Node+app; restart politiku drži Docker/compose | Alternativa PM2/systemd |

Ti ne moraš da biraš PM2 vs systemd na sastanku — pitaš: *„Kako kod vas držite dugovečne Node (ili Docker) servise?“*

### Šta Express radi non-stop (motor)
- CMS API + auth (JWT)
- rezervacije / gosti / upload
- mejl okidači
- (opciono) neki AI endpointi na sajtu — chat agent je **poseban** proces (Tema 4)

### Pitanje koje postavljaš
> Ako bi backend (Express/Node) išao kod vas: kako pokrećete dugovečne servise (systemd, PM2, Docker)? Ko postavlja env tajne? Koji portovi su dozvoljeni iza reverse proxy-ja? Ko restartuje posle pada ili deploy-a?

Ako kažu da Node/Docker **ne može**:
> U redu — API ostaje na cloud (Render); vi držite DNS/FE. To je naš hibrid / CNAME scenario.

### Dobar / loš odgovor
- **Dobar:** „Imamo Docker/systemd, evo ko je kontakt za env i deploy“ / „Ne podržavamo Node — ostanite cloud“  
- **Loš:** „Samo FTP upload JS fajlova“ kao da je to backend  

### Tvoji odgovori od IT-a
- API lokacija: cloud / kod njih: _______________  
- Process manager: systemd / PM2 / Docker / n/a: _______________  
- Ko drži env: _______________  
- Napomena: _______________  

### Sažetak razgovora
- **2026-11-08:** Tema 3. Kod CNAME ovo skoro ne dira IT. Kod on-prem API: port + env + PM2/systemd/Docker. Nema Node → API ostaje Render.
- **2026-11-08:** Objašnjen „čuvar“: bez njega `node server.js` umire kad zatvoriš SSH ili padne app / nestane struje. PM2 = Node-čuvar; systemd = Linux-čuvar; Docker = kutija + restart politika. Render to radi umesto tebe.

---

## Tema 4 — Chat-agent + SSE (timeout, drugi port/path)

### Zašto se ovo pita
Chat nije običan „jedan JSON odgovor“. Browser otvara **SSE stream** (`/api/chat/stream`): server šalje delove teksta dok AI misli. Proxy koji **prekinе** dugu vezu = chat „puca“ usred rečenice.

Agent je **poseban** dugovečni Node servis (drugi repo), ne mora na istom serveru kao CMS API.

### Kod „samo CNAME / agent na Renderu“ (preporuka)
IT skoro **ne dira** ovo. Agent ostaje `chat-agent-….onrender.com`; FE zove taj URL.  
Njima samo kažeš: *chat je spoljni mikroservis; sajt radi i kad je chat ugašen.*

### Ako agent ide kod njih — na šta paziti

| Tema | Značenje | Rizik |
|------|----------|--------|
| **SSE** | Jedan dugi HTTP odgovor, chunk po chunk (nije baš WebSocket, sličan „živi“ osećaj) | Proxy buffer/timeout prekine stream |
| **Proxy timeout** | Nginx `proxy_read_timeout` itd. | Podrazumevano ponekad 60s — AI često treba duže |
| **Drugi port ili path** | npr. `:3001` ili `https://domen/agent/` → proxy na agent | Ne mešati sa glavnim API-jem bez pravila |
| **Čuvar** | Isti kao Tema 3 (systemd/PM2/Docker) | Drugi proces = drugi čuvar |

WebSocket obično **ne** moraš da tražiš za ovaj projekat — koristite **SSE**. Ako IT kaže „imamo samo kratke PHP requeste“ → agent ostaje cloud.

### Pitanje koje postavljaš
> Chat agent je odvojen servis sa **Server-Sent Events (SSE) / streaming HTTPS** (nije WebSocket). Predlažemo da ostane na cloud-u. Ako baš kod vas: podržavate duge SSE veze (duži proxy timeout), i da li drugi port ili path iza reverse proxy-ja?

### Zlatna fraza za IT (sačuvati)
> Koristimo **Server-Sent Events / streaming HTTPS**, ne WebSocket.

### Dobar / loš odgovor
- **Dobar:** „Neka ostane cloud“ / „Da, SSE + evo timeout i path“  
- **Loš:** „Stavite chat u isti PHP folder“  

### Tvoji odgovori od IT-a
- Agent lokacija: cloud / kod njih: _______________  
- SSE/timeout OK: da / ne / n/a  
- Napomena: _______________  

### Sažetak razgovora
- **2026-11-08:** Tema 4. Preporuka: agent na cloud. Kod njih tek uz SSE + duži timeout + drugi port/path + čuvar. Nije isto što WebSocket.
- **2026-11-08:** SSE pojašnjen: jedan dugi HTTP odgovor (server → browser), ne WS. U CNAME brifu agent na Renderu → IT ne dira SSE. „Kod vas“ = proxy ne sme da preseče dugu vezu (timeout) + odvojen path/port do agent procesa.
- **2026-11-08:** Korisnik potvrdio: objašnjenje OK; **obavezno IT-u reći „Server-Sent Events / streaming HTTPS, ne WebSocket“** — zlatna fraza u briefingu.

### SSE vs WebSocket (za IT brif — nemoj reći WebSocket)

| | **SSE** (vi ovo koristite) | **WebSocket** (nije vaš chat) |
|--|----------------------------|-------------------------------|
| Šta je | Običan HTTPS request koji **ostane otvoren**; server šalje komade teksta | Poseban „tunel“ u oba smera |
| Pravac | Glavnom **server → browser** (AI piše) | Oba smera stalno |
| Na proxy-ju | Treba **dugo držanje** veze + često isključen buffer | Druga pravila (`Upgrade` itd.) |
| Šta reći IT-u | „**Server-Sent Events** preko HTTPS, streaming odgovor“ | Ne pominji osim ako pitaju |

**SSE slikom:** kao da čitaš vest dok je novinar još kuca — stižu pasusi jedan po jedan, ista veza, bez zatvaranja posle prvog paketa.

**Zašto „duži timeout“:** AI odgovor može trajati 30–120+ s. Ako Nginx prekine posle 60 s → chat pukne usred rečenice. Zato `proxy_read_timeout` (ili ekvivalent) npr. 5–10 min za taj path.

**Zašto „odvojen path ili port“ (samo ako agent kod njih):**  
- Glavni API: `https://domen/api/...` → Express CMS  
- Agent: `https://domen/agent/...` **ili** drugi port iza proxy-ja → drugi proces  
Da streaming pravila (timeout, no buffer) važe **samo** za chat, ne diraju običan CMS.  

**U tvom preferiranom CNAME brifu:** ovo IT-u skoro ne treba — agent URL ostaje Render; ti kažeš „chat mikroservis spolja, SSE tamo, sajt radi i bez njega“.

---

## Tema 5 — MySQL / MariaDB

### Zašto se ovo pita
Baza je **izvor istine**: CMS sadržaj, rezervacije, gosti, (delom) AI usage. Bez dogovora gde živi MySQL nema produkcije. App (Express) se samo **povezuje** preko `DATABASE_URL` / `DB_*` u env.

### Uz tvoj preferirani CNAME start
Najjednostavnije: baza ostaje **Aiven** (ili sličan managed MySQL) — IT ne mora da daje fakultetski MySQL.  
Bazu na SFB/RCUB otvaraš samo ako **traže** da lični podaci / rezervacije budu u akademskoj mreži (GDPR / politika).

### Šta znače opcije

| Opcija | Značenje | Za tebe |
|--------|----------|---------|
| **Nova baza** | Prazna schema + tvoje migracije/seed | Čisto, preporuka |
| **Postojeća** | Deliti server sa drugim app-om | Opasno mešanje; samo ako IT insistira + poseban database name + user |
| **Ko pravi usera** | MySQL nalog samo za ovu app (prava na jednu bazu) | Ne root; ti dobiješ host/user/pass ili IT upiše u env |
| **Backup** | Automatski dump / PITR | Ko radi restore? (Aiven / IT / ti u održavanju) |
| **Veličina** | Disk (GB) — tekst + slike su na **disk upload**, ne sve u DB | Za NB Goč mali-srednji obim; Aiven Developer 8 GB često dosta za početak |
| **Remote pristup** | Da li smeš sa svog PC / sa Render IP da se konektuješ | Bez ovoga ne možeš debug/migracije; alternativa: samo sa API hosta + VPN/SSH tunnel |

MariaDB ≈ dovoljno kompatibilan sa MySQL za ovaj projekat; pitaj šta tačno imaju.

### Pitanje koje postavljaš
> Za podatke aplikacije (CMS, rezervacije, gosti): da li baza ostaje na managed cloud MySQL (npr. Aiven), ili zahtevate MySQL/MariaDB kod vas? Ako kod vas — nova baza (ne deljena), ko kreira usera, kako ide backup, i da li API host (Render) sme remote pristup na 3306/SSL?

### Dobar / loš odgovor
- **Dobar:** „Cloud OK“ / „Kod nas nova baza, evo user + SSL + backup politika“  
- **Loš:** „Stavite u naš postojeći WordPress database“ / nema backup / nema pristupa ni sa API servera  

### Tvoji odgovori od IT-a
- Lokacija: cloud / fakultet / RCUB: _______________  
- Nova baza: da / ne  
- Backup: _______________  
- Remote sa API hosta: da / ne / VPN  
- Napomena: _______________  

### Ko sve mora da ima pristup MySQL (provera koda)

| Komponenta | Pristup bazi? | Tip | Šta radi |
|------------|---------------|-----|----------|
| **Frontend (Vue/`dist`)** | **Ne** | — | Samo HTTPS ka API / agentu |
| **Site API** (Express, Render) | **Da** | read+write | CMS, rezervacije, gosti, upload meta, čita `ai_budget_monthly` za admin |
| **Chat agent** (Render) | **Da** | read (+ ograničen write) | Čita sobe/sadržaj (`checkRooms`, roomResolver…); upis `ai_budget_monthly`; `chat_messages`; čitanje `guests` |
| **Ingest skripta** (`ingestion_prod.js`, cron/ručno) | **Da** | **read** MySQL → piše u **Qdrant** | Vuče tekstove/teme/sobe iz MySQL, embeduje, puni vektore |
| **Qdrant** | Ne ka MySQL | — | Agent ga čita za RAG; ingest ga puni |
| **Netlify / Brevo / LLM** | Ne | — | — |

Znači: ako je MySQL **kod njih**, remote pristup treba barem:
1. **IP/host API servisa** (Render),
2. **IP/host chat-agenta** (drugi Render servis),
3. **mesto gde trči ingest** (isti agent host, GitHub Action, ili tvoj PC preko VPN — dogovoriti).

Jedan MySQL user može za sve tri, ili **dva usera**: `app_rw` (API) i `agent_rw` / `ingest_ro`+mali write — čišće za IT.

### Da li je OK da cloud app priča sa bazom kod njih?

**Da, uobičajeno je** — pod uslovima:
- MySQL sluša samo sa **allowlist IP** (Render egress IP-ovi) ili preko **VPN/SSH tunela** / privatnog linka — **ne** otvoren `0.0.0.0` na internet;
- **SSL** ka bazi;
- poseban user, samo ta jedna database;
- firewall: port 3306/custom samo sa tih IP.

**Ako IT ne da remote sa Rendera:** onda ili (a) baza ostaje Aiven, ili (b) API (+ idealno agent) moraju bliže bazi (kod njih) — CNAME-only FE više nije dovoljan za „baza kod vas“.

### Pitanje koje postavljaš (dopuna — dozvole)
> Ako MySQL bude kod vas, cloud API i chat-agent (oba na Renderu) moraju da se konektuju na tu bazu (CMS + rezervacije + ingest u Qdrant + AI usage). Možete li allowlist IP-ova + SSL + poseban DB user? Ako remote nije dozvoljen, baza mora ostati cloud ili selimo i API uz bazu.

### Sažetak razgovora
- **2026-11-08:** Tema 5. CNAME start → Aiven OK. Fakultetski MySQL samo ako politika traži. Nova baza + poseban user + backup + remote za API. Ne deliti WP bazu.
- **2026-11-08:** Mapiran pristup: FE ne dira DB; **site API + chat-agent + ingest** moraju MySQL. Ingest: MySQL→Qdrant. Baza kod njih ⇒ allowlist za Render (API+agent) + SSL; bez remote ⇒ Aiven ili seliti API.

### Veza sa klijentom (bez tehnike)
Podaci rezervacija/gostiju su **njihovi**; gde fizički stoje (cloud vs akademska mreža) dogovaraš sa IT zbog pravila fakulteta — klijent čuje samo „usklađeno sa IT / politikom podataka“.

---

## Tema 6 — Disk za upload (slike CMS)

### Zašto se ovo pita
CMS ubacuje slike (vesti, sobe, hero, osoblje…). U kodu: **Multer → `public/uploads`**, URL tipa `/uploads/...`. MySQL drži **samo putanju**, ne binarni fajl.  
Ako disk nije trajan ili nema backup → posle redeploy/restarta **nestanu slike**, tekst u CMS ostane.

### Uz CNAME (API na Renderu)
- Treba **persistent disk** na Render web servisu (plaća se po GB) **ili** object storage (S3/R2) — inače free/ephemeral disk gubi fajlove.
- IT fakulteta ovde **ne dira** ništa, dok god API nije kod njih.
- Backup: uz first-deploy snapshot + povremeni zip `uploads` / sync (deo tvog održavanja).

### Ako API (dakle i upload) ide kod njih

| Tema | Pitaj / dogovori |
|------|------------------|
| **Kvota** | Koliko GB za slike? (start: par GB često dosta) |
| **Putanja** | Gde sme folder (van web root-a ili kontrolisan `alias`) |
| **Backup** | Da li IT bakapuje taj folder ili ti (rsync/zip uz dump baze) |
| **Javni URL** | Kako browser vuče sliku: `https://api…/uploads/…` ili proxy sa FE domena |
| **Dozvole** | Write samo za Node proces; ne world-writable |

### Pitanje koje postavljaš
> Slike iz CMS-a čuvaju se kao fajlovi uz API (ne u MySQL). Na cloud-u koristimo trajni disk uz API. Ako API bude kod vas: kolika je kvota, da li se taj folder bakapuje, i kako se servišu javni URL-ovi slika?

### Dobar / loš odgovor
- **Dobar:** „X GB, backup noću, evo path“ / „Ostanite na Render disku“  
- **Loš:** „Samo FTP u public_html bez kvote/backup-a“ / ephemeral disk bez upozorenja  

### Tvoji odgovori od IT-a
- Upload lokacija: cloud disk / kod njih: _______________  
- Kvota GB: _______________  
- Backup foldera: da / ne / ko: _______________  

### Sažetak razgovora
- **2026-11-08:** Tema 6. Upload ≠ baza. CNAME → Render persistent disk (+ tvoj backup). Kod njih → kvota, backup, URL, dozvole. First-deploy snapshot uključuje i upload fajlove.
- **2026-11-08:** Korisnik: „možda bi slike trebale u bazi“. Stav za plan: **ne BLOB u MySQL** za CMS galerije — standard je fajl/object storage + URL u bazi. Trenutni `public/uploads` je OK uz trajni disk; bolja evolucija kasnije = S3/R2/Cloudinary, ne BINARY u MySQL. Nije blokator za IT CNAME start.

---

## Tema 7 — HTTPS i DNS poddomena

### Zašto se ovo pita
Bez DNS zapisa **ne postoji** `nastavnabazagoc.sfb.bg.ac.rs` (sada: NXDOMAIN). Bez HTTPS browser / mejl linkovi / cookies / API sa drugog origin-a postaju problematični. Ovo je **glavni posao IT-a** u tvom CNAME scenariju.

### Šta je čije (CNAME start — tvoja preferenca)

| Stavka | Ko | Šta |
|--------|-----|-----|
| Kreiranje poddomena `nastavnabazagoc.sfb.bg.ac.rs` | **IT** | DNS zona `sfb.bg.ac.rs` |
| Tip zapisa | **IT** (ti kažeš vrednost) | Najčešće **CNAME** → Netlify/Vercel hostname (npr. `….netlify.app`) |
| HTTPS cert za taj poddomen | **Netlify/Vercel** (automatski Let’s Encrypt) kad CNAME + DNS prođu proveru | IT ne mora ručno da izdaje cert |
| WWW / apex | dogovor | `www.` opciono; apex (`sfb…` bez sub) drugačiji (A/ALIAS) — vama treba **subdomen**, CNAME je OK |
| API / agent hostnames | ti | Ostaju `*.onrender.com` (ili kasnije `api.` CNAME ako IT doda) |

### Ako FE/`dist` kod njih (ne CNAME na Netlify)
Onda **oni** drže cert (Let’s Encrypt na Nginx ili njihov CA). Ti i dalje tražiš HTTPS obavezno.

### Pitanja koja postavljaš
> Molim kreiranje poddomena `nastavnabazagoc.sfb.bg.ac.rs` kao **CNAME** na naš FE host (dobićete tačan target, npr. Netlify). HTTPS očekujemo preko FE hosta (Let’s Encrypt). Ko je kontakt za DNS izmene i koliko traje propagacija? Da li treba interni ticket / odobrenje za novi poddomen?

### Dobar / loš odgovor
- **Dobar:** „Može CNAME, evo ticket, cert ide preko Netlify“  
- **Loš:** samo HTTP; „stavite na postojeći sfb.bg.ac.rs/podfolder“ bez dogovora o SPA; nedefinisan vlasnik DNS-a  

### Napomene za tebe
- `FRONTEND_URL` / `ALLOWED_ORIGINS` u API env mora da uključi `https://nastavnabazagoc.sfb.bg.ac.rs` posle pusta.  
- Mejl linkovi (Brevo) koriste taj URL.

### Koraci: poddomen → Netlify → HTTPS (CNAME start)

1. **IT** kreira DNS **CNAME**: `nastavnabazagoc.sfb.bg.ac.rs` → target koji Netlify pokaže (npr. `….netlify.app` ili Netlify DNS target iz panela).  
2. **Ti** u Netlify projektu: **Domain settings → Add custom domain** → uneseš `nastavnabazagoc.sfb.bg.ac.rs`.  
3. Sačekaš da Netlify **verifikuje DNS** (ako CNAME nije tačan / nije stigao, ostaje na čekanju).  
4. Netlify **automatski** izda **Let’s Encrypt HTTPS** — ne kupuješ i ne instaliraš cert ručno. Cilj: zeleni katanac / HTTPS Provisioned.  
5. **Ti** na API (Render) env:  
   - `FRONTEND_URL=https://nastavnabazagoc.sfb.bg.ac.rs`  
   - `ALLOWED_ORIGINS=…,https://nastavnabazagoc.sfb.bg.ac.rs`  
6. Provera: otvara se FE na fakultetskom URL-u; CMS/API i chat i dalje mogu na `*.onrender.com`.  

Ako cert „ne sedne“: skoro uvek DNS/CNAME, ne ručno sertifikovanje.

### Tvoji odgovori od IT-a
- Poddomen odobren: da / ne  
- CNAME target: _______________  
- Kontakt DNS: _______________  
- Rok: _______________  

### Sažetak razgovora
- **2026-11-08:** Tema 7. CNAME start = IT pravi DNS; cert najčešće Netlify LE. Glavni IT deliverable. Posle: env CORS/`FRONTEND_URL`.
- **2026-11-08:** Pojasnjenje: FE na `nastavnabazagoc.sfb…`; API/agent mogu ostati `*.onrender.com` — browser zove te URL-ove iz JS-a. Poseban `api.nastavnabazagoc…` CNAME = samo lepši/fakultetski hostname do istog Rendera, nije obavezan za rad.
- **2026-11-08:** Redosled potvrđen: IT CNAME → ti Domain settings na Netlify → Netlify sam izda Let’s Encrypt HTTPS (obično automatski kad DNS sedne). Zatim env na API: FRONTEND_URL + ALLOWED_ORIGINS.

### FE na fakultetskom imenu, API i dalje na Renderu — kako to radi

Korisnik u adresnoj traci vidi samo FE:
`https://nastavnabazagoc.sfb.bg.ac.rs`

Vue u browseru **poziva API** na drugom hostu, npr.:
`https://nesto-api.onrender.com/api/...`
i agenta:
`https://chat-agent-….onrender.com/...`

To je normalno (CORS mora da dozvoli FE origin). **Ne mora** API da bude na `sfb.bg.ac.rs` da bi sajt „bio na fakultetu“.

**Opcioni kasniji korak:** IT doda npr.  
`api.nastavnabazagoc.sfb.bg.ac.rs` → CNAME na Render hostname  
Onda URL izgleda „fakultetski“, a motor i dalje na Renderu. Lepše / politika; **nije uslov** za CNAME start.

---

## Tema 8 — Izlazni internet (outbound HTTPS)

### Zašto se ovo pita
API i agent **pozivaju spolja** preko HTTPS: Brevo (mejl), DeepL, Claude/Gemini, Qdrant, ponekad embedding API. Ako server (kad app živi kod njih) **nema izlaz** ili firewall seče te domene → CMS prevod, mejl i chat ne rade.

### Uz CNAME (API + agent na Renderu)
Outbound je **na Renderu**, ne na fakultetskom serveru. IT **skoro ne dira** ovo.  
I dalje ih informiši zbog politike: *„aplikacija sa cloud hosta zove AI/mejl API-je; ključevi su naši/klijentovi u env.“*

### Ako API/agent ikad kod njih — pitaj
- Da li server sme **outbound HTTPS (443)** ka internetu?  
- Ima li **allowlist** samo za određene domene? (onda dati listu)  
- Proxy za izlaz (HTTP_PROXY) — da li Node mora da se podesi?

### Inventar outbound poziva (šta app „zove spolja“)

**Kako ih zoveš na sastanku:** *izlazni HTTPS pozivi sa naših cloud servera (Render) ka spoljnim servisima* — ne ulaz na fakultetski firewall.

#### Pregledna tabela (za tebe / IT)

| Servis | Gde se koristi | Čemu |
|--------|----------------|------|
| **Aiven MySQL** | API + agent | podaci (CMS, rezervacije, ingest izvor…) |
| **Brevo** | API | mejlovi |
| **DeepL** | API | prevod CMS |
| **Anthropic (Claude)** | API (opciono) + **agent** | LLM |
| **Google Gemini** | API + **agent** | fallback LLM / embedding |
| **Qdrant Cloud** | API (ako vector on) + **agent** | RAG vektori |
| **Open-Meteo** | API | vreme na sajtu |
| HuggingFace / OpenAI | opciono | drugi embedding |

FE/Netlify **ne** drži ove ključeve; browser samo zove tvoje Render URL-ove.

#### A) Site API (`baza-goc` backend na Renderu)

| # | Servis (ime) | Tipičan host / API | Svrha | Ključ u env |
|---|--------------|--------------------|-------|-------------|
| 1 | **MySQL (Aiven)** | `*.aivencloud.com` (port npr. 25232 + SSL) | CMS, rezervacije, gosti | `DATABASE_URL` / `DB_*` |
| 2 | **Brevo** | `api.brevo.com` | mejlovi (upiti, odobrenje…) | `BREVO_API_KEY` (+ opciono SMTP) |
| 3 | **DeepL** | `api-free.deepl.com` ili `api.deepl.com` | prevod SR→EN u CMS | `DEEPL_API_KEY` |
| 4 | **Anthropic (Claude)** | `api.anthropic.com` | site-guide / AI na sajtu (ako uključeno) | `AI_API_KEY` / provider |
| 5 | **Google Gemini** | `generativelanguage.googleapis.com` | fallback chat / embedding | `GEMINI_API_KEY` |
| 6 | **Qdrant Cloud** | `*.qdrant.io` (tvoj cluster URL) | vektorska pretraga (ako `USE_VECTOR_SEARCH`) | `QDRANT_URL`, `QDRANT_API_KEY` |
| 7 | **Open-Meteo** | open-meteo host | vreme na sajtu | lat/lon u env (javni API) |
| 8 | *(opciono)* **OpenAI / HuggingFace** | po potrebi | embedding alternative | `OPENAI_*` / `HUGGINGFACE_*` |

#### B) Chat agent (mikroservis na Renderu)

| # | Servis | Tipičan host | Svrha | Ključ |
|---|--------|--------------|-------|-------|
| 1 | **MySQL (ista baza)** | Aiven | sobe, ingest izvor, usage, chat_messages | `DB_*` |
| 2 | **Anthropic Claude** | `api.anthropic.com` | primarni LLM | `ANTHROPIC_API_KEY` |
| 3 | **Google Gemini** | `generativelanguage.googleapis.com` | fallback LLM + embedding (ingest) | `GEMINI_API_KEY` |
| 4 | **Qdrant Cloud** | `*.qdrant.io` | RAG znanje | `QDRANT_URL`, `QDRANT_API_KEY` |
| 5 | *(opciono)* **HuggingFace** | HF API | drugi embedding mod | `HUGGINGFACE_API_KEY` |

#### C) Frontend (Netlify / browser korisnika)
Ne drži te server ključeve. Browser zove **tvoj** API i agent URL (to je ulaz na Render, ne „fakultetski outbound“).

#### D) Šta NIJE outbound sa Rendera u CNAME scenariju
Fakultetski server — **nema** ovih poziva. Samo DNS.

### Kratka lista za IT mail (copy-paste)
> Sa naših Render servisa (API + chat-agent) idu izlazni HTTPS pozivi ka: Aiven MySQL, Brevo, DeepL, Anthropic, Google Gemini, Qdrant Cloud, Open-Meteo. API ključevi su u env na Renderu, ne u frontendu.

### Pitanje koje postavljaš
> Na cloud scenariju (Render) izlazni HTTPS ide sa njihovih servera, ne sa vaših. Ako kasnije hostujemo API kod vas: da li je dozvoljen outbound HTTPS ka Brevo, DeepL, Anthropic/Google, Qdrant i Aiven (ili vaš MySQL)? Postoji li proxy ili domain allowlist?

### Dobar / loš odgovor
- **Dobar:** „Cloud outbound OK“ / „Kod nas 443 otvoren“ / „Evo allowlist, pošaljite domene“  
- **Loš:** „Server nema internet“ bez alternative (onda AI/mejl moraju drugim putem ili ostati cloud)

### Tvoji odgovori od IT-a
- Outbound sa cloud: OK (informisani): da / ne  
- Ako on-prem: 443 slobodan / allowlist / zabranjen: _______________  

### Sažetak razgovora
- **2026-11-08:** Tema 8. CNAME ⇒ outbound sa Rendera, IT minimalno. On-prem ⇒ pitati 443 / allowlist / proxy.
- **2026-11-08:** Upisan pun inventar outbound: API (MySQL/Brevo/DeepL/Claude/Gemini/Qdrant/Open-Meteo) + agent (MySQL/Claude/Gemini/Qdrant[/HF]). Fraza: „izlazni HTTPS sa naših cloud servera“.

---

## Tema 9 — Email (Brevo vs fakultetski SMTP)

### Zašto se ovo pita
Rezervacije/upiti šalju mejlove (prijem, login, odobrenje/odbijanje). Bez pouzdanog SMTP/API-ja korisnik ne dobija poruku — upit i dalje može biti u CMS-u.

### Šta sada radi app
Primarno **Brevo API** (`api.brevo.com`) sa Render API-ja; u kodu postoji i SMTP fallback. Linkovi u mejlu koriste `FRONTEND_URL` (posle CNAME: fakultetski HTTPS).

### Opcije

| Opcija | Ko šalje | Šta dogovoriti |
|--------|----------|----------------|
| **A) Brevo (ostaje)** | Cloud API | SPF/DKIM u DNS — često na domenu **pošiljaoca** (Brevo domen ili fakultetski ako verifikuju) |
| **B) Fakultetski SMTP** | Njihov mail server | Host, port, TLS, nalog; IT daje kredencijale u env |
| **C) Google Workspace SMTP** | Ako koriste Google (SFB MX je Google) | App password / SMTP relay — samo uz IT odobrenje |

### SPF / DKIM (jedna rečenica)
Da mejl ne ide u spam: DNS zapisi koji kažu „ovaj server sme da šalje u ime ove adrese“. Ako šalješ sa `nešto@sfb.bg.ac.rs`, **IT** mora da odobri SPF/DKIM; ako šalješ sa Brevo adrese, verifikacija ide u Brevo + njihovi DNS saveti.

### Uz CNAME start
Najmanje trenja: **ostati na Brevo**; informisati IT da mejlovi idu sa cloud-a. Kasnije eventualno prelazak na fakultetski SMTP.

### Pitanje koje postavljaš
> Transakcione mejlove sada šalje Brevo sa API hosta. Da li je to prihvatljivo, ili zahtevate fakultetski SMTP? Ako SMTP kod vas — parametri i ko podešava SPF/DKIM za adresu pošiljaoca?

### Dobar / loš odgovor
- **Dobar:** „Brevo OK“ / „Evo SMTP + SPF za ovu adresu“  
- **Loš:** „Šaljite sa @sfb bez DNS zapisa“ → spam  

### Tvoji odgovori od IT-a
- Mejl: Brevo / fakultetski SMTP / Google: _______________  
- Pošiljalac adresa: _______________  
- SPF/DKIM: ko: _______________  

### Sažetak razgovora
- **2026-11-08:** Tema 9. Preferenca uz CNAME: Brevo. Alternativa fakultetski SMTP + SPF/DKIM. Upit može biti u CMS i bez mejla.
- **2026-11-08:** Pojasnjenje: CNAME ne menja mejl logiku. Ti i dalje podešavaš (1) From adresu koja šalje gostima (2) admin adrese koje primaju obaveštenja — to su env/CMS, ne DNS. „Kod njih“ za mejl = najčešće **samo SMTP nalog** (FE+API ostaju cloud); nije isto što „ceo sajt kod njih“.

### CNAME vs mejl — šta ti i dalje podešavaš

CNAME rešava **samo adresu sajta**. Mejlovi i dalje idu iz **backend-a** (Render). Ti moraš da definišeš:

| Šta | Primer | Gde se podešava |
|-----|--------|-----------------|
| **From / pošiljalac** (šta vidi gost) | `noreply@…` ili Brevo domen / kasnije `@sfb…` | env: `EMAIL_FROM`, Brevo sender |
| **Reply-To** (opciono) | kontakt NB | `EMAIL_REPLY_TO` |
| **Admin prima obaveštenja** | `neko@sfb.bg.ac.rs` | env / settings u CMS (zavisi šta kod već čita) — *kome stiže „nova rezervacija“* |

To nije „IT daje CNAME pa mejl sam radi“ — ti upisuješ adrese posle dogovora sa klijentom.

### Šta znači „mejl kod njih“?

| Nivo | Šta je kod njih | Šta ostaje kod tebe (cloud) |
|------|-----------------|------------------------------|
| **Samo SMTP** (najčešće „kod njih“ za mejl) | Mail server + nalog (host/user/pass) + SPF/DKIM | **Ceo FE + ceo API + agent**; samo umesto Brevo API-ja backend šalje preko njihovog SMTP |
| **Samo DNS CNAME** | Poddomen sajta | Sve ostalo, uključujući Brevo |
| **API kod njih** | Express (+ upload, env) | FE može CNAME; mejl onda sa njihovog servera outbound SMTP ili i dalje Brevo |
| **Sve on-prem** | FE+API+baza… | Retko za start |

**Jedna rečenica:** *„Kod njih SMTP“ ≠ „kod njih ceo sajt“.* CNAME + Brevo = sajt na fakultetskom imenu, mejl i dalje šalje tvoj API preko Brevo-a dok ne zameniš transport SMTP-om.

---

## Tema 10 — Qdrant (vektorska baza)

### Zašto se ovo pita
Qdrant drži **vektore znanja** za chat RAG (tekstovi/sobe/teme posle **ingest** iz MySQL). To **nije** zamena za MySQL — MySQL = istina CMS/rezervacija; Qdrant = brza semantička pretraga za agenta.

### Uz CNAME start (preporuka)
Qdrant ostaje **cloud** (`*.qdrant.io`). IT **ne dira**.  
Agent + (opciono) site API + ingest zovu Qdrant outbound HTTPS (već u inventaru Teme 8).

### Opcije

| Opcija | Gde | Kada |
|--------|-----|------|
| **A) Qdrant Cloud** | spolja | **Default** — najmanje posla, već imate |
| **B) Docker Qdrant kod njih** | njihov server | Samo ako zabranjuju spoljne DB *i* daju Docker + disk + backup + čuvar |
| **C) Bez Qdrant / AI off** | — | Sajt i CMS rade; chat slabiji ili ugašen |

### Ko mora da „vidi“ Qdrant
- **Chat agent** — pretraga RAG (obavezno za pametan chat)  
- **Ingest skripta** — puni kolekciju iz MySQL  
- **Site API** — samo ako je `USE_VECTOR_SEARCH` uključen za site-guide  

Frontend **ne** priča direktno sa Qdrant.

### Pitanje koje postavljaš
> Vektorska baza (Qdrant) za AI chat predlažemo da ostane na cloud-u. Da li je to prihvatljivo? Self-host (Docker) kod vas samo ako vi to zahtevate i možete održavati.

### Dobar / loš odgovor
- **Dobar:** „Cloud OK“ / „Docker OK, evo resursa“ / „AI nije prioritet — može bez Qdrant“  
- **Loš:** „Stavite vektori u naš MySQL/WordPress“ (nije isti alat)

### Tvoji odgovori od IT-a
- Qdrant: cloud / Docker kod njih / bez AI: _______________  

### Sažetak razgovora
- **2026-11-08:** Tema 10. Default cloud Qdrant. Nije MySQL. Agent+ingest moraju pristup. CNAME ne menja Qdrant. On-prem Docker samo na zahtev IT-a.

---

## Tema 11 — Pristup i održavanje (SSH, deploy, restart, radno vreme)

### Zašto se ovo pita
Kad nešto padne, mora biti jasno **ko sme šta da dira** i **u kom roku**. Inače svi čekaju sve. Veza sa ugovorom: ti softver + cloud; IT DNS; klijent CMS.

### Uz CNAME start (tvoja preferenca)

| Resurs | Ko ima pristup | Tipičan „deploy / restart“ |
|--------|----------------|----------------------------|
| DNS `*.sfb.bg.ac.rs` | **IT** | promena CNAME |
| Netlify (FE) | **Ti** (owner) | git push / deploy |
| Render API + agent | **Ti** | redeploy, env, logovi |
| Aiven / Qdrant / Brevo / AI ključevi | **Ti** | dashboard |
| CMS nalozi | **Klijent** (+ ti super-admin) | sadržaj, ne server |
| SSH na fakultetski server | **n/a** | nema app tamo |

**SSH** na SFB u ovom scenariju **ne treba** za app — samo ako kasnije stave API kod njih.

### Ako ikad API/agent kod njih — pitaj
- **SSH** (ili panel) za tebe — da / ne / samo preko njihovog admina  
- Ko radi **deploy** nove verzije (ti / IT / zajedno)  
- Ko **restart** čuvara (systemd/PM2/Docker) van radnog vremena  
- **Radno vreme** podrške IT + eskalacija  

### Pitanja koja postavljaš
> U predloženom CNAME modelu: mi održavamo Netlify/Render/bazu/AI; vi DNS poddomen. Da li vam treba read-only uvid u cloud status, ili dovoljan naš kontakt? Ako kasnije host bude kod vas: da li dobijam SSH/deploy pristup i koje je radno vreme podrške?

### Dobar / loš odgovor
- **Dobar:** jasna podela; jedan IT kontakt za DNS; tvoj paušal za softver  
- **Loš:** „svi imaju root svuda“ / niko ne sme restart / nema kontakta za DNS  

### Tvoji odgovori od IT-a
- IT kontakt (DNS): _______________  
- SSH kasnije: da / ne / n/a  
- Radno vreme IT: _______________  

### Sažetak razgovora
- **2026-11-08:** Tema 11. CNAME ⇒ ti cloud deploy/restart; IT DNS; klijent CMS; SSH ne treba. Kasnije on-prem ⇒ SSH + ko deploy + radno vreme. Read-only uvid opciono, ne full owner IT-u.
- **2026-11-08:** SSH = udaljeni terminal na njihov server (bitan samo on-prem). Cloud sada: git push → auto redeploy + ručni restart u dashboardu ≈ „čuvar + deploy“ bez SSH. Nije 100% „sve samo od sebe“ — i dalje env, DNS, pad provajdera, ingest/Qdrant, sadržaj CMS.

### SSH — značenje i bitnost
**SSH** = bezbedan udaljeni pristup **komandnoj liniji** na serveru (kao da sediš za njihovim Linuxom).  
Tamo: vidiš logove, `git pull`, restart PM2/Docker, edituješ env.  
**Bitan** samo kad app **živi na njihovoj mašini**.  
**Uz CNAME + Render/Netlify:** SSH na SFB **ne koristiš** za deploy — platforma to radi umesto SSH.

### Šta ti već imaš na cloud-u (i šta to znači)

| Mehanizam | Šta radi | „Automatski“? |
|-----------|----------|----------------|
| **Auto redeploy** (git push → Netlify/Render…) | Nova verzija koda se builduje i pusti | Da, **za kod** koji je povezan na repo |
| **Ručni restart / redeploy** u dashboardu | Digne servis ako je zaglavljen; ponekad posle env izmene | Ti klikneš kad zatreba |
| **Aiven / managed DB** | Oni drže MySQL proces; ti restart iz panela retko | Infrastruktura baze „ide sama“; **migracije/schema** i dalje ti |
| Čuvar (Tema 3) | Platforma drži proces živim | Da, na Renderu |

**Za tebe danas:** da — **operativa softvera je uglavnom automatizovana** na cloud-u: push → deploy, platforma restartuje padove u okviru svog SLA, ti imaš ručni restart kad treba. **Ne treba SSH** za taj model.

**Šta i dalje nije „samo od sebe" (tvoja briga / održavanje):**
- pogrešan env / istek ključa / istek kartice  
- DNS kod IT (CNAME)  
- pad celog Render/Aiven (čekaš ili prebacuješ)  
- ingest / Qdrant sync kad se sadržaj menja  
- CMS sadržaj (klijent)  
- odluka *šta* ide u git (auto deploy deployuje i bug ako pushuješ bug)

### Gde su tvoje potrebe za održavanjem vs prijava greške od klijenta

**Tvoje održavanje (proaktivno / paušal) — često klijent ne vidi dok ne pukne:**

| Oblast | Primer |
|--------|--------|
| Cloud računi | istek kartice, upgrade plana, free→paid Render sleep |
| Env / ključevi | istekao Brevo/DeepL/Anthropic; pogrešan `FRONTEND_URL` posle CNAME |
| Deploy | push + provera da build prošao; rollback ako treba |
| Baza | dump/backup, migracije kad menjaš šemu |
| Upload disk | persistent disk pun; backup `uploads` |
| AI / Qdrant | budžet cap; ingest posle većih izmena sadržaja; keepalive Qdrant free |
| Zavisnosti | bezbednosni update biblioteka (povremeno) |
| Koordinacija IT | DNS, kad zatreba SMTP/SPF |

**Klijent tipično prijavi (simptom → često tvoja intervencija):**

| Prijava klijenta | Verovatno | Prioritet |
|------------------|-----------|-----------|
| „Sajt se ne otvara“ na fakultetskom URL-u | DNS/IT **ili** Netlify pad | P0 — prvo proveri da li radi netlify.app |
| „Ne učitava se sadržaj / belo / greška“ | API ili MySQL | P0 |
| „Ne mogu u CMS / login“ | API, JWT, env | P0 |
| „Rezervacija ne radi / forma ne šalje“ | API / validacija / bug | P0 |
| „Nismo dobili mejl“ (a upit postoji u CMS) | Brevo/SMTP | P1 |
| „Nema slika“ | disk/uploads | P1 |
| „Chat ne radi / glup odgovor“ | agent / LLM / Qdrant / budžet | P2 |
| „Pogrešan tekst / cena / vest“ | **oni u CMS** — nije tvoj bug | uputi na CMS |
| „Neko je obrisao sadržaj“ | restore sa backupa (ti) | dogovor |

**Šta klijent NE bi trebalo da šalje tebi kao „grešku softvera“:**  
izmene sadržaja, nove vesti, ispravka cene sobe, prevod — to je CMS. U ponudi/handbooku to napiši jasno.

**Jedna rečenica:**  
Auto-deploy smanjuje tvoj *rutinski* posao; održavanje ostaje gde platforma, ključevi, backup i pravi bugovi; klijent zove kad **nešto ne radi u korišćenju** (P0 sajt/CMS/rezervacije prvo).

---

## Tema 12 — Ograničenja (CPU/RAM, firewall, lični podaci / GDPR)

### Zašto se ovo pita
Da ne obećaš „sve kod vas“ pa naletiš na: premali server, zatvoren firewall, ili zabranu da podaci gostiju budu na Aiven/EU cloud. Uz CNAME većina hard limit-a pada na **tvoje** Render/Aiven planove — ali **politika podataka** i dalje može da nameće gde sme MySQL.

### Uz CNAME start

| Ograničenje | Gde važi | Šta radiš |
|-------------|----------|-----------|
| CPU/RAM | Render Starter (512 MB…) | Po potrebi veći plan; IT ne dira |
| Firewall fakulteta | Skoro ne diraju app | Bitno samo DNS; browser korisnika zove Render |
| Disk upload | Render persistent disk kvota | Ti pratiš GB |
| Rate limit / AI budget | tvoj kod + API cap | Već ugrađeno |
| **Lični podaci (gosti, email, rezervacije)** | **politika fakulteta / GDPR** | Pitaj sme li baza na Aiven (EU) ili mora akademska mreža |

### Ako ikad on-prem API
Pitaj eksplicitno: vCPU/RAM, max disk, concurrent konekcije, da li firewall blokira outbound (Tema 8), da li sme remote MySQL (Tema 5).

### GDPR / fakultetska pravila — jezik za klijenta i IT
Ne predavanje prava; praktična pitanja:
- Ko je **rukovalac** podacima rezervacija (fakultet)?  
- Sme li obrada/hosting kod **procesora** u cloud-u (Aiven/Render u EU regionu)?  
- Treba li tekst **politike privatnosti** / kolačići na sajtu (često da — sadržaj/pravni, ne samo IT)?  
- Rok čuvanja upita/naloga?  
- Kontakt za incident (curenje podataka)?

Uz CNAME: FE na `.sfb.bg.ac.rs` ne znači automatski da su podaci „u fakultetu“ — podaci su gde je MySQL. To mora biti usklađeno da klijent „ispoštuje zakone fakulteta“.

### Pitanja koja postavljaš
> Uz cloud hosting: da li je prihvatljivo da baza i API budu na EU managed cloud (Aiven/Render), dok je javni URL na sfb.bg.ac.rs? Postoje li obavezni zahtevi (privatnost, lokacija podataka, logovanje, rok čuvanja) koje moramo ugraditi pre go-live?

### Dobar / loš odgovor
- **Dobar:** „EU cloud OK uz ugovor/procesor“ / „Baza mora kod nas — evo uslova“ / „Treba privacy page“  
- **Loš:** ćutanje pa naknadna zabrana cloud baze posle pusta  

### Tvoji odgovori od IT-a / pravne službe
- Cloud MySQL/API (EU): da / ne / uslovi: _______________  
- Privacy / cookies: _______________  
- Rok čuvanja: _______________  

### Sažetak razgovora
- **2026-11-08:** Tema 12. CNAME ⇒ CPU/RAM na tvom cloud planu. Kritično pitanje: **gde smeju lični podaci**. URL na sfb ≠ podaci na sfb. Uskladiti sa IT/politikom pre go-live.
- **2026-11-08:** Dubina odnosa URL vs podaci + mapa rizika (ispod). Ti nisi pravnik — cilj je da IT/fakultet **eksplicitno** potvrde cloud model pre go-live.

### Dubina: fakultetski URL vs gde su podaci (i gde su rizici)

```text
Korisnik vidi:   nastavnabazagoc.sfb.bg.ac.rs     ← „institucionalni“ utisak
                      │
                      ▼
                 Netlify (FE)                      ← skoro bez ličnih podataka
                      │
          browser zove API (Render)
                      │
                      ▼
              MySQL (npr. Aiven)                   ← IME, EMAIL, TELEFON, REZERVACIJE
              Brevo / AI / Qdrant                  ← delovi podataka ili meta
```

**Odnos:** fakultet „pozajmljuje“ **ime** (domen); ti (cloud) držiš **obradu**. U GDPR jeziku često: fakultet = **rukovalac**, cloud/ti = **obrađivač** (treba jasan dogovor / ugovor o obradi kad traže).

| Sloj | Šta javnost misli | Šta je stvarno | Rizik ako se ne dogovori |
|------|-------------------|----------------|---------------------------|
| Domen `.sfb` | „Sajt je fakultetov“ | Samo DNS pokazivač | Reputacija: incident na cloud-u i dalje vežu za SFB |
| FE Netlify | — | Statički JS | Nizak (nema baze) |
| API Render | — | Logika + privremeno u memoriji/logovima | Logovi sa emailom; ko ima pristup dashboardu |
| **MySQL** | „kod fakulteta“? | **Često ne** — Aiven EU | Glavni rizici: curenje, backup, pristup, lokacija van akademske mreže bez odobrenja |
| Brevo | — | Email + sadržaj poruke | Treća strana vidi PII u mejlu |
| LLM / agent | — | Pitanja korisnika mogu biti lična | Ne slati više PII nego što treba; politika AI |
| Qdrant | — | Uglavnom sadržaj sajta, ne rezervacije | Niži; ipak ne mešati osetljivo |

**Rizici po prioritetu (praktično):**

1. **Politika / zabranjen cloud posle pusta** — najveći projektni rizik: sve radi, pa IT kaže „baza mora kod nas“. Zato Tema 5+12 **pre** go-live.  
2. **Curenje ili pogrešan pristup** — slabe lozinke CMS, env u gitu, preširok DB user, shared nalozi.  
3. **Nema backupa / loš restore** — gubitak rezervacija = poslovni + poverenje.  
4. **Mejl u spam / pogrešan From** — operativni, ne GDPR katastrofa, ali šteti.  
5. **AI šalje suviše konteksta** spolja — reputacija + privatnost; zato AI nije P0 za pustanje.  
6. **Zbrka odgovornosti** — ko obaveštava korisnike pri incidentu? Mora pisati (fakultet vs ti).

**Šta ti možeš da uradiš bez pretvaranja da si DPO:**  
pitaj IT/nadležne da **potpišu ili mailom potvrde** cloud model; u ugovoru: rukovalac = fakultet, ti obrađuješ po uputstvu; privacy tekst na sajtu; minimalni pristupi; backup; exit predaja podataka.

**Jedna rečenica za klijenta:**  
> Adresa sajta biće fakultetska; tehnički podaci rezervacija biće na dogovorenom mestu (cloud ili akademska baza) — to usklađujemo sa IT da bude u skladu sa pravilima ustanove.

### Baza kod njih + dozvole za API/agent — da li to „rešava“ rizik?

**Delimično.** Rešava jedan sloj, drugi ostaje otvoren.

| Šta uradiš | Šta se reši | Šta ostaje |
|------------|-------------|------------|
| MySQL **kod njih** | Podaci **u mirovanju** (at rest) u akademskoj infrastrukturi — često ono što politika traži | — |
| Allowlist IP: samo Render API + agent | Manji napadni profil nego „MySQL otvoren na svet“ | I dalje **ulaz sa interneta** na DB port (kontrolisan, ali postoji) |
| Cloud API/agent i dalje rade | Manje selidbe koda | Dok API radi na Renderu, podaci u **obradi** (u memoriji, logovima) i dalje idu na cloud; Brevo/LLM i dalje treće strane |
| Samo DB user za te app | Bolje od root / deljenja sa WP | Dozvola „drugim app“ (tvojim cloud servisima) **jeste** svesno otvaranje — samo uže i dokumentovano |

**Zaključak:**  
- Baza kod njih ≠ zatvoren sistem.  
- Dozvola pristupa neophodnim delovima (API, agent, ingest) = **kontrolisano otvoreno polje**, ne isto što „bilo koja app sa interneta“, ali **nije** isto što „ništa ne izlazi van fakulteta“.  
- **Potpuno zatvaranje** rizika lokacije/obrade traži i **API (idealno i agent) u njihovoj mreži** — ili prihvatanje da je cloud obrađivač OK uz ugovor (onda Aiven + CNAME često dovoljno).

Tri nivoa za dogovor sa IT:

1. **Cloud OK** — Aiven + Render (najšire „otvoreno“, ali standardno uz ugovor)  
2. **Baza kod nas + cloud API** — allowlist; podaci at rest kod njih, obrada delom spolja  
3. **Baza + API (backend) kod nas** — najuži za obradu; **FE nije isto što API**  

**API ovde = Backend (Express)**, ne frontend.  
- **FE** (`dist` / Netlify + CNAME) može i u nivou 3 ostati spolja — browser samo zove njihov backend.  
- **Chat agent** je treći komad: i u „najužem“ često ostaje cloud (SSE/LLM), ili ide kod njih kao poseban proces.  

- **2026-11-08:** Potvrda: „API kod njih“ = Express backend + MySQL; FE može CNAME; agent odvojeno.

- **2026-11-08:** Baza kod njih + allowlist za API/agent rešava *at rest*, ne *processing* na cloud-u; i dalje kontrolisano otvoreno polje, ne full close.

---

## Finalna lista pitanja (za mail/sastanak)

**Gotovo:** [`IT_PITANJA_finalna_lista.md`](IT_PITANJA_finalna_lista.md)  
— kratak mail (A) + obavezna pitanja za CNAME (B) + blok 2 ako traže hosting kod njih (C) + tabela beleški (D).

- **2026-11-08:** Finalna lista sklopljena posle tema 1–12.