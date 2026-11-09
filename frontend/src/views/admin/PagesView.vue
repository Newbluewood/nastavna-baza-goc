<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import HeroSlidesEditor from '../../components/admin/HeroSlidesEditor.vue'
import RichTextEditor from '../../components/admin/RichTextEditor.vue'
import TranslateButton from '../../components/admin/TranslateButton.vue'
import api, { BASE_URL } from '../../services/api'
import { publicPathForSlug, isModulePageSlug } from '../../utils/pageRoutes'

const router = useRouter()
const pages = ref([])
const navItems = ref([])
const isLoading = ref(true)
const isEditing = ref(false)
const editingId = ref(null)
const isUploading = ref(false)
const isReordering = ref(false)

const form = ref({ slug: '', title: '', content: '', hero_image: '', title_en: '', content_en: '' })

const CAROUSEL_SLUGS = ['pocetna', 'smestaj']
const usesCarousel = (slug) => CAROUSEL_SLUGS.includes(slug)

const galleryFacilities = ref([])
const fetchGalleryFacilities = async () => {
  try {
    const all = await api.getAdminFacilities()
    galleryFacilities.value = all.filter((f) => f.type === 'smestaj')
  } catch (err) {
    console.error('Failed to load facilities for gallery preview:', err)
  }
}

const getImageUrl = (url) => {
  if (!url) return '/placeholder.jpg'
  if (url.startsWith('http')) return url
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
  const path = url.startsWith('/') ? url : `/${url}`
  return `${base}${path}`
}

const findNavForPage = (page) => {
  const byId = navItems.value.find((n) => n.page_id === page.id)
  if (byId) return byId
  const path = publicPathForSlug(page.slug)
  return navItems.value.find((n) => n.path === path) || null
}

/** Pages ordered like the public menu; pages without nav row stay at the end. */
const displayPages = computed(() => {
  const withNav = []
  const withoutNav = []
  for (const page of pages.value) {
    const nav = findNavForPage(page)
    if (nav) withNav.push({ page, nav })
    else withoutNav.push({ page, nav: null })
  }
  withNav.sort((a, b) => a.nav.sort_order - b.nav.sort_order || a.nav.id - b.nav.id)
  return [...withNav, ...withoutNav]
})

const handleHeroUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  isUploading.value = true
  try {
    const res = await api.uploadImage(file)
    form.value.hero_image = res.imageUrl
  } catch (err) {
    alert('Greška pri otpremanju slike: ' + err.message)
  } finally {
    isUploading.value = false
  }
}

const loadAll = async () => {
  isLoading.value = true
  try {
    const [pageRows, navRows] = await Promise.all([
      api.getAdminPages(),
      api.getAdminNav(),
    ])
    pages.value = pageRows || []
    navItems.value = navRows || []
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      router.push({ name: 'admin-login' })
      return
    }
    console.error('Failed to load pages/nav:', err)
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = { slug: '', title: '', content: '', hero_image: '', title_en: '', content_en: '' }
  isEditing.value = false
  editingId.value = null
}

const startCreate = () => {
  resetForm()
  isEditing.value = true
}

const startEdit = (page) => {
  form.value = {
    slug: page.slug,
    title: page.title || '',
    content: page.content || '',
    hero_image: page.hero_image || '',
    title_en: page.title_en || '',
    content_en: page.content_en || '',
  }
  editingId.value = page.id
  isEditing.value = true
  if (page.slug === 'pocetna') fetchGalleryFacilities()
}

const savePage = async () => {
  try {
    if (editingId.value) {
      await api.updatePage(editingId.value, form.value)
    } else {
      await api.request('/api/admin/pages', { method: 'POST', body: JSON.stringify(form.value) })
    }
    resetForm()
    await loadAll()
  } catch (err) {
    alert(err.data?.error || 'Greška pri čuvanju')
  }
}

const deletePage = async (id) => {
  if (!confirm('Obriši ovu stranicu?')) return
  try {
    await api.deletePage(id)
    await loadAll()
  } catch (err) {
    alert('Greška: ' + err.message)
  }
}

const toggleNavEnabled = async (row) => {
  if (!row.nav) return
  const next = !row.nav.is_enabled
  try {
    await api.updateNavItem(row.nav.id, {
      label_sr: row.nav.label_sr,
      label_en: row.nav.label_en,
      path: row.nav.path,
      sort_order: row.nav.sort_order,
      is_enabled: next,
    })
    row.nav.is_enabled = next
  } catch (err) {
    alert(err.data?.error || 'Greška pri meniju')
    await loadAll()
  }
}

