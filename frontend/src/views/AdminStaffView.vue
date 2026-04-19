<script setup>
import { ref, onMounted } from 'vue'
import AdminSidebar from '../components/AdminSidebar.vue'

const sidebar = ref(null)
const staff = ref([])
const isLoading = ref(true)
const isEditing = ref(false)
const editingId = ref(null)

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const form = ref({ full_name: '', role: '', contact_email: '', photo_url: '' })

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
})

const fetchStaff = async () => {
  isLoading.value = true
  try {
    const res = await fetch(`${baseUrl}/api/admin/staff`, { headers: authHeaders() })
    if (res.ok) staff.value = await res.json()
  } catch (err) {
    console.error('Failed to load staff:', err)
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = { full_name: '', role: '', contact_email: '', photo_url: '' }
  isEditing.value = false
  editingId.value = null
}

const startCreate = () => {
  resetForm()
  isEditing.value = true
}

const startEdit = (member) => {
  form.value = {
    full_name: member.full_name,
    role: member.role || '',
    contact_email: member.contact_email || '',
    photo_url: member.photo_url || ''
  }
  editingId.value = member.id
  isEditing.value = true
}

const saveMember = async () => {
  const method = editingId.value ? 'PUT' : 'POST'
  const url = editingId.value
    ? `${baseUrl}/api/admin/staff/${editingId.value}`
    : `${baseUrl}/api/admin/staff`

  try {
    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(form.value)
    })
    if (res.ok) {
      resetForm()
      await fetchStaff()
    } else {
      const data = await res.json()
      alert(data.error || 'Грешка при чувању')
    }
  } catch (err) {
    alert('Грешка: ' + err.message)
  }
}

const deleteMember = async (id) => {
  if (!confirm('Обриши овог члана тима?')) return
  try {
    const res = await fetch(`${baseUrl}/api/admin/staff/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    if (res.ok) await fetchStaff()
  } catch (err) {
    alert('Грешка: ' + err.message)
  }
}

onMounted(() => fetchStaff())
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
          <h1>Управљање особљем</h1>
          <p class="subtitle">Додај, уреди или обриши чланове тима приказане на контакт страници.</p>
        </div>
        <button v-if="!isEditing" class="add-btn" @click="startCreate">+ Додај члана</button>
      </div>

      <!-- FORM -->
      <div v-if="isEditing" class="edit-form">
        <h2>{{ editingId ? 'Уреди члана' : 'Нови члан тима' }}</h2>
        <div class="form-grid">
          <div class="form-group">
            <label>Име и презиме *</label>
            <input v-model="form.full_name" type="text" placeholder="Пуно име" />
          </div>
          <div class="form-group">
            <label>Позиција</label>
            <input v-model="form.role" type="text" placeholder="нпр. Управник базе" />
          </div>
          <div class="form-group">
            <label>Е-маил</label>
            <input v-model="form.contact_email" type="email" placeholder="email@goc.rs" />
          </div>
          <div class="form-group">
            <label>URL фотографије</label>
            <input v-model="form.photo_url" type="text" placeholder="https://..." />
          </div>
        </div>
        <div class="form-actions">
          <button class="save-btn" @click="saveMember">{{ editingId ? 'Сачувај' : 'Креирај' }}</button>
          <button class="cancel-btn" @click="resetForm">Откажи</button>
        </div>
      </div>

      <!-- TABLE -->
      <div v-if="isLoading" class="loading-msg">Учитавам особље...</div>
      <table v-else-if="staff.length" class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Фото</th>
            <th>Име</th>
            <th>Позиција</th>
            <th>Е-маил</th>
            <th>Акције</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in staff" :key="m.id">
            <td>{{ m.id }}</td>
            <td><img v-if="m.photo_url" :src="m.photo_url" class="thumb" /><span v-else>—</span></td>
            <td>{{ m.full_name }}</td>
            <td>{{ m.role || '—' }}</td>
            <td>{{ m.contact_email || '—' }}</td>
            <td class="actions-cell">
              <button class="action-btn edit" @click="startEdit(m)">Уреди</button>
              <button class="action-btn delete" @click="deleteMember(m.id)">Обриши</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-msg">Нема особља. Додај новог члана тима.</div>
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
.form-group label { font-size: 0.85rem; font-weight: 600; color: #555; }
.form-group input {
  padding: 10px; border: 1px solid #ddd; font-size: 0.9rem; font-family: inherit;
}
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
.data-table td { padding: 12px 14px; border-bottom: 1px solid #f0ebe5; font-size: 0.9rem; color: #444; vertical-align: middle; }
.data-table tr:hover { background: #fdfaf7; }

.thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 50%; }

.actions-cell { display: flex; gap: 6px; }
.action-btn {
  padding: 6px 12px; border: none; cursor: pointer; font-size: 0.8rem; font-weight: bold;
}
.action-btn.edit { background: #e8f5e9; color: #27ae60; }
.action-btn.delete { background: #fde8e8; color: #e74c3c; }
.action-btn:hover { opacity: 0.8; }

.loading-msg, .empty-msg { text-align: center; padding: 40px; color: #999; }
</style>
