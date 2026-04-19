<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const newsList = ref([])
const isCreating = ref(false)
const editingId = ref(null)
const isLoading = ref(false)
const aiBusy = ref(false)
const aiStatusLoading = ref(true)
const aiStatus = ref({
  enabled: false,
  mode: 'disabled',
  provider: 'none',
  reason: 'AI nije aktiviran.'
})
const aiMessage = ref('')
const aiPanelOpen = ref(false)
const sidebarOpen = ref(false)

const form = ref({
  title: '',
  excerpt: '',
  content: '',
  cover_image: '/placeholder.jpg',
  title_en: '',
  excerpt_en: '',
  content_en: '',
  gallery: []
})

const preferredImageRules = [
  'Hero / cover: horizontal kadar, idealno 1600x900 ili vise.',
  'Koristi .jpg, .jpeg ili .webp za fotografije; izbegni screenshot stil.',
  'Glavni motiv drzi u centru kadra zbog responsive crop-a.',
  'Nemoj mesati mnogo razlicitih kolor temperatura u istoj galeriji.',
  'Za jednu vest ciljaj 3 do 8 slika, ne vise od 20.'
]

const coverImageAudit = () => {
  const url = String(form.value.cover_image || '').trim()
  if (!url || url === '/placeholder.jpg') {
    return {
      tone: 'warn',
      message: 'Trenutno je placeholder. Za ozbiljniji utisak ubaci stvarnu naslovnu fotografiju.'
    }
  }

  const lower = url.toLowerCase()
  if (!/\.(jpg|jpeg|png|webp)(\?|$)/.test(lower)) {
    return {
      tone: 'warn',
      message: 'URL nema prepoznatljiv image format. Preporuka: jpg/jpeg/webp.'
    }
  }

  if (/placeholder|dummy|sample/.test(lower)) {
    return {
      tone: 'warn',
      message: 'URL deluje kao privremena slika. Zameni finalnom fotografijom pre objave.'
    }
  }

  return {
    tone: 'ok',
    message: 'Cover image deluje spremno. Proveri jos samo kadar i realnu rezoluciju.'
  }
}

