<script setup>
import { ref, watch, onMounted } from 'vue'
import api, { BASE_URL } from '../../services/api'

const props = defineProps({
  pageSlug: { type: String, required: true }
})

const isLoading = ref(true)
const isUploading = ref(false)
const isEditing = ref(false)
const editingId = ref(null)
const slides = ref([])

const emptyForm = () => ({ title: '', subtitle: '', title_en: '', subtitle_en: '', image_url: '', target_link: '', display_order: 0 })
const form = ref(emptyForm())

const getImageUrl = (url) => {
  if (!url) return '/placeholder.jpg'
  if (url.startsWith('http')) return url
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
  const path = url.startsWith('/') ? url : `/${url}`
  return `${base}${path}`
}

const fetchSlides = async () => {
  isLoading.value = true
  try {
    slides.value = await api.getAdminHeroSlides(props.pageSlug)
  } catch (err) {
    console.error('Failed to load hero slides:', err)
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = emptyForm()
  isEditing.value = false
  editingId.value = null
}

const startCreate = () => {
  resetForm()
  form.value.display_order = slides.value.length
    ? Math.max(...slides.value.map(s => s.display_order || 0)) + 1
    : 0
  isEditing.value = true
}

const startEdit = (slide) => {
  form.value = {
    title: slide.title || '',
    subtitle: slide.subtitle || '',
    title_en: slide.title_en || '',
    subtitle_en: slide.subtitle_en || '',
    image_url: slide.image_url || '',
    target_link: slide.target_link || '',
    display_order: slide.display_order || 0
  }
  editingId.value = slide.id
  isEditing.value = true
}

const handleUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  isUploading.value = true
  try {
    const res = await api.uploadImage(file)
    form.value.image_url = res.imageUrl
  } catch (err) {
    alert('Грешка при отпремању слике: ' + err.message)
  } finally {
    isUploading.value = false
  }
}

const saveSlide = async () => {
  if (!form.value.image_url) { alert('Слика је обавезна.'); return }
  try {
    const payload = { ...form.value, page_slug: props.pageSlug }
    if (editingId.value) {
      await api.updateHeroSlide(editingId.value, payload)
    } else {
      await api.createHeroSlide(payload)
    }
    resetForm()
    await fetchSlides()
  } catch (err) {
    alert(err.data?.error || 'Грешка при чувању')
  }
}

const deleteSlide = async (id) => {
  if (!confirm('Обриши овај слајд?')) return
  try {
    await api.deleteHeroSlide(id)
    await fetchSlides()
  } catch (err) {
    alert('Грешка: ' + err.message)
  }
}

const moveSlide = async (index, direction) => {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= slides.value.length) return
  const a = slides.value[index]
  const b = slides.value[targetIndex]
  try {
    await Promise.all([
      api.updateHeroSlide(a.id, { ...a, display_order: b.display_order }),
      api.updateHeroSlide(b.id, { ...b, display_order: a.display_order })
    ])
    await fetchSlides()
  } catch (err) {
    alert('Грешка при промени редоследа: ' + err.message)
  }
}

onMounted(fetchSlides)
watch(() => props.pageSlug, () => { resetForm(); fetchSlides() })
</script>

