<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api, { BASE_URL } from '../../services/api'

const router = useRouter()
const themes = ref([])
const isLoading = ref(true)
const isEditing = ref(false)
const editingId = ref(null)
const isUploadingIcon = ref(false)
const isUploadingHero = ref(false)

const emptyForm = () => ({
  slug: '', icon: '', hero_image: '', display_order: 0,
  name_sr: '', article_sr: '', name_en: '', article_en: '',
  keywordsText: ''
})
const form = ref(emptyForm())

const getImageUrl = (url) => {
  if (!url) return '/placeholder.jpg'
  if (url.startsWith('http')) return url
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
  const path = url.startsWith('/') ? url : `/${url}`
  return `${base}${path}`
}

const fetchThemes = async () => {
  isLoading.value = true
  try {
    themes.value = await api.getAdminThemes()
  } catch (err) {
    if (err.status === 401 || err.status === 403) { router.push('/admin/login'); return }
    console.error('Failed to load themes:', err)
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = emptyForm()
  isEditing.value = false
  editingId.value = null
}

const startCreate = () => { resetForm(); isEditing.value = true }

const startEdit = async (theme) => {
  try {
    const full = await api.getAdminThemeById(theme.id)
    form.value = {
      slug: full.slug,
      icon: full.icon || '',
      hero_image: full.hero_image || '',
      display_order: full.display_order || 0,
      name_sr: full.name_sr || '',
      article_sr: full.article_sr || '',
      name_en: full.name_en || '',
      article_en: full.article_en || '',
      keywordsText: Array.isArray(full.keywords) ? full.keywords.join(', ') : ''
    }
    editingId.value = full.id
    isEditing.value = true
  } catch (err) {
    alert('Грешка при учитавању теме: ' + err.message)
  }
}

const handleIconUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  isUploadingIcon.value = true
  try {
    const res = await api.uploadImage(file)
    form.value.icon = res.imageUrl
  } catch (err) {
    alert('Грешка при отпремању: ' + err.message)
  } finally {
    isUploadingIcon.value = false
  }
}

const handleHeroUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  isUploadingHero.value = true
  try {
    const res = await api.uploadImage(file)
    form.value.hero_image = res.imageUrl
  } catch (err) {
    alert('Грешка при отпремању: ' + err.message)
  } finally {
    isUploadingHero.value = false
  }
}

const saveTheme = async () => {
  try {
    const keywords = form.value.keywordsText.split(',').map(k => k.trim()).filter(Boolean)
    const payload = { ...form.value, keywords }
    if (editingId.value) {
      await api.updateTheme(editingId.value, payload)
    } else {
      await api.createTheme(payload)
    }
    resetForm()
    await fetchThemes()
  } catch (err) {
    alert(err.data?.error || 'Грешка при чувању')
  }
}

const deleteThemeRow = async (id) => {
  if (!confirm('Обриши ову тему?')) return
  try {
    await api.deleteTheme(id)
    await fetchThemes()
  } catch (err) {
    alert('Грешка: ' + err.message)
  }
}