const fetchNews = async () => {
  const token = localStorage.getItem('admin_token')
  const res = await fetch(`${baseUrl}/api/admin/news`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (res.status === 401) {
    router.push('/admin/login')
    return
  }
  newsList.value = await res.json()
}

const fetchAiStatus = async () => {
  aiStatusLoading.value = true
  try {
    const res = await fetch(`${baseUrl}/api/ai/ping`)
    if (!res.ok) {
      aiStatus.value = {
        enabled: false,
        mode: 'disabled',
        provider: 'none',
        reason: 'AI status endpoint nije dostupan.'
      }
      return
    }
    aiStatus.value = await res.json()
  } catch {
    aiStatus.value = {
      enabled: false,
      mode: 'disabled',
      provider: 'none',
      reason: 'AI servis trenutno nije dostupan.'
    }
  } finally {
    aiStatusLoading.value = false
  }
}

onMounted(() => {
  fetchNews()
  fetchAiStatus()
})

const handleLogout = () => {
  localStorage.removeItem('admin_token')
  router.push('/admin/login')
}

const resetForm = () => {
  form.value = {
    title: '',
    excerpt: '',
    content: '',
    cover_image: '/placeholder.jpg',
    title_en: '',
    excerpt_en: '',
    content_en: '',
    gallery: []
  }
  aiMessage.value = ''
}

const startCreate = () => {
  editingId.value = null
  resetForm()
  aiPanelOpen.value = false
  isCreating.value = true
}

const startEdit = async (news) => {
  editingId.value = news.id
  isLoading.value = true

  try {
    const token = localStorage.getItem('admin_token')
    const res = await fetch(`${baseUrl}/api/admin/news/${news.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })

    if (res.status === 401) {
      router.push('/admin/login')
      return
    }

    const detailed = await res.json()
    form.value = {
      title: detailed.title || '',
      excerpt: detailed.excerpt || '',
      content: detailed.content || '',
      cover_image: detailed.cover_image || '/placeholder.jpg',
      title_en: detailed.title_en || '',
      excerpt_en: detailed.excerpt_en || '',
      content_en: detailed.content_en || '',
      gallery: Array.isArray(detailed.gallery)
        ? detailed.gallery.map((item, index) => ({
            image_url: item.image_url || '',
            caption: item.caption || '',
            sort_order: Number(item.sort_order || index + 1)
          }))
        : []
    }
    aiPanelOpen.value = false
    isCreating.value = true
  } finally {
    isLoading.value = false
  }
}

const addGalleryItem = () => {
  form.value.gallery.push({
    image_url: '',
    caption: '',
    sort_order: form.value.gallery.length + 1
  })
}

const removeGalleryItem = (index) => {
  form.value.gallery.splice(index, 1)
  form.value.gallery = form.value.gallery.map((item, idx) => ({
    ...item,
    sort_order: idx + 1
  }))
}

const moveGalleryItem = (index, direction) => {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= form.value.gallery.length) return

  const items = [...form.value.gallery]
  const [item] = items.splice(index, 1)
  items.splice(targetIndex, 0, item)
  form.value.gallery = items.map((entry, idx) => ({
    ...entry,
    sort_order: idx + 1
  }))
}

const removeNews = async (news) => {
  if (!confirm(`Da li ste sigurni da želite da obrišete vest "${news.title}"?`)) return

  const token = localStorage.getItem('admin_token')

  const res = await fetch(`${baseUrl}/api/admin/news/${news.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    alert(data.error || 'Greška pri brisanju vesti.')
    return
  }

  await fetchNews()
}

const translateContent = async () => {
  if (!form.value.title && !form.value.excerpt && !form.value.content) {
    alert("Unesite bar neki tekst na srpskom da bi ga preveli.")
    return
  }
  
  isLoading.value = true
  const token = localStorage.getItem('admin_token')
  
  const translateField = async (text) => {
    if (!text) return ''
    const res = await fetch(`${baseUrl}/api/admin/translate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text, target_lang: 'EN' })
    })
    const data = await res.json()
    return data.translated_text || ''
  }

  try {
    form.value.title_en = await translateField(form.value.title)
    form.value.excerpt_en = await translateField(form.value.excerpt)
    form.value.content_en = await translateField(form.value.content)
  } catch (err) {
    alert("Greška pri prevođenju.")
  } finally {
    isLoading.value = false
  }
}

const callAi = async (path, payload) => {
  const token = localStorage.getItem('admin_token')
  const res = await fetch(`${baseUrl}/api/ai/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  })

  if (res.status === 401 || res.status === 403) {
    router.push('/admin/login')
    return null
  }

  return res.json()
}

const applyAiToFields = async (path, payloadBuilder) => {
  if (!aiStatus.value.enabled) {
    aiMessage.value = 'AI je iskljucen. Nastavite manuelni unos.'
    return
  }

  const fields = ['title', 'excerpt', 'content']
  aiBusy.value = true
  aiMessage.value = ''

  try {
    let changedCount = 0

    for (const fieldName of fields) {
      const text = form.value[fieldName]
      if (!text || !String(text).trim()) continue

      const response = await callAi(path, payloadBuilder(text))
      if (!response) continue

      if (response.fallback || !response.enabled) {
        aiMessage.value = response.message || 'AI fallback je aktivan. Nastavite manuelno.'
        break
      }

      if (response.suggested_text && response.suggested_text !== text) {
        form.value[fieldName] = response.suggested_text
        changedCount += 1
      }
    }

    if (!aiMessage.value) {
      aiMessage.value = changedCount > 0
        ? `AI je azurirao ${changedCount} polja.`
        : 'AI nije predlozio izmene za trenutni tekst.'
    }
  } catch {
    aiMessage.value = 'AI zahtev nije uspeo. Nastavite manuelni unos.'
  } finally {
    aiBusy.value = false
  }
}

const aiProofreadSr = async () => {
  await applyAiToFields('proofread', (text) => ({ text, lang: 'sr' }))
}

const aiRewriteSr = async () => {
  await applyAiToFields('rewrite', (text) => ({ text, lang: 'sr', tone: 'professional' }))
}

const submitNews = async () => {
  if (!form.value.title_en) {
    alert("Morate generisati engleski prevod pre čuvanja!")
    return
  }

  const isEdit = !!editingId.value

  const token = localStorage.getItem('admin_token')
  const res = await fetch(isEdit ? `${baseUrl}/api/admin/news/${editingId.value}` : `${baseUrl}/api/admin/news`, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(form.value)
  })

  if (res.ok) {
    isCreating.value = false
    editingId.value = null
    resetForm()
    fetchNews()
  } else {
    alert(isEdit ? 'Greška pri izmeni vesti.' : 'Greška pri unosu vesti.')
  }
}
</script>

<template>
  <div class="admin-layout">
    <!-- SIDEBAR OVERLAY (mobilni) -->
    <div class="sidebar-overlay" :class="{ active: sidebarOpen }" @click="sidebarOpen = false"></div>

    <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <h2>CMS Panel</h2>
      <nav>
        <router-link to="/admin/vesti" class="active">Вести</router-link>
        <router-link to="/admin/rezervacije">Упити/Резервације</router-link>
        <router-link to="/admin/gosti">Гости и CRM</router-link>
        <router-link to="/admin/mapa-soba">Мапа Соба</router-link>
      </nav>
      <button class="logout-btn" @click="handleLogout">Одјави се</button>
    </aside>
    
    <main class="main-content">
      <!-- MOBILE TOP BAR -->
      <div class="mobile-topbar">
        <button class="burger-admin" @click="sidebarOpen = !sidebarOpen">☰ CMS Panel</button>
      </div>

      <div v-if="!isCreating">
        <div class="page-header">
          <div>
            <h1>Управљање вестима</h1>
            <p class="subtitle">Додај, уреди или обриши вести на порталу.</p>
          </div>
          <button class="add-btn" @click="startCreate">+ Додај Вест</button>
        </div>
        
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Слика</th>
              <th>Наслов (СРП)</th>
              <th>Датум</th>
              <th>Акције</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in newsList" :key="n.id">
              <td>{{ n.id }}</td>
              <td><img :src="n.cover_image" width="50" height="50" style="object-fit:cover;"></td>
              <td>{{ n.title }}</td>
              <td>{{ new Date(n.created_at).toLocaleDateString() }}</td>
              <td>
                <button class="small-btn" @click="startEdit(n)">Измени</button>
                <button class="small-btn danger" @click="removeNews(n)">Обриши</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="form-container">
        <h2>{{ editingId ? `Измена вести #${editingId}` : 'Додавање нове вести' }}</h2>
        <div class="grid-form">
          <div class="lang-col">
            <h3>Српски (Оригинал)</h3>
            <div class="form-group">
              <label>Cover image URL</label>
              <input type="text" v-model="form.cover_image" placeholder="/images/news/my-cover.webp">
            </div>
            <div class="cover-preview-card">
              <img :src="form.cover_image || '/placeholder.jpg'" alt="Cover preview" class="cover-preview-image">
              <div class="cover-preview-copy">
                <strong>Preview</strong>
                <p :class="['cover-audit', coverImageAudit().tone]">{{ coverImageAudit().message }}</p>
              </div>
            </div>
            <div class="form-group">
              <label>Наслов</label>
              <input type="text" v-model="form.title" required>
            </div>
            <div class="form-group">
              <label>Кратак Опис (Excerpt)</label>
              <textarea v-model="form.excerpt" rows="2"></textarea>
            </div>
            <div class="form-group">
              <label>Садржај</label>
              <textarea v-model="form.content" rows="6"></textarea>
            </div>

            <div class="gallery-editor">
              <div class="gallery-editor-header">
                <h4>Galerija vesti</h4>
                <button type="button" class="small-btn" @click="addGalleryItem">+ Dodaj sliku</button>
              </div>

              <div v-if="!form.gallery.length" class="gallery-empty">
                Jos nema dodatih gallery slika. Mozes ostati samo na cover slici ili dodati detalje ispod.
              </div>

              <div v-for="(item, index) in form.gallery" :key="`${index}-${item.image_url}`" class="gallery-item-editor">
                <div class="gallery-item-toolbar">
                  <strong>Slika {{ index + 1 }}</strong>
                  <div class="gallery-item-actions">
                    <button type="button" class="mini-btn" @click="moveGalleryItem(index, -1)" :disabled="index === 0">↑</button>
                    <button type="button" class="mini-btn" @click="moveGalleryItem(index, 1)" :disabled="index === form.gallery.length - 1">↓</button>
                    <button type="button" class="mini-btn danger" @click="removeGalleryItem(index)">×</button>
                  </div>
                </div>

                <input type="text" v-model="item.image_url" placeholder="https://.../gallery-image.webp">
                <input type="text" v-model="item.caption" placeholder="Caption / kratki opis slike">

                <div class="gallery-thumb-row">
                  <img :src="item.image_url || '/placeholder.jpg'" alt="Gallery preview" class="gallery-thumb-preview">
                  <span class="gallery-sort-badge">Redosled: {{ item.sort_order }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="actions-col">
            <div class="actions-stack">
              <button
                type="button"
                class="ai-toggle-btn"
                @click="aiPanelOpen = !aiPanelOpen"
              >
                {{ aiPanelOpen ? '▼ Zatvori AI uređivanje teksta' : '► Otvori AI uređivanje teksta' }}
              </button>

              <div v-if="aiPanelOpen" class="ai-collapsible-panel">
                <div class="ai-status-box" :class="{ 'is-on': aiStatus.enabled, 'is-off': !aiStatus.enabled }">
                  <strong>AI status:</strong>
                  <span v-if="aiStatusLoading">Provera...</span>
                  <span v-else>{{ aiStatus.enabled ? 'Aktivan' : 'Iskljucen' }} ({{ aiStatus.provider }})</span>
                  <small>{{ aiStatus.reason }}</small>
                </div>

                <button class="ai-btn" @click="aiProofreadSr" :disabled="aiBusy || !aiStatus.enabled">
                  {{ aiBusy ? 'AI obrada...' : 'AI lektura (SR)' }}
                </button>

                <button class="ai-btn secondary" @click="aiRewriteSr" :disabled="aiBusy || !aiStatus.enabled">
                  {{ aiBusy ? 'AI obrada...' : 'AI stilizacija (SR)' }}
                </button>

                <p v-if="aiMessage" class="ai-message">{{ aiMessage }}</p>
              </div>

              <button class="translate-btn" @click="translateContent" :disabled="isLoading">
                <span v-if="!isLoading">🌍 ПРЕВЕДИ АУТОМАТСКИ<br><small>(Користи DeepL AI)</small></span>
                <span v-else>Превођење...</span>
              </button>
            </div>
          </div>

          <div class="lang-col">
            <h3>Енглески (Превод)</h3>
            <div class="form-group">
              <label>Title <span style="color:red">*обавезно</span></label>
              <input type="text" v-model="form.title_en" required readonly class="translated-input">
            </div>
            <div class="form-group">
              <label>Excerpt</label>
              <textarea v-model="form.excerpt_en" rows="2" readonly class="translated-input"></textarea>
            </div>
            <div class="form-group">
              <label>Content</label>
              <textarea v-model="form.content_en" rows="6" readonly class="translated-input"></textarea>
            </div>

            <div class="image-guidelines-card">
              <h4>Image standard</h4>
              <p>Cilj je da sajt deluje ujednaceno i profesionalno i bez posebnog AI image processinga.</p>
              <ul>
                <li v-for="rule in preferredImageRules" :key="rule">{{ rule }}</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="secondary-btn" @click="isCreating = false; editingId = null">Одустани</button>
          <button class="primary-btn pulse" @click="submitNews" :disabled="!form.title_en">{{ editingId ? '💾 САЧУВАЈ ИЗМЕНЕ' : '💾 САЧУВАЈ ВЕСТ' }}</button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f5f3f0;
  font-family: inherit;
  position: relative;
}

/* SIDEBAR */
.sidebar {
  width: 250px;
  background: #332317;
  color: white;
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    top: 0; left: 0;
    height: 100vh;
    z-index: 200;
    transform: translateX(-100%);
    width: 240px;
  }
  .sidebar.sidebar-open { transform: translateX(0); }
  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 199;
  }
  .sidebar-overlay.active { display: block; }
  .mobile-topbar {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
  }
  .burger-admin {
    background: #332317;
    color: #cdac91;
    border: none;
    padding: 10px 16px;
    font-size: 0.95rem;
    font-weight: bold;
    cursor: pointer;
    border-radius: 0;
  }
  .main-content { padding: 20px 16px !important; }
  .page-header { flex-direction: column; gap: 12px; }
  .grid-form { flex-direction: column; }
  .actions-col { width: 100%; }
}

