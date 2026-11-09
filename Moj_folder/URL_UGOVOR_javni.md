# Javni URL ugovor (jedan)

**Pravilo:** detalj stranica = `/{sekcija}/{slug}`. Broj (`id`) je interni; stari bookmark sa brojem sme da radi i redirectuje na slug.

| Sekcija | Kanonski URL | API lookup |
|---------|--------------|------------|
| CMS stranica | `/{slug}` | `GET /api/stranica/:slug` |
| Smeštaj objekat | `/smestaj/{slug}` | `GET /api/smestaj/:slug` (id fallback) |
| Vest | `/vesti/{slug}` | `GET /api/news/:slug` (id fallback) |
| Istraži tema | `/istrazi/{slug}` | `GET /api/themes/:slug` (id fallback) |

JSON: uvek vraćaj i `id` (broj) i `slug` (string). **Ne** maskiraj slug kao `id`.

FE helperi: `frontend/src/utils/publicPaths.js`  
Router 4 praksa (Vue School sažetak + gde je u kodu): `Moj_folder/ROUTER_4_PRAKSA.md`
