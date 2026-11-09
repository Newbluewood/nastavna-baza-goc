# Mapa duplikata (pre čišćenja)

**Checkpoint:** `pre-cleanup-2026-11-08` → commit `e5cd2c6`  
Povratak: `git checkout pre-cleanup-2026-11-08` (ili `git reset --hard pre-cleanup-2026-11-08` ako namerno).

Cilj: jedan put mapirati lanac zavisnosti, pa čistiti **jedan klaster po jedan**.

---

## Klaster A — gallery oblik + `openGallery` (VISOK PRIORITET, mali risk)

**Duplikat / neslaganje**

| Gde | Šta |
|-----|-----|
| `backend/controllers/publicController.js` | `gallery = gallery_urls.split(',')` → **string[]** (home, lista, single facility, room) |
| `backend/.../getSingleNews` | gallery = redovi `{ image_url, caption }` |
| `frontend/.../SmestajView.vue` `openGallery` | očekuje `g.image_url` |
| `frontend/.../SmestajSingleView.vue` `openGallery` | **isti** kod (copy-paste) |
| `frontend/.../SingleNewsView.vue` | već radi sa objektima |

**Lanac zavisnosti (ceo)**

```text
MySQL media_gallery
  → publicController (GROUP_CONCAT → split → gallery)
  → JSON API (/api/home, /api/smestaj, /api/smestaj/:id)
  → SmestajView / SmestajSingleView openGallery
  → ImageLightbox (:images string[])
```

**Ko još čita `gallery`**

- SmestajView slide fallback: `facility.gallery?.[0]?.image_url` (takođe pogrešan oblik)
- Admin CMS (`RoomsView` itd.) koristi **druge** endpointe — ne dirati u ovom klasteru

**Predlog jednog poteza:** BE helper `parseGalleryUrls(concat)` → uvek `[{ image_url }]` + jedan FE `collectGalleryImages(item)` util. Ili samo FE: `typeof g === 'string' ? g : g.image_url`.

**Repovi ako se zaboravi:** slide fallback u SmestajView; smoke i dalje prolazi (200) a galerija i dalje prazna.

---

## Klaster B — facility SELECT SQL ×3 u `publicController`

**Duplikat**

Isti SELECT facilities + JOIN translations + GROUP_CONCAT:

1. `getHome` (LIMIT 6, `type='smestaj'`)
2. `getFacilities` (+ subquery `min_price`)
3. `getFacility` (WHERE `id=?`, bez type filter)

Zatim **isti** post-process:

```text
gallery_urls → gallery; delete gallery_urls; localizeFacility
```

**Lanac**

```text
getHome / getFacilities / getFacility
  → isti SQL oblik + localizeFacility/localizeCapacity/localizeBadges
  → FE: HomeView, SmestajView, SmestajSingleView
```

**Predlog:** `selectFacilitiesSql({ where, extras })` + `hydrateFacilityRow(row, lang)`.  
**Ne spajati** home/list/detail u jedan endpoint — samo SQL/helper.

---

## Klaster C — rooms SQL + `meal_info` fallback ×2 (BE)

**Duplikat**

- `getFacility`: `roomsSqlWithMeal` / `roomsSqlWithoutMeal` + `ER_BAD_FIELD_ERROR`
- `admin/crudController.js`: sličan meal_info fallback pri UPDATE/SELECT

**Lanac**

```text
migrateDb ensureColumn meal_info
  → public getFacility (try/catch SQL)
  → admin room CRUD (try/catch)
  → FE SingleView price block (meal_info)
  → chatStayService (čita meal_info, drugi SQL)
```

**Predlog:** ako je migracija uvek pokrenuta u prod, ukloniti WithoutMeal granu (jedan SQL). Proveriti Render start / migrate pre brisanja.

---

## Klaster D — `normalizeJsonArray` ×2

| Fajl | Upotreba |
|------|----------|
| `publicController.js` | badges |
| `chatStayService.js` | stay_tags, badges, weather_tags |

**Predlog:** `backend/utils/jsonArray.js` — jedan export.  
**Zavisnosti:** samo require; nema FE.

---

## Klaster E — SmestajView ↔ SmestajSingleView UI (SREDNJI, veći diff)

**Copy-paste**

- `openGallery` (identična logika) → Klaster A
- CSS: `.facility-card`, `.facility-image-wrapper`, `.img-overlay`, `.inquiry-btn`, plan sobe
- Markup kartice (slika / overlay / capacity / dugmad) — sličan, ne 100% isti (lista=objekat, single=soba + cene + inquiry)
- Amenity mapa **samo** u SingleView (lista nema amenities na kartici)

**Lanac FE**

```text
SmestajView ──openGallery──┐
SmestajSingleView ─────────┼── ImageLightbox
                           └── (Single) InquiryModal + query deep-link
```

**Predlog redosleda:** prvo A (gallery), pa opciono shared `useFacilityGallery()` + CSS partial. **Ne** spajati view-ove u jedan.

---

## Klaster F — i18n ternari (NISKI PRIORITET, široko)

`langStore.currentLang === 'sr' ? … : …` na desetinama mesta.  
Postoji `langStore.t(...)` delimično (InquiryModal).  

**Ne dirati** dok se ne završe A–C; inače ogromni diff bez funkcionalnog dobitka.

---

## Predloženi red čišćenja (jedan po jedan)

1. **A** gallery ugovor — **URAĐENO 2026-11-08** (+ hotfix media URL)
   - BE: `parseConcatGallery` → uvek `[{ image_url }]`
   - FE: `galleryImages.js` + `mediaUrl.js` (`resolveMediaUrl` → API host za `/uploads`)
   - Lightbox: poruka „Slika nije dostupna“ na `@error`
   - Napomena: prazan slot = putanja u DB, fajl nestao (Render disk) ili stari empty red
2. **D** `normalizeJsonArray` — **URAĐENO 2026-11-08** (`utils/jsonArray.js`; amenities u `localizeRoom`)
3. **B** hydrateFacility — **URAĐENO 2026-11-08** (`queryFacilities` + `hydrateFacilityRow` / `hydrateRoomRow`)
4. **C** meal_info — **URAĐENO 2026-11-08** (jedan SQL; migrate ensure rooms+translations; admin fallback skinut)
5. **E** shared CSS — **URAĐENO 2026-11-08** (`assets/facility-cards.css` + `--portrait` / `--landscape`)
6. **F** i18n — **URAĐENO 2026-11-08 (scope: SmestajView + Single)** — `locales.smestaj.*` + `langStore.t()`; ostali FE view-ovi ostaju za kasnije

---

## Šta NIJE duplikat (ne dirati pod „duplikati“)

- `getFacilities` vs `getFacility` — namerno različiti odgovori  
- InquiryModal vs ReservationForm — različiti tokovi  
- Admin CRUD vs public read — različiti ugovori  
- Chat-agent repo — van ovog checkointa