const moveRow = async (index, direction) => {
  const rows = displayPages.value.filter((row) => row.nav)
  const current = displayPages.value[index]
  if (!current?.nav) return

  const navIndex = rows.findIndex((row) => row.nav.id === current.nav.id)
  const target = navIndex + direction
  if (navIndex < 0 || target < 0 || target >= rows.length) return

  const reordered = rows.map((row) => row.nav.id)
  const [id] = reordered.splice(navIndex, 1)
  reordered.splice(target, 0, id)

  const listed = new Set(reordered)
  for (const item of navItems.value) {
    if (!listed.has(item.id)) reordered.push(item.id)
  }

  isReordering.value = true
  try {
    await api.reorderNav(reordered)
    await loadAll()
  } catch (err) {
    alert(err.data?.error || 'Greška pri redosledu')
    await loadAll()
  } finally {
    isReordering.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <div>
        <h1>Странице и мени</h1>
        <p class="subtitle">
          Sadržaj stranice uređuješ ovde. Redosled ↑↓ i „U meniju“ važe za javni header.
        </p>
      </div>
      <button v-if="!isEditing" class="add-btn" @click="startCreate">+ Додај страницу</button>
    </div>

    <div v-if="isEditing" class="edit-form">
      <h2>{{ editingId ? 'Уреди страницу' : 'Нова страница' }}</h2>
      <div class="form-grid">
        <div class="form-group">
          <label>Наслов *</label>
          <input v-model="form.title" type="text" placeholder="Наслов странице" />
        </div>
        <div class="form-group">
          <label class="label-with-translate">
            Title (EN)
            <TranslateButton :source="form.title" :current="form.title_en" @translated="form.title_en = $event" />
          </label>
          <input v-model="form.title_en" type="text" placeholder="Page title" />
        </div>
        <div class="form-group">
          <label>
            <span class="red-star">*</span> Slug
            <span class="slug-hint"> (latinica a-z, brojevi, crtica. Primer: o-nama → URL /o-nama)</span>
          </label>
          <input v-model="form.slug" type="text" placeholder="npr. o-nama" :disabled="!!editingId" />
          <p v-if="form.slug" class="hint">Javni URL: <code>{{ publicPathForSlug(form.slug) }}</code></p>
        </div>
        <HeroSlidesEditor v-if="usesCarousel(form.slug)" :page-slug="form.slug" />

        <div v-if="form.slug === 'pocetna'" class="form-group full-width gallery-note">
          <label>Галерија (секција испод тема на Почетној)</label>
          <p class="gallery-hint">
            Слике у овој секцији су насловне слике смештајних објеката, не посебна галерија.
            Уређују се у <router-link :to="{ name: 'admin-rooms' }">Уређивање соба</router-link>.
          </p>
          <div class="gallery-preview-strip">
            <div v-for="f in galleryFacilities" :key="f.id" class="gallery-preview-item">
              <img :src="getImageUrl(f.cover_image)" />
              <span>{{ f.name }}</span>
            </div>
          </div>
        </div>
        <div v-else class="form-group full-width">
          <label>Hero slika</label>
          <div class="upload-row">
            <input type="text" v-model="form.hero_image" placeholder="/uploads/image.jpg">
            <label class="upload-btn">
              <input type="file" @change="handleHeroUpload" accept="image/*" style="display:none;">
              <span>{{ isUploading ? '...' : 'Upload' }}</span>
            </label>
          </div>
          <img v-if="form.hero_image" :src="getImageUrl(form.hero_image)" alt="Hero preview" class="hero-preview-image">
        </div>
        <div class="form-group full-width">
          <label>Садржај (СРП)</label>
          <RichTextEditor v-model="form.content" placeholder="Текст странице..." />
        </div>
        <div class="form-group full-width translate-between">
          <TranslateButton html :source="form.content" :current="form.content_en" @translated="form.content_en = $event" />
        </div>
        <div class="form-group full-width">
          <label>Content (EN)</label>
          <RichTextEditor v-model="form.content_en" placeholder="Page content..." />
        </div>
      </div>
      <div v-if="form.content" class="content-preview">
        <label>Преглед:</label>
        <div class="preview-box" v-html="form.content"></div>
      </div>
      <div class="form-actions">
        <button class="save-btn" @click="savePage">{{ editingId ? 'Сачувај' : 'Креирај' }}</button>
        <button class="cancel-btn" @click="resetForm">Откажи</button>
      </div>
    </div>

    <template v-if="!isEditing">
      <div v-if="isLoading" class="loading-msg">Учитавам странице...</div>
      <table v-else-if="displayPages.length" class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Slika</th>
            <th>Slug</th>
            <th>Javni URL</th>
            <th>Tip</th>
            <th>Наслов</th>
            <th>Акције</th>
            <th style="width:110px">Redosled</th>
            <th>U meniju</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in displayPages" :key="row.page.id">
            <td>{{ row.page.id }}</td>
            <td>
              <img :src="getImageUrl(row.page.hero_image)" width="50" height="50" style="object-fit:cover;">
            </td>
            <td><code>{{ row.page.slug }}</code></td>
            <td>
              <a :href="publicPathForSlug(row.page.slug)" target="_blank" rel="noopener" class="public-url-link">
                <code>{{ publicPathForSlug(row.page.slug) }}</code>
              </a>
            </td>
            <td>
              <span v-if="isModulePageSlug(row.page.slug)" class="menu-badge menu-badge--module">modul</span>
              <span v-else class="menu-badge menu-badge--cms">CMS</span>
            </td>
            <td>{{ row.page.title }}</td>
            <td>
              <div class="actions-cell">
                <button type="button" class="action-btn edit" @click="startEdit(row.page)">Уреди</button>
                <button type="button" class="action-btn delete" @click="deletePage(row.page.id)">Обриши</button>
              </div>
            </td>
            <td>
              <div v-if="row.nav" class="order-controls">
                <span class="pos">{{ row.nav.sort_order }}</span>
                <button
                  type="button"
                  class="move-btn"
                  :disabled="isReordering || index === 0 || !displayPages[index - 1]?.nav"
                  @click="moveRow(index, -1)"
                >↑</button>
                <button
                  type="button"
                  class="move-btn"
                  :disabled="isReordering || index >= displayPages.length - 1 || !displayPages[index + 1]?.nav"
                  @click="moveRow(index, 1)"
                >↓</button>
              </div>
              <span v-else class="muted">—</span>
            </td>
            <td class="center">
              <input
                v-if="row.nav"
                type="checkbox"
                :checked="!!row.nav.is_enabled"
                @change="toggleNavEnabled(row)"
              >
              <span v-else class="muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-msg">Нема страница. Додај нову страницу.</div>
    </template>
  </AdminLayout>
</template>

<style scoped>
.form-group.full-width { grid-column: 1 / -1; }
.form-group input:disabled { background: #f0f0f0; color: #888; }
.form-group textarea { resize: vertical; font-family: monospace; font-size: 0.85rem; }
.hint { color: #999; font-size: 0.78rem; }
.content-preview { margin-top: 16px; }
.content-preview label { font-size: 0.85rem; font-weight: 600; color: #555; display: block; margin-bottom: 8px; }
.preview-box { background: #fdfaf7; border: 1px solid #e8ddd2; padding: 20px; max-height: 300px; overflow-y: auto; line-height: 1.7; color: #333; }
.data-table code { background: #f5f0ea; padding: 2px 6px; font-size: 0.85rem; }
.public-url-link { color: var(--color-nav, #332317); text-decoration: none; }
.public-url-link:hover { text-decoration: underline; }
.subtitle { color: #666; max-width: 640px; }
.menu-badge {
  display: inline-block;
  font-size: 0.75rem;
  padding: 2px 8px;
  border: 1px solid #ddd;
}
.menu-badge--cms { background: #eef6ee; border-color: #b7d4b7; color: #2d5a2d; }
.menu-badge--module { background: #f5f0ea; color: #67462e; }
.red-star { color: #e74c3c; font-weight: bold; font-size: 1em; margin-right: 2px; }
.slug-hint { color: #b94a48; font-size: 0.92em; font-weight: 400; font-style: italic; }
.upload-row { display: flex; gap: 8px; }
.upload-row input { flex: 1; }
.upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #332317;
  color: #cdac91;
  padding: 0 15px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.85rem;
}
.hero-preview-image {
  margin-top: 10px;
  width: 220px;
  height: 120px;
  object-fit: cover;
  background: #f1ede8;
  border: 1px solid #ddd;
}
.gallery-note {
  border: 1px dashed #cdac91;
  padding: 16px;
  background: #fdfaf7;
}
.gallery-hint { margin: 0 0 12px; font-size: 0.85rem; color: #666; }
.gallery-hint a { color: #9a714e; font-weight: 600; }
.gallery-preview-strip { display: flex; gap: 10px; flex-wrap: wrap; }
.gallery-preview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 90px;
}
.gallery-preview-item img {
  width: 90px;
  height: 60px;
  object-fit: cover;
  background: #f1ede8;
  border: 1px solid #ddd;
}
.gallery-preview-item span { font-size: 0.7rem; color: #555; text-align: center; }
.order-controls { display: inline-flex; align-items: center; gap: 4px; height: 32px; }
.pos { min-width: 1.25rem; font-weight: 700; line-height: 1; }
.move-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid #cdac91;
  background: #fdfaf7;
  cursor: pointer;
  line-height: 1;
}
.move-btn:disabled { opacity: 0.35; cursor: default; }
.center { text-align: center; }
.muted { color: #aaa; }
</style>
