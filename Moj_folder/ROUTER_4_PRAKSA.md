# Vue Router 4 — baza znanja (Goč)

Da ne jurimo Vue School / docs ponovo. Ovo je sažetak onoga što smo istražili + kako to stoji u našem FE-u.

## Izvori (kanonski linkovi)

| Šta | URL | Napomena |
|-----|-----|----------|
| **Kurs koji pratimo** | https://vueschool.io/courses/vue-router-4-for-everyone | Vue 3 + Router 4 (~35 lekcija). Ovo je ispravan kurs. |
| Besplatni tekstualni tutorial | https://vueschool.io/articles/vuejs-tutorials/how-to-use-vue-router-a-complete-tutorial/ | Fundamentals, dynamic params, lazy, programmatic nav. |
| Active class lesson | https://vueschool.io/lessons/vue-router-active-class | Korisno, ali deo **starog** kursa. |
| Stari kurs (Vue 2 / Router 3) | https://vueschool.io/courses/vue-router-for-everyone | **Zastareo** — Vue School eksplicitno kaže da ideš na Router 4 kurs. |
| Zvanična docs | https://router.vuejs.org/ | API istina kad se kurs i kod razlikuju. |

**Pravilo:** ako naletiš na “Vue Router for Everyone” bez “4” → to je stari; koristi **Vue Router 4 for Everyone**.

---

## Šta kurs uči (mapa tema)

Iz landing stranice kursa + tutorijala:

### Fundamentals
1. Setup sa Vite: `createRouter` + `createWebHistory`
2. Route objekti: `path`, `name`, `component`
3. History mode (HTML5) vs hash — mi koristimo HTML5 (`createWebHistory`)
4. `RouterLink` (bez full reload) + `RouterView` (gde se renderuje stranica)
5. **Lazy loading:** `component: () => import('...')` → code-split (Vite/Rollup); učitava se tek kad se route poseti
6. **Navigation component** (višerečna imena, npr. `AppNavigation`) — stilovi scoped, active class tu
7. **Active / exact-active class** — RouterLink automatski dodaje klase; može se preimenovati preko `linkActiveClass` / `linkExactActiveClass` u `createRouter`
8. **Dynamic routes:** `/product/:id` → `$route.params` / `useRoute().params`
9. **Named routes:** navigacija `{ name: 'x', params: { ... } }` umesto path stringova
10. **Route props:** `props: true` (ili props fn) — param ide kao Vue prop, ne moraš uvek `useRoute()`
11. Nested routes (parent/children + nested `<RouterView>`) — **kod nas još nije** (nije trebalo za flat URL model)

### Embellishments / advanced (kurs ima; mi delimično)
- Route transitions
- 404 catch-all → kod nas `/:pathMatch(.*)*` + `NotFoundView`
- Navigation guards → kod nas `beforeEach` (admin/guest token)
- Route meta → kod nas `meta.requiresAuth` / `requiresGuestAuth`
- Query params (`?x=1`)
- Composition API: `useRouter` / `useRoute`
- Redirect / alias → kod nas `/stranica/:slug` → `{ name: 'page', ... }`
- Extending RouterLink za externe URL-ove — **nismo radili**

---

## Ključne lekcije (sažeto, da ne otvaramo sajt)

### 1. Named navigation (ne path string)
```js
// loše (krhko kad se path promeni)
router.push(`/smestaj/${slug}`)
<router-link to="/vesti">

// dobro (kurs + naš stil)
router.push({ name: 'smestaj-single', params: { slug } })
<router-link :to="{ name: 'vesti' }">
```

### 2. Lazy load svake page komponente
```js
{
  path: '/smestaj/:slug',
  name: 'smestaj-single',
  component: () => import('../views/public/SmestajSingleView.vue'),
  props: true,
}
```
Ne `import SmestajSingleView from '...'` na vrhu fajla za page view-ove.

### 3. Dynamic param + props
```js
// ruta
{ path: '/vesti/:slug', name: 'single-news', props: true }

// view
const props = defineProps({ slug: { type: String, required: true } })
// koristi props.slug (ne route.params.slug)
```
Props fn kad slug nije u URL-u:
```js
{ path: '/faq', name: 'faq', props: () => ({ slug: 'faq' }) }
```

