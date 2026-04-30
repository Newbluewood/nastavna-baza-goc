<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api, { BASE_URL } from '../../services/api'

const router = useRouter()
const staff = ref([])
const isLoading = ref(true)
const isEditing = ref(false)
const editingId = ref(null)
const isUploading = ref(false)

const form = ref({ full_name: '', role: '', contact_email: '', photo_url: '' })

const getImageUrl = (url) => {
  if (!url || url.includes('placeholder-staff')) return '/placeholder-staff.png'
  if (url.startsWith('http')) return url
  // Ensure we don't double slash if BASE_URL ends with /
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`
}

const fetchStaff = async () => {
  isLoading.value = true
  try {
    staff.value = await api.getAdminStaff()
  } catch (err) {
    if (err.status === 401 || err.status === 403) { router.push('/admin/login'); return }
    console.error('Failed to load staff:', err)
  } finally {
    isLoading.value = false
  }
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  isUploading.value = true
  try {
    const res = await api.uploadImage(file)
    form.value.photo_url = res.imageUrl
  } catch (err) {
    alert('Грешка при увозу фотографије: ' + err.message)
  } finally {
    isUploading.value = false
  }
}

const resetForm = () => {
  form.value = { full_name: '', role: '', contact_email: '', photo_url: '' }
  isEditing.value = false
  editingId.value = null
}

const startCreate = () => { resetForm(); isEditing.value = true }

const startEdit = (member) => {
  form.value = {
    full_name: member.full_name,
    role: member.role || '',
    contact_email: member.contact_email || '',
    photo_url: member.photo_url || ''
  }
  editingId.value = member.id
  isEditing.value = true
  // Scroll to top of form
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const saveMember = async () => {
  try {
    if (editingId.value) {
      await api.updateStaff(editingId.value, form.value)
    } else {
      await api.createStaff(form.value)
    }
    resetForm()
    await fetchStaff()
  } catch (err) {
    alert(err.data?.error || 'Грешка при чувању')
  }
}

const deleteMember = async (id) => {
  if (!confirm('Обриши овог члана тима?')) return
  try {
    await api.deleteStaff(id)
    await fetchStaff()
  } catch (err) {
    alert('Грешка: ' + err.message)
  }
}

onMounted(() => fetchStaff())
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <div>
        <h1>Управљање особљем</h1>
        <p class="subtitle">Додај, уреди или обриши чланове тима приказане на контакт страници.</p>
      </div>
      <button v-if="!isEditing" class="add-btn" @click="startCreate">+ Додај члана</button>
    </div>

      <!-- FORM -->
      <div v-if="isEditing" class="edit-form">
        <div class="form-header-row">
          <h2>{{ editingId ? 'Уреди члана' : 'Нови члан тима' }}</h2>
          <div class="photo-preview-top">
             <img :src="getImageUrl(form.photo_url)" alt="Staff Preview" class="preview-img" />
             <div class="photo-actions">
                <label class="upload-label">
                  <input type="file" @change="handleFileUpload" accept="image/*" class="file-input" />
                  <span>{{ isUploading ? 'Отпремам...' : 'Промени слику' }}</span>
                </label>
                <p v-if="form.photo_url" class="photo-path">{{ form.photo_url }}</p>
             </div>
          </div>
        </div>

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
            <label>URL фотографије (опционо)</label>
            <input v-model="form.photo_url" type="text" placeholder="Аутоматски се попуњава након увоза..." />
          </div>
        </div>
        <div class="form-actions">
          <button class="save-btn" :disabled="isUploading" @click="saveMember">{{ editingId ? 'Сачувај' : 'Креирај' }}</button>
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
            <td><img :src="getImageUrl(m.photo_url)" class="thumb" /></td>
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
  </AdminLayout>
</template>

<style scoped>
.thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 50%; border: 1px solid #ddd; }

.form-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  gap: 20px;
}

.photo-preview-top {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fdfaf7;
  padding: 12px;
  border-radius: 8px;
  border: 1px dashed #cdac91;
}

.preview-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.photo-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.upload-label {
  display: inline-block;
  background: #332317;
  color: #fff;
  padding: 6px 14px;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: pointer;
  border-radius: 4px;
  text-align: center;
  transition: opacity 0.2s;
}

.upload-label:hover { opacity: 0.85; }
.file-input { display: none; }

.photo-path {
  margin: 0;
  font-size: 0.7rem;
  color: #888;
  max-width: 180px;
  word-break: break-all;
}

@media (max-width: 600px) {
  .form-header-row { flex-direction: column; }
  .photo-preview-top { width: 100%; box-sizing: border-box; }
}
</style>