onMounted(() => fetchThemes())
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <div>
        <h1>Управљање темама (Истражи Гоч)</h1>
        <p class="subtitle">Уреди теме приказане на страни Истражи Гоч. Исти садржај користи и AI асистент за одговоре о темама.</p>
      </div>
      <button v-if="!isEditing" class="add-btn" @click="startCreate">+ Додај тему</button>
    </div>

    <!-- FORM -->
    <div v-if="isEditing" class="edit-form">
      <h2>{{ editingId ? 'Уреди тему' : 'Нова тема' }}</h2>
      <div class="form-grid">
        <div class="form-group">
          <label><span class="red-star">*</span> Slug</label>
          <input v-model="form.slug" type="text" placeholder="npr. biljni_i_zivotinjski_svet" :disabled="!!editingId" />
        </div>
        <div class="form-group">
          <label>Редослед приказа</label>
          <input v-model.number="form.display_order" type="number" />
        </div>
        <div class="form-group">
          <label>Кључне речи (одвојене зарезом)</label>
          <input v-model="form.keywordsText" type="text" placeholder="flora, fauna, Goč, Gvozdac" />
        </div>
        <div class="form-group">
          <label>Икона</label>
          <div class="upload-row">
            <input type="text" v-model="form.icon" placeholder="/themes/flora.png">
            <label class="upload-btn">
              <input type="file" @change="handleIconUpload" accept="image/*" style="display:none;">
              <span>{{ isUploadingIcon ? '...' : 'Upload' }}</span>
            </label>
          </div>
          <img v-if="form.icon" :src="getImageUrl(form.icon)" alt="Icon preview" class="icon-preview-image">
        </div>
        <div class="form-group">
          <label>Hero слика</label>
          <div class="upload-row">
            <input type="text" v-model="form.hero_image" placeholder="/uploads/image.jpg">
            <label class="upload-btn">
              <input type="file" @change="handleHeroUpload" accept="image/*" style="display:none;">
              <span>{{ isUploadingHero ? '...' : 'Upload' }}</span>
            </label>
          </div>
          <img v-if="form.hero_image" :src="getImageUrl(form.hero_image)" alt="Hero preview" class="hero-preview-image">
        </div>
        <div class="form-group">
          <label><span class="red-star">*</span> Наслов (СРП)</label>
          <input v-model="form.name_sr" type="text" placeholder="нпр. Биљни и животињски свет" />
        </div>
        <div class="form-group">
          <label>Title (EN)</label>
          <input v-model="form.name_en" type="text" placeholder="e.g. Flora and Fauna" />
        </div>
        <div class="form-group full-width">
          <label>Чланак (СРП)</label>
          <textarea v-model="form.article_sr" rows="8" placeholder="Текст чланка на српском"></textarea>
        </div>
        <div class="form-group full-width">
          <label>Article (EN)</label>
          <textarea v-model="form.article_en" rows="8" placeholder="Article text in English"></textarea>
        </div>
      </div>
      <div class="form-actions">
        <button class="save-btn" @click="saveTheme">{{ editingId ? 'Сачувај' : 'Креирај' }}</button>
        <button class="cancel-btn" @click="resetForm">Откажи</button>
      </div>
    </div>

    <!-- TABLE -->
    <div v-if="isLoading" class="loading-msg">Учитавам теме...</div>
    <table v-else-if="themes.length" class="data-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Икона</th>
          <th>Slug</th>
          <th>Наслов (СРП)</th>
          <th>Title (EN)</th>
          <th>Акције</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in themes" :key="t.id">
          <td>{{ t.id }}</td>
          <td><img :src="getImageUrl(t.icon)" width="36" height="36" style="object-fit:contain;"></td>
          <td><code>{{ t.slug }}</code></td>
          <td>{{ t.name_sr }}</td>
          <td>{{ t.name_en || '—' }}</td>
          <td class="actions-cell">
            <button class="action-btn edit" @click="startEdit(t)">Уреди</button>
            <button class="action-btn delete" @click="deleteThemeRow(t.id)">Обриши</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty-msg">Нема тема. Додај нову тему.</div>
  </AdminLayout>
</template>

<style scoped>
.form-group.full-width { grid-column: 1 / -1; }
.form-group textarea { resize: vertical; font-family: monospace; font-size: 0.85rem; }
.red-star { color: #e74c3c; font-weight: bold; font-size: 1em; margin-right: 2px; }
.data-table code { background: #f5f0ea; padding: 2px 6px; font-size: 0.85rem; }
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
  transition: opacity 0.2s;
}
.upload-btn:hover { opacity: 0.85; }
.icon-preview-image {
  margin-top: 10px;
  width: 60px;
  height: 60px;
  object-fit: contain;
  background: #f1ede8;
  border: 1px solid #ddd;
}
.hero-preview-image {
  margin-top: 10px;
  width: 220px;
  height: 120px;
  object-fit: cover;
  background: #f1ede8;
  border: 1px solid #ddd;
}
</style>