### 4. Active class (navigation lesson)
- `router-link-active` = prefix match (npr. `/smestaj` aktivan i na `/smestaj/hotel-piramida`)
- `router-link-exact-active` = tačan match
- **Zamka home `/`:** sve putanje “počinju” sa `/` → prefix-active bi držao Početnu uvek aktivnom
- Rešenje kod nas: stilirati exact-active uvek; `router-link-active` **samo ako link nije home** (`.is-home-link`)

```js
// createRouter
linkActiveClass: 'router-link-active',
linkExactActiveClass: 'router-link-exact-active',
```

### 5. Programmatic nav
```js
const router = useRouter()
router.push({ name: 'user', params: { userId: '123' } })
router.push({ path: '/profile', query: { info: 'x' } }) // query OK kad treba
router.replace(...) // bez history entry (canonical slug redirect)
```

### 6. Guards (šablon)
```js
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !token) return { name: 'admin-login' }
  return true
})
```

---

## Gde je to u našem kodu

| Tema | Fajl |
|------|------|
| Sve rute, lazy, names, props, active class, guards, 404, scroll | `frontend/src/router/index.js` |
| Javni meni (named locations + active/exact) | `frontend/src/components/layout/AppNavigation.vue` |
| Shell (logo → `home`, guest → named) | `frontend/src/App.vue` |
| Location helperi (`facilityLocation`, `newsLocation`, `themeLocation`, `locationFromPath`) | `frontend/src/utils/publicPaths.js` |
| URL ugovor (slug, ne id) | `Moj_folder/URL_UGOVOR_javni.md` |
| Admin meni named | `frontend/src/components/layout/AdminSidebar.vue` |
| Detail views sa `props.slug` / `props.token` | `SmestajSingleView`, `SingleNewsView`, `TemaDetailView`, `PageView`, `CancelView`, `ResetPasswordView` |

---

## Šta je urađeno vs šta kurs još nudi

| Kurs | Kod nas |
|------|---------|
| Named routes | Da |
| Lazy routes | Da (page view-ovi) |
| Dynamic `:slug` | Da |
| Route props | Da |
| AppNavigation + active/exact | Da |
| Named `push` / `RouterLink` | Da (javno + admin + guest) |
| 404 | Da |
| Guards + meta | Da (auth) |
| Nested routes / nested layouts | Ne (nije deo URL modela; “nested later” u planu) |
| Route transitions | Ne |
| Custom RouterLink za externe URL | Ne |
| Advanced matching syntax | Ne (nije trebalo) |

---

## Checklist za novu rutu (kopiraj)

1. Dodaj u `router/index.js`: `path`, **`name`**, `() => import(...)`, `props` ako ima param
2. Ako je javni detalj → helper u `publicPaths.js` (`XxxLocation` / `Safe`)
3. Linkovi samo `{ name: '...' }` ili helper — **ne** `` `/${sekcija}/${slug}` `` u view-ovima
4. Ako ulazi u meni → path u `nav_items`; `locationFromPath` već mapira poznate path-ove
5. Reserved slug? → `isReservedPageSlug` / `pageRoutes` (CMS `/:slug` ne sme da pojede `/smestaj` itd.)
6. Canonical: ako API vrati pravi slug a URL ima id → `router.replace({ name, params: { slug } })`

---

## Napomene / zamke koje smo već pecali

1. **Stari Vue School kurs** = Router 3 / Vue 2 API (`exact` prop na linku itd.). U Router 4 nema `exact` prop — koristi CSS klase `*-exact-active`.
2. **Home active** — vidi tačku 4 gore.
3. **`locationFromPath(undefined)`** → tretira kao home; zato `resolveLink` u `PageTemplate` vraća `null` ako nema linka, pa pada na `newsLocationSafe`.
4. Path string helperi (`facilityPublicPath*`) ostaju za testove / rare call sites; **prefer** `*Location*` za navigaciju.
5. Javni URL ugovor je odvojen dokument — routing stil ≠ URL kontrakt, ali rade zajedno.

---

*Ažurirano: 2026-11-09 — Router 4 pass po Vue School + naš FE.*