<template>
  <div class="hero-slides-editor">
    <div class="editor-header">
      <label>Hero слајдови (карусел)</label>
      <button v-if="!isEditing" type="button" class="add-btn small" @click="startCreate">+ Додај слајд</button>
    </div>

    <!-- FORM -->
    <div v-if="isEditing" class="edit-form nested-form">
      <h3>{{ editingId ? 'Уреди слајд' : 'Нови слајд' }}</h3>
      <div class="form-grid">
        <div class="form-group full-width">
          <label>Слика *</label>
          <div class="upload-row">
            <input type="text" v-model="form.image_url" placeholder="/uploads/image.jpg">
            <label class="upload-btn">
              <input type="file" @change="handleUpload" accept="image/*" style="display:none;">
              <span>{{ isUploading ? '...' : 'Upload' }}</span>
            </label>
          </div>
          <img v-if="form.image_url" :src="getImageUrl(form.image_url)" alt="Slide preview" class="slide-preview-image">
        </div>
        <div class="form-group">
          <label>Наслов (СРП)</label>
          <input v-model="form.title" type="text" placeholder="Наслов слајда" />
        </div>
        <div class="form-group">
          <label>Title (EN)</label>
          <input v-model="form.title_en" type="text" placeholder="Slide title" />
        </div>
        <div class="form-group">
          <label>Поднаслов (СРП)</label>
          <input v-model="form.subtitle" type="text" placeholder="Поднаслов" />
        </div>
        <div class="form-group">
          <label>Subtitle (EN)</label>
          <input v-model="form.subtitle_en" type="text" placeholder="Subtitle" />
        </div>
        <div class="form-group">
          <label>Линк (опционо)</label>
          <input v-model="form.target_link" type="text" placeholder="/smestaj" />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="save-btn" @click="saveSlide">{{ editingId ? 'Сачувај слајд' : 'Креирај слајд' }}</button>
        <button type="button" class="cancel-btn" @click="resetForm">Откажи</button>
      </div>
    </div>

    <!-- LIST -->
    <div v-if="isLoading" class="loading-msg">Учитавам слајдове...</div>
    <div v-else-if="slides.length" class="slides-list">
      <div v-for="(slide, index) in slides" :key="slide.id" class="slide-card">
        <img :src="getImageUrl(slide.image_url)" class="slide-thumb" />
        <div class="slide-info">
          <strong>{{ slide.title || '(без наслова)' }}</strong>
          <span class="slide-subtitle">{{ slide.subtitle }}</span>
          <span class="slide-order">Редослед: {{ slide.display_order }}</span>
        </div>
        <div class="slide-actions">
          <button type="button" class="order-btn" :disabled="index === 0" @click="moveSlide(index, -1)">▲</button>
          <button type="button" class="order-btn" :disabled="index === slides.length - 1" @click="moveSlide(index, 1)">▼</button>
          <button type="button" class="action-btn edit" @click="startEdit(slide)">Уреди</button>
          <button type="button" class="action-btn delete" @click="deleteSlide(slide.id)">Обриши</button>
        </div>
      </div>
    </div>
    <div v-else class="empty-msg">Нема слајдова за ову страну. Додај нови слајд.</div>
  </div>
</template>

<style scoped>
.hero-slides-editor {
  grid-column: 1 / -1;
  border: 1px dashed #cdac91;
  padding: 16px;
  background: #fdfaf7;
}
.editor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.editor-header label { font-size: 0.85rem; font-weight: 600; color: #555; }
.add-btn.small { padding: 6px 14px; font-size: 0.85rem; }

.nested-form { background: #fff; border: 1px solid #e8ddd2; padding: 16px; margin-bottom: 16px; }
.nested-form h3 { margin: 0 0 12px; font-size: 1rem; color: #332317; }

.form-group.full-width { grid-column: 1 / -1; }
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
.slide-preview-image {
  margin-top: 10px;
  width: 220px;
  height: 120px;
  object-fit: cover;
  background: #f1ede8;
  border: 1px solid #ddd;
}

.slides-list { display: flex; flex-direction: column; gap: 10px; }
.slide-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px;
  border: 1px solid #e8ddd2;
  background: #fff;
}
.slide-thumb { width: 90px; height: 54px; object-fit: cover; flex-shrink: 0; }
.slide-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.slide-info strong { color: #332317; }
.slide-subtitle { color: #67462e; font-size: 0.85rem; }
.slide-order { color: #999; font-size: 0.75rem; }
.slide-actions { display: flex; gap: 6px; align-items: center; }
.order-btn {
  background: #fff;
  border: 1px solid #ccc;
  width: 26px;
  height: 26px;
  cursor: pointer;
}
.order-btn:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
