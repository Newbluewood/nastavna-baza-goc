<script setup>
import { ref, onMounted } from 'vue'
import AdminSidebar from '../components/AdminSidebar.vue'

const sidebar = ref(null)
const projects = ref([])
const isLoading = ref(true)
const isEditing = ref(false)
const editingId = ref(null)

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const form = ref({ title: '', description: '', status: 'активан', start_date: '' })

const statusOptions = [
  { value: 'активан', label: 'Активан' },
  { value: 'планиран', label: 'Планиран' },
  { value: 'завршен', label: 'Завршен' }
]

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
})

const fetchProjects = async () => {
  isLoading.value = true
  try {
    const res = await fetch(`${baseUrl}/api/admin/projects`, { headers: authHeaders() })
    if (res.ok) projects.value = await res.json()
  } catch (err) {
    console.error('Failed to load projects:', err)
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = { title: '', description: '', status: 'активан', start_date: '' }
  isEditing.value = false
  editingId.value = null
}

const startCreate = () => {
  resetForm()
  isEditing.value = true
}

const startEdit = (project) => {
  form.value = {
    title: project.title,
    description: project.description || '',
    status: project.status || 'активан',
    start_date: project.start_date ? project.start_date.split('T')[0] : ''
  }
  editingId.value = project.id
  isEditing.value = true
}

const saveProject = async () => {
  const method = editingId.value ? 'PUT' : 'POST'
  const url = editingId.value
    ? `${baseUrl}/api/admin/projects/${editingId.value}`
    : `${baseUrl}/api/admin/projects`

  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(form.value)
    })
    if (res.ok) {
      resetForm()
      await fetchProjects()
    } else {
      const data = await res.json()
      alert(data.error || 'Грешка при чувању')
    }
  } catch (err) {
    alert('Грешка: ' + err.message)
  }
}

const deleteProject = async (id) => {
  if (!confirm('Обриши овај пројекат?')) return
  try {
    const res = await fetch(`${baseUrl}/api/admin/projects/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    if (res.ok) await fetchProjects()
  } catch (err) {
    alert('Грешка: ' + err.message)
  }
}

const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

onMounted(() => fetchProjects())
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
          <h1>Управљање пројектима</h1>
          <p class="subtitle">Додај, уреди или обриши пројекте приказане на контакт страници.</p>
        </div>
        <button v-if="!isEditing" class="add-btn" @click="startCreate">+ Додај пројекат</button>
      </div>

      <!-- FORM -->
      <div v-if="isEditing" class="edit-form">
        <h2>{{ editingId ? 'Уреди пројекат' : 'Нови пројекат' }}</h2>
        <div class="form-grid">
          <div class="form-group">
            <label>Наслов *</label>
            <input v-model="form.title" type="text" placeholder="Назив пројекта" />
          </div>
          <div class="form-group">
            <label>Статус</label>
            <select v-model="form.status">
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Датум почетка</label>
            <input v-model="form.start_date" type="date" />
          </div>
          <div class="form-group full-width">
            <label>Опис</label>
            <textarea v-model="form.description" rows="3" placeholder="Кратак опис пројекта"></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button class="save-btn" @click="saveProject">{{ editingId ? 'Сачувај' : 'Креирај' }}</button>
          <button class="cancel-btn" @click="resetForm">Откажи</button>
        </div>
      </div>

      <!-- TABLE -->
      <div v-if="isLoading" class="loading-msg">Учитавам пројекте...</div>
      <table v-else-if="projects.length" class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Наслов</th>
            <th>Статус</th>
            <th>Почетак</th>
            <th>Акције</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in projects" :key="p.id">
            <td>{{ p.id }}</td>
            <td>{{ p.title }}</td>
            <td><span class="status-badge" :class="p.status">{{ p.status }}</span></td>
            <td>{{ formatDate(p.start_date) }}</td>
            <td class="actions-cell">
              <button class="action-btn edit" @click="startEdit(p)">Уреди</button>
              <button class="action-btn delete" @click="deleteProject(p.id)">Обриши</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-msg">Нема пројеката. Додај нови пројекат.</div>
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
.form-group textarea { resize: vertical; }
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

/* TABLE */
.data-table { width: 100%; border-collapse: collapse; background: #fff; }
.data-table th { background: #332317; color: #cdac91; padding: 12px 14px; text-align: left; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; }
.data-table td { padding: 12px 14px; border-bottom: 1px solid #f0ebe5; font-size: 0.9rem; color: #444; }
.data-table tr:hover { background: #fdfaf7; }

.status-badge {
  font-size: 0.75rem; font-weight: 700; padding: 3px 10px; text-transform: uppercase; letter-spacing: 0.5px;
}
.status-badge.активан { background: #e8f5e9; color: #27ae60; }
.status-badge.планиран { background: #fff3e0; color: #e67e22; }
.status-badge.завршен { background: #eceff1; color: #607d8b; }

.actions-cell { display: flex; gap: 6px; }
.action-btn {
  padding: 6px 12px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: bold;
}
.action-btn.edit { background: #e8f5e9; color: #27ae60; }
.action-btn.delete { background: #fde8e8; color: #e74c3c; }
.action-btn:hover { opacity: 0.8; }

.loading-msg, .empty-msg { text-align: center; padding: 40px; color: #999; }
</style>
