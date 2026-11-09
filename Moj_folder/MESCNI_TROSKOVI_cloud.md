# Mesečni cloud troškovi — orijentacija za cenovnik

Status: radna procena (nov 2026). Uvek proveri zvanične pricing stranice pre ugovora. Cene u USD ≈ EUR za grubi budžet.

## Šta ne sme ostati na „free“ u pravoj produkciji

| Servis | Problem free | Minimalni plaćeni korak |
|--------|--------------|-------------------------|
| Render web (API) | Spava posle ~15 min idle → spor prvi hit | Starter **$7/mes** (uvek uključen) |
| Render web (agent) | Isto | Drugi Starter **$7/mes** |
| Aiven MySQL | Free nestaje / nije za produkciju | Developer **$5/mes** |
| Qdrant | Free suspend posle nedelje neaktivnosti | Free OK ako chat živi; inače Standard (usage) |
| Netlify / Vercel Hobby | OK za mali saobraćaj; komercijalni tim → Pro | **$0** ili **$20/mes** |

## Predlog budžeta za klijenta (2 kolone)

| Stavka | Infrastruktura (cloud) | Tvoj rad (održavanje) |
|--------|------------------------|------------------------|
| FE host | 0–20 € | — |
| API + agent (Render ×2) | ≈ 14 € | — |
| MySQL | ≈ 5 € | — |
| Qdrant / mejl / DeepL | 0–30 € | — |
| AI API cap | 10–20 € | — |
| Softverska briga | — | **80–150 €** |
| **Ukupno** | **≈ 30–70 €** | **80–150 €** |

## Vercel umesto Rendera?

| | Vercel | Render (trenutno) |
|--|--------|-------------------|
| Vue frontend | Odličan (kao Netlify) | Može static, ali FE već na Netlify |
| Express API non-stop | **Loš fit** — serverless funkcije, timeout, drugačiji model | **Dobar fit** — web service 24/7 |
| Chat agent + **SSE** dug stream | Problematično / treba prepis | Radi kao običan Node servis |
| Cena FE Pro | od **$20/mes** + usage | — |
| Cena API | nije 1:1 zamena za Express | **$7** Starter po servisu |

**Zaključak:** Vercel ima smisla kao **zamena za Netlify (frontend)**, ne kao zamena za Render API/agent bez većeg refaktora. Za produkciju ostavi **Render (ili sličan always-on)** za backend.

## Šta staviti u cenovnik / ponudu (jasno razdvoj)

1. **Jednokratno** — razvoj (već 3.800 / 5.000 €)  
2. **Mesečno A — infrastruktura** — stvarni cloud računi (procena 30–70 € + AI)  
3. **Mesečno B — održavanje softvera** — tvoj paušal 80–150 €  

Bez B: samo 30 dana bugfix, posle satnica; cloud i dalje neko plaća.
