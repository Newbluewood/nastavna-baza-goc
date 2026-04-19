<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminSidebar from '../components/AdminSidebar.vue'

const router = useRouter()
const sidebar = ref(null)
const pages = ref([])
const isLoading = ref(true)
const isEditing = ref(false)
const editingId = ref(null)

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const form = ref({ slug: '', title: '', content: '' })

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
})

const fetchPages = async () => {
  isLoading.value = true
  try {
    const res = await fetch(`${baseUrl}/api/admin/pages`, { headers: authHeaders() })
    if (res.status === 401 || res.status === 403) { router.push('/admin/login'); return }
    if (res.ok) pages.value = await res.json()
  } catch (err) {
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

const startCreate = () => {
  resetForm()
  isEditing.value = true
}

const startEdit = (page) => {
  form.value = {
    slug: page.slug,
    title: page.title || '',
    content: page.content || ''
  }
  editingId.value = page.id
  isEditing.value = true
}

const savePage = async () => {
  const method = editingId.value ? 'PUT' : 'POST'
  const url = editingId.value
    ? `${baseUrl}/api/admin/pages/${editingId.value}`
    : `${baseUrl}/api/admin/pages`

  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(form.value)
    })
    if (res.ok) {
      resetForm()
      await fetchPages()
    } else {
      const data = await res.json()
      alert(data.error || 'Грешка при чувању')
    }
  } catch (err) {
    alert('Грешка: ' + err.message)
  }
}

const deletePage = async (id) => {
  if (!confirm('Обриши ову страницу?')) return
  try {
    const res = await fetch(`${baseUrl}/api/admin/pages/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    if (res.ok) await fetchPages()
  } catch (err) {
    alert('Грешка: ' + err.message)
  }
}

onMounted(() => fetchPages())
</script>

<template>
  <div class="admin-layout">
    <AdminSidebar ref="sidebar" />

    <main class="main-content">
      <div class="mobile-topbar">
        <button class="burger-admin" @click="sidebar.sidebarOpen = !sidebar.sidebarOpen">☰ CMS Panel</button>
      </div>

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

@media (max-width: 768px) {
  .mobile-topbar { display: flex; align-items: center; margin-bottom: 20px; }
  .burger-admin { background: #332317; color: #cdac91; border: none; padding: 10px 16px; font-size: 0.95rem; font-weight: bold; cursor: pointer; }
  .main-content { padding: 20px 16px !important; }
  .page-header { flex-direction: column; gap: 12px; }
  .form-grid { grid-template-columns: 1fr !important; }
}
@media (min-width: 769px) {
  .mobile-topbar { display: none; }
}

.main-content { flex: 1; padding: 40px; overflow-x: auto; }

.page-header {
  display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;
}
.page-header h1 { margin: 0 0 5px; font-size: 1.8rem; color: #332317; }
.subtitle { color: #888; margin: 0; font-size: 0.95rem; }

.add-btn {
  background: #332317; color: #fff; border: none; padding: 10px 20px;
  cursor: pointer; font-weight: bold; transition: opacity 0.2s;
}
.add-btn:hover { opacity: 0.85; }

/* FORM */
.edit-form {
  background: #fff; border: 1px solid #e8ddd2; padding: 24px; margin-bottom: 30px;
}
.edit-form h2 { margin: 0 0 20px; font-size: 1.2rem; color: #332317; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group.full-width { grid-column: 1 / -1; }
.form-group label { font-size: 0.85rem; font-weight: 600; color: #555; }
.form-group input, .form-group select, .form-group textarea {
  padding: 10px; border: 1px solid #ddd; font-size: 0.9rem; font-family: inherit;
}
.form-group input:disabled { background: #f0f0f0; color: #888; }
.form-group textarea { resize: vertical; font-family: monospace; font-size: 0.85rem; }
.hint { color: #999; font-size: 0.78rem; }
.form-actions { display: flex; gap: 10px; margin-top: 16px; }
.save-btn {
  background: #332317; color: #fff; border: none; padding: 10px 24px;
  cursor: pointer; font-weight: bold;
}
.save-btn:hover { opacity: 0.85; }
.cancel-btn {
  background: transparent; color: #332317; border: 1px solid #332317; padding: 10px 24px;
  cursor: pointer; font-weight: bold;
}

/* PREVIEW */
.content-preview { margin-top: 16px; }
.content-preview label { font-size: 0.85rem; font-weight: 600; color: #555; display: block; margin-bottom: 8px; }
.preview-box {
  background: #fdfaf7; border: 1px solid #e8ddd2; padding: 20px; max-height: 300px; overflow-y: auto;
  line-height: 1.7; color: #333;
}

/* TABLE */
.data-table { width: 100%; border-collapse: collapse; background: #fff; }
.data-table th { background: #332317; color: #cdac91; padding: 12px 14px; text-align: left; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
.data-table td { padding: 12px 14px; border-bottom: 1px solid #f0ebe5; font-size: 0.9rem; color: #444; }
.data-table tr:hover { background: #fdfaf7; }
.data-table code { background: #f5f0ea; padding: 2px 6px; font-size: 0.85rem; }

.actions-cell { display: flex; gap: 6px; }
.action-btn {
  padding: 6px 12px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: bold;
}
.action-btn.edit { background: #e8f5e9; color: #27ae60; }
.action-btn.delete { background: #fde8e8; color: #e74c3c; }
.action-btn:hover { opacity: 0.8; }

.loading-msg, .empty-msg { text-align: center; padding: 40px; color: #999; }
</style>

.red-star {
  color: #e74c3c;
  font-weight: bold;
  font-size: 1em;
  margin-right: 2px;
}
.slug-hint {
  color: #b94a48;
  font-size: 0.92em;
  font-weight: 400;
  font-style: italic;
}
