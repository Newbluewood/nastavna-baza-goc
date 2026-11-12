<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'
import { ROLE_LABELS, ROLE_LIST } from '../../auth/permissions'
import { fmt } from '../../utils/dateFormat'

const router = useRouter()
const users = ref([])
const isLoading = ref(true)
const isSaving = ref(false)
const errorMsg = ref('')
const isEditing = ref(false)
const editingId = ref(null)

const form = ref({
  username: '',
  password: '',
  role: 'editor',
})

const fetchUsers = async () => {
  isLoading.value = true
  errorMsg.value = ''
  try {
    users.value = await api.getCmsUsers()
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      router.push({ name: 'admin-login' })
      return
    }
    errorMsg.value = err.data?.error || 'Грешка при учитавању'
  } finally {
    isLoading.value = false
  }
}

const resetForm = () => {
  form.value = { username: '', password: '', role: 'editor' }
  isEditing.value = false
  editingId.value = null
  errorMsg.value = ''
}

const startCreate = () => {
  resetForm()
  isEditing.value = true
}

const startEdit = (user) => {
  form.value = {
    username: user.username,
    password: '',
    role: user.role || 'editor',
  }
  editingId.value = user.id
  isEditing.value = true
  errorMsg.value = ''
}

const saveUser = async () => {
  isSaving.value = true
  errorMsg.value = ''
  try {
    if (editingId.value) {
      const payload = {
        username: form.value.username,
        role: form.value.role,
      }
      if (form.value.password) payload.password = form.value.password
      await api.updateCmsUser(editingId.value, payload)
    } else {
      await api.createCmsUser({
        username: form.value.username,
        password: form.value.password,
        role: form.value.role,
      })
    }
    resetForm()
    await fetchUsers()
  } catch (err) {
    errorMsg.value = err.data?.error || 'Грешка при чувању'
  } finally {
    isSaving.value = false
  }
}

const deleteUser = async (user) => {
  if (!confirm(`Обриши корисника „${user.username}”?`)) return
  try {
    await api.deleteCmsUser(user.id)
    await fetchUsers()
  } catch (err) {
    alert(err.data?.error || err.message)
  }
}

onMounted(() => fetchUsers())
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <div>
        <h1>CMS корисници</h1>
        <p class="subtitle">Улоге: Admin, Editor, Recepcija — права на серверу.</p>
      </div>
      <button class="primary-btn" @click="startCreate" v-if="!isEditing">Нови корисник</button>
    </div>

    <div v-if="isEditing" class="form-card">
      <h3>{{ editingId ? 'Измена корисника' : 'Нови корисник' }}</h3>
      <div class="form-row">
        <label>Корисничко име</label>
        <input v-model="form.username" type="text" minlength="3" required />
      </div>
      <div class="form-row">
        <label>{{ editingId ? 'Нова лозинка (опционо)' : 'Лозинка' }}</label>
        <input v-model="form.password" type="password" :required="!editingId" minlength="6" />
      </div>
      <div class="form-row">
        <label>Улога</label>
        <select v-model="form.role">
          <option v-for="r in ROLE_LIST" :key="r" :value="r">{{ ROLE_LABELS[r] }}</option>
        </select>
      </div>
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      <div class="form-actions">
        <button class="primary-btn" :disabled="isSaving" @click="saveUser">
          {{ isSaving ? 'Чувам...' : 'Сачувај' }}
        </button>
        <button class="ghost-btn" @click="resetForm">Откажи</button>
      </div>
    </div>

    <div v-if="isLoading" class="loading-msg">Учитавам...</div>
    <div v-else class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Корисник</th>
            <th>Улога</th>
            <th>Креиран</th>
            <th>Акције</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td><strong>{{ user.username }}</strong></td>
            <td>{{ ROLE_LABELS[user.role] || user.role }}</td>
            <td class="muted">{{ fmt(user.created_at) }}</td>
            <td class="actions">
              <button class="action-btn" @click="startEdit(user)">Измени</button>
              <button class="action-btn danger" @click="deleteUser(user)">Обриши</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}
.subtitle { color: #666; margin: 6px 0 0; }
.primary-btn {
  background: #332317;
  color: #fff;
  border: none;
  padding: 10px 16px;
  cursor: pointer;
  font-weight: 600;
}
.ghost-btn {
  background: transparent;
  border: 1px solid #999;
  padding: 10px 16px;
  cursor: pointer;
}
.form-card {
  background: #fff;
  border: 1px solid #e5e5e5;
  padding: 20px;
  margin-bottom: 24px;
  max-width: 480px;
}
.form-row { margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px; }
.form-row input, .form-row select {
  padding: 10px;
  border: 1px solid #ccc;
}
.form-actions { display: flex; gap: 10px; margin-top: 8px; }
.error-msg { color: #c62828; }
.loading-msg { color: #666; }
.table-wrapper { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; background: #fff; }
.data-table th, .data-table td {
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid #eee;
}
.muted { color: #777; }
.actions { display: flex; gap: 8px; }
.action-btn {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 6px 10px;
  cursor: pointer;
}
.action-btn.danger { color: #c62828; }
</style>