@media (min-width: 769px) {
  .mobile-topbar { display: none; }
  .sidebar-overlay { display: none !important; }
}

.sidebar h2 {
  margin-top: 0;
  margin-bottom: 30px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
  padding-bottom: 10px;
  font-size: 1.1rem;
  letter-spacing: 1px;
}
.sidebar nav { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.sidebar nav a {
  color: #ddd;
  text-decoration: none;
  padding: 10px 12px;
  border-radius: 0;
  transition: all 0.2s;
  font-size: 0.95rem;
}
.sidebar nav a.active { background: #cdac91; color: #fff; font-weight: bold; }
.sidebar nav a:hover:not(.active) { background: #fff; color: #332317; }
.logout-btn {
  margin-top: 20px;
  padding: 10px;
  background: transparent;
  color: #cdac91;
  border: 1px solid #cdac91;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s;
}
.logout-btn:hover { background: #cdac91; color: #332317; }

/* MAIN */
.main-content { flex: 1; padding: 40px; overflow-x: auto; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
}
.page-header h1 { margin: 0 0 5px 0; font-size: 1.8rem; color: #332317; }
.subtitle { color: #888; margin: 0; font-size: 0.95rem; }
.add-btn {
  background: #332317;
  color: #fff;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  font-weight: bold;
  transition: opacity 0.2s;
}
.add-btn:hover { opacity: 0.8; }

/* TABLE */
.data-table { width: 100%; border-collapse: collapse; background: white; }
.data-table th {
  background: #332317;
  color: #cdac91;
  padding: 12px 14px;
  text-align: left;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.data-table td { padding: 12px 14px; border-bottom: 1px solid #eee; vertical-align: middle; }
.data-table tr:hover { background: #fdf8f3; }

/* FORM BUTTONS */
.primary-btn { background: #27ae60; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 0; font-weight: bold; }
.primary-btn:disabled { background: #95a5a6; cursor: not-allowed; }
.secondary-btn { background: #aaa; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 0; }
.translate-btn {
  background: #332317;
  color: #cdac91;
  border: none;
  padding: 15px;
  cursor: pointer;
  border-radius: 0;
  width: 100%;
  font-weight: bold;
  transition: opacity 0.2s;
}
.translate-btn:hover { opacity: 0.85; }
.ai-btn {
  width: 100%;
  border: none;
  padding: 12px 14px;
  cursor: pointer;
  background: #1f4f4f;
  color: #e8f6f6;
  font-weight: bold;
  transition: opacity 0.2s;
}
.ai-btn:hover { opacity: 0.9; }
.ai-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.ai-btn.secondary {
  background: #3d3a61;
  color: #e9e6ff;
}
.small-btn { background: #cdac91; color: #332317; border: none; padding: 6px 12px; cursor: pointer; border-radius: 0; margin-right: 5px; font-weight: bold; font-size: 0.82rem; }
.small-btn.danger { background: #e74c3c; color: #fff; }

/* FORM */
.grid-form { display: flex; gap: 20px; margin-top: 20px; }
.lang-col { flex: 1; background: white; padding: 20px; border: 1px solid #e8e0d8; }
.lang-col h3 { margin-top: 0; color: #332317; border-bottom: 2px solid #cdac91; padding-bottom: 8px; }
.actions-col { display: flex; align-items: center; justify-content: center; width: 150px; }
.actions-stack {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-toggle-btn {
  width: 100%;
  border: 1px solid #c7b8a8;
  background: #f5ede4;
  color: #332317;
  font-weight: bold;
  padding: 12px;
  text-align: left;
  cursor: pointer;
}
.ai-collapsible-panel {
  border: 1px solid #ddd;
  background: #fff;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-status-box {
  border: 1px solid #ddd;
  background: #fafafa;
  padding: 10px;
  font-size: 0.82rem;
  color: #3a3a3a;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ai-status-box strong {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.ai-status-box.is-on {
  border-color: #76b28b;
  background: #eef8f0;
}
.ai-status-box.is-off {
  border-color: #d7b27a;
  background: #fff8ed;
}
.ai-message {
  margin: 0;
  font-size: 0.8rem;
  color: #555;
  line-height: 1.3;
}
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 0.88rem; color: #555; }
.form-group input, .form-group textarea { width: 100%; padding: 10px; border: 1px solid #ccc; box-sizing: border-box; border-radius: 0; }
.form-group input:focus, .form-group textarea:focus { outline: none; border-color: #cdac91; }
.translated-input { background: #fffbf5; border-color: #ddd; }
.cover-preview-card {
  display: flex;
  gap: 12px;
  align-items: center;
  border: 1px solid #e6ddd2;
  background: #fcfaf7;
  padding: 12px;
  margin-bottom: 15px;
}
.cover-preview-image {
  width: 112px;
  height: 80px;
  object-fit: cover;
  background: #f1ede8;
  border: 1px solid #ddd;
}
.cover-preview-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cover-audit {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.35;
}
.cover-audit.ok { color: #2f6a43; }
.cover-audit.warn { color: #9a6a1f; }
.gallery-editor {
  margin-top: 20px;
  border-top: 1px solid #eadfce;
  padding-top: 18px;
}
.gallery-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.gallery-editor-header h4,
.image-guidelines-card h4 {
  margin: 0;
  color: #332317;
}
.gallery-empty {
  padding: 12px;
  background: #f8f4ef;
  color: #6a645e;
  font-size: 0.86rem;
  border: 1px dashed #d8ccbe;
}
.gallery-item-editor {
  border: 1px solid #e5ddd4;
  background: #fff;
  padding: 12px;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.gallery-item-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.gallery-item-actions {
  display: flex;
  gap: 6px;
}
.mini-btn {
  border: 1px solid #cdb79e;
  background: #f8efe4;
  color: #332317;
  min-width: 32px;
  height: 32px;
  cursor: pointer;
  font-weight: bold;
}
.mini-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.mini-btn.danger {
  background: #fff0ee;
  border-color: #df9a93;
  color: #b3392e;
}
.gallery-thumb-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.gallery-thumb-preview {
  width: 84px;
  height: 64px;
  object-fit: cover;
  border: 1px solid #ddd;
  background: #f5f2ee;
}
.gallery-sort-badge {
  font-size: 0.8rem;
  color: #665e57;
}
.image-guidelines-card {
  margin-top: 20px;
  border: 1px solid #ddd7cf;
  background: #faf8f5;
  padding: 16px;
}
.image-guidelines-card p {
  margin: 8px 0 10px;
  color: #645d56;
  font-size: 0.86rem;
}
.image-guidelines-card ul {
  padding-left: 18px;
  margin: 0;
  color: #4b4540;
  font-size: 0.84rem;
  line-height: 1.5;
}
.form-actions { margin-top: 30px; display: flex; gap: 15px; justify-content: flex-end; }
.pulse { animation: pulseAnim 2s infinite; }
@keyframes pulseAnim {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
}
</style>
