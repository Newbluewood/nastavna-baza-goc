<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'
import { fmt } from '../../utils/dateFormat'

const router = useRouter()
const projects = ref([])
const isLoading = ref(true)
const isEditing = ref(false)
const editingId = ref(null)

const form = ref({ title: '', description: '', status: 'активан', start_date: '' })

const statusOptions = [
  { value: 'активан', label: 'Активан' },
  { value: 'планиран', label: 'Планиран' },
  { value: 'завршен', label: 'Завршен' }
]

const fetchProjects = async () => {
  isLoading.value = true
  try {
    projects.value = await api.getAdminProjects()
  } catch (err) {
    if (err.status === 401 || err.status === 403) { router.push('/admin/login'); return }
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

const startCreate = () => { resetForm(); isEditing.value = true }

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
  try {
    if (editingId.value) {
      await api.updateProject(editingId.value, form.value)
    } else {
      await api.createProject(form.value)
    }
    resetForm()
    await fetchProjects()
  } catch (err) {
    alert(err.data?.error || 'Greška pri čuvanju')
  }
}

const deleteProject = async (id) => {
  if (!confirm('Obriši ovaj projekat?')) return
  try {
    await api.deleteProject(id)
    await fetchProjects()
  } catch (err) {
    alert('Greška: ' + err.message)
  }
}


onMounted(() => fetchProjects())
</script>

<template>
  <AdminLayout>
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
            <td>{{ fmt(p.start_date) }}</td>
            <td class="actions-cell">
              <button class="action-btn edit" @click="startEdit(p)">Уреди</button>
              <button class="action-btn delete" @click="deleteProject(p.id)">Обриши</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-msg">Нема пројеката. Додај нови пројекат.</div>
  </AdminLayout>
</template>
<style scoped>
.form-group.full-width { grid-column: 1 / -1; }
.form-group textarea { resize: vertical; }
.status-badge { font-size: 0.75rem; font-weight: 700; padding: 3px 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.status-badge.активан { background: #e8f5e9; color: #27ae60; }
.status-badge.планиран { background: #fff3e0; color: #e67e22; }
.status-badge.завршен { background: #eceff1; color: #607d8b; }
</style>
