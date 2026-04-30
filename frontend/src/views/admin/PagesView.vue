<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'

const router = useRouter()
const pages = ref([])
const isLoading = ref(true)
const isEditing = ref(false)
const editingId = ref(null)

const form = ref({ slug: '', title: '', content: '' })

const fetchPages = async () => {
  isLoading.value = true
  try {
    pages.value = await api.getAdminPages()
  } catch (err) {
    if (err.status === 401 || err.status === 403) { router.push('/admin/login'); return }
    console.error('Failed to load pages:', err)
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = { slug: '', title: '', content: '' }
  isEditing.value = false
  editingId.value = null
}

const startCreate = () => { resetForm(); isEditing.value = true }

const startEdit = (page) => {
  form.value = { slug: page.slug, title: page.title || '', content: page.content || '' }
  editingId.value = page.id
  isEditing.value = true
}

const savePage = async () => {
  try {
    if (editingId.value) {
      await api.updatePage(editingId.value, form.value)
    } else {
      // Create not in api.js yet — use updatePage with slug-based POST if needed
      await api.request('/api/admin/pages', { method: 'POST', body: JSON.stringify(form.value) })
    }
    resetForm()
    await fetchPages()
  } catch (err) {
    alert(err.data?.error || 'Greška pri čuvanju')
  }
}

const deletePage = async (id) => {
  if (!confirm('Obriši ovu stranicu?')) return
  try {
    await api.deletePage(id)
    await fetchPages()
  } catch (err) {
    alert('Greška: ' + err.message)
  }
}

onMounted(() => fetchPages())
</script>

<template>
  <AdminLayout>
      <div class="page-header">
        <div>
          <h1>Управљање страницама</h1>
          <p class="subtitle">Уреди садржај страница сајта (Едукација, Истраживање, О нама...)</p>
        </div>
        <button v-if="!isEditing" class="add-btn" @click="startCreate">+ Додај страницу</button>
      </div>

      <!-- FORM -->
      <div v-if="isEditing" class="edit-form">
        <h2>{{ editingId ? 'Уреди страницу' : 'Нова страница' }}</h2>
        <div class="form-grid">
          <div class="form-group">
            <label>Наслов *</label>
            <input v-model="form.title" type="text" placeholder="Наслов странице" />
          </div>
          <div class="form-group">
            <label>
              <span class="red-star">*</span> Slug
              <span class="slug-hint"> (mora biti na latinici, bez slova sa kvačicama: š, č, ć, ž, đ. Primer: edukacija)</span>
            </label>
            <input v-model="form.slug" type="text" placeholder="npr. edukacija" :disabled="!!editingId" />
            <small v-if="!editingId" class="hint">URL путања (нпр. edukacija → /edukacija)</small>
          </div>
          <div class="form-group full-width">
            <label>Садржај (HTML)</label>
            <textarea v-model="form.content" rows="12" placeholder="<h2>Наслов секције</h2><p>Текст...</p>"></textarea>
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

      <!-- TABLE -->
      <div v-if="isLoading" class="loading-msg">Учитавам странице...</div>
      <table v-else-if="pages.length" class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Slug</th>
            <th>Наслов</th>
            <th>Акције</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in pages" :key="p.id">
            <td>{{ p.id }}</td>
            <td><code>/{{ p.slug }}</code></td>
            <td>{{ p.title }}</td>
            <td class="actions-cell">
              <button class="action-btn edit" @click="startEdit(p)">Уреди</button>
              <button class="action-btn delete" @click="deletePage(p.id)">Обриши</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-msg">Нема страница. Додај нову страницу.</div>
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
.red-star { color: #e74c3c; font-weight: bold; font-size: 1em; margin-right: 2px; }
.slug-hint { color: #b94a48; font-size: 0.92em; font-weight: 400; font-style: italic; }
</style>
