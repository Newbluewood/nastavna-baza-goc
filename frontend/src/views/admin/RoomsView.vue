<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api, { BASE_URL } from '../../services/api'

const router = useRouter()
const facilities = ref([])
const rooms = ref([])
const selectedFacilityId = ref(null)
const isLoading = ref(false)
const isSaving = ref(false)
const editingRoom = ref(null)

const isEditingFacility = ref(false)
const isUploadingCover = ref(false)
const facilityForm = ref({ name: '', description: '', cover_image: '' })

const selectedFacility = computed(() => facilities.value.find(f => f.id === selectedFacilityId.value))

const TYPE_LABELS = { smestaj: 'Смештај', restoran: 'Ресторан' }
const typeLabel = (type) => TYPE_LABELS[type] || type

const getImageUrl = (url) => {
  if (!url) return '/placeholder.jpg'
  if (url.startsWith('http')) return url
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
  const path = url.startsWith('/') ? url : `/${url}`
  return `${base}${path}`
}

const startEditFacility = () => {
  if (!selectedFacility.value) return
  facilityForm.value = {
    name: selectedFacility.value.name || '',
    description: selectedFacility.value.description || '',
    cover_image: selectedFacility.value.cover_image || ''
  }
  isEditingFacility.value = true
}

const cancelEditFacility = () => { isEditingFacility.value = false }

const handleCoverUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return
  isUploadingCover.value = true
  try {
    const res = await api.uploadImage(file)
    facilityForm.value.cover_image = res.imageUrl
  } catch (err) {
    alert('Грешка при отпремању слике: ' + err.message)
  } finally {
    isUploadingCover.value = false
  }
}

const saveFacility = async () => {
  isSaving.value = true
  try {
    await api.updateFacility(selectedFacilityId.value, facilityForm.value)
    isEditingFacility.value = false
    await fetchFacilities()
  } catch (err) {
    alert(err.data?.error || 'Грешка при чувању')
  } finally {
    isSaving.value = false
  }
}

const form = ref({
  name: '',
  capacity: '',
  price_base: 0,
  price_half_board: 0,
  price_full_board: 0,
  meal_info: ''
})

const fetchFacilities = async () => {
  try {
    facilities.value = await api.getAdminFacilities()
    if (facilities.value.length > 0 && !selectedFacilityId.value) {
      selectedFacilityId.value = facilities.value[0].id
    }
  } catch (err) {
    if (err.status === 401) router.push('/admin/login')
  }
}

const fetchRooms = async () => {
  if (!selectedFacilityId.value) return
  isLoading.value = true
  try {
    rooms.value = await api.getAdminRooms(selectedFacilityId.value)
  } catch (err) {
    console.error('Failed to load rooms:', err)
  } finally {
    isLoading.value = false
  }
}

const startEdit = (room) => {
  editingRoom.value = room
  form.value = {
    name: room.name || '',
    capacity: room.capacity || '',
    price_base: room.price_base || 0,
    price_half_board: room.price_half_board || 0,
    price_full_board: room.price_full_board || 0,
    meal_info: room.meal_info || ''
  }
}

const cancelEdit = () => {
  editingRoom.value = null
}

const saveRoom = async () => {
  if (!editingRoom.value) return
  isSaving.value = true
  try {
    await api.updateRoom(editingRoom.value.id, form.value)
    editingRoom.value = null
    await fetchRooms()
  } catch (err) {
    alert(err.data?.error || 'Greška pri čuvanju')
  } finally {
    isSaving.value = false
  }
}

onMounted(() => {
  fetchFacilities()
})

watch(selectedFacilityId, () => {
  isEditingFacility.value = false
  fetchRooms()
})
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <div>
        <h1>Управљање смештајем</h1>
        <p class="subtitle">Подеси цене и информације о оброцима за сваку собу.</p>
      </div>
    </div>

    <div class="facility-selector">
      <label>Одаберите објекат:</label>
      <select v-model="selectedFacilityId" class="facility-select">
        <option v-for="f in facilities" :key="f.id" :value="f.id">
          {{ f.name }} ({{ typeLabel(f.type) }})
        </option>
      </select>
    </div>

    <!-- FACILITY BASIC INFO (name, cover image, description) -->
    <div v-if="selectedFacility" class="facility-info-card">
      <div v-if="!isEditingFacility" class="facility-info-view">
        <img :src="getImageUrl(selectedFacility.cover_image)" class="facility-cover-thumb" />
        <div class="facility-info-text">
          <h3>{{ selectedFacility.name }}</h3>
          <p class="facility-desc">{{ selectedFacility.description || 'Нема описа.' }}</p>
          <small class="facility-hint">Ова слика се приказује у галерији на Почетној страни.</small>
        </div>
        <button class="edit-btn" @click="startEditFacility">Уреди назив / слику / опис</button>
      </div>
      <div v-else class="facility-edit-form">
        <h3>Уреди: {{ selectedFacility.name }}</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Назив објекта</label>
            <input v-model="facilityForm.name" type="text" />
          </div>
          <div class="form-group full-width">
            <label>Насловна слика (галерија на Почетној)</label>
            <div class="upload-row">
              <input type="text" v-model="facilityForm.cover_image" placeholder="/uploads/image.jpg">
              <label class="upload-btn">
                <input type="file" @change="handleCoverUpload" accept="image/*" style="display:none;">
                <span>{{ isUploadingCover ? '...' : 'Upload' }}</span>
              </label>
            </div>
            <img v-if="facilityForm.cover_image" :src="getImageUrl(facilityForm.cover_image)" class="facility-cover-preview" />
          </div>
          <div class="form-group full-width">
            <label>Опис</label>
            <textarea v-model="facilityForm.description" rows="3" placeholder="Кратак опис објекта"></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button class="save-btn" :disabled="isSaving" @click="saveFacility">{{ isSaving ? 'Чувам...' : 'Сачувај' }}</button>
          <button class="cancel-btn" @click="cancelEditFacility">Откажи</button>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="loading-msg">Учитавам собе...</div>

    <div v-else-if="rooms.length" class="rooms-container">
      <div v-for="room in rooms" :key="room.id" class="room-card" :class="{ 'is-editing': editingRoom?.id === room.id }">
        <div v-if="editingRoom?.id !== room.id" class="room-view">
          <div class="room-info">
            <h3>{{ room.name }}</h3>
            <p class="room-meta">Капацитет: {{ room.capacity || '—' }}</p>
            <div class="price-grid">
              <div class="price-item">
                <span class="price-label">Основна:</span>
                <span class="price-value">{{ room.price_base }} RSD</span>
              </div>
              <div class="price-item">
                <span class="price-label">Полупансион:</span>
                <span class="price-value">{{ room.price_half_board }} RSD</span>
              </div>
              <div class="price-item">
                <span class="price-label">Пун пансион:</span>
                <span class="price-value">{{ room.price_full_board }} RSD</span>
              </div>
            </div>
            <p v-if="room.meal_info" class="meal-info-text">🍴 {{ room.meal_info }}</p>
          </div>
          <div class="room-actions">
            <button class="edit-btn" @click="startEdit(room)">Уреди цене</button>
          </div>
        </div>

        <div v-else class="room-edit-form">
          <h3>Уреди: {{ room.name }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Назив собе</label>
              <input v-model="form.name" type="text" />
            </div>
            <div class="form-group">
              <label>Капацитет (опис)</label>
              <input v-model="form.capacity" type="text" />
            </div>
            <div class="form-group">
              <label>Основна цена (ноћење)</label>
              <div class="input-with-unit">
                <input v-model.number="form.price_base" type="number" />
                <span>RSD</span>
              </div>
            </div>
            <div class="form-group">
              <label>Цена - Полупансион</label>
              <div class="input-with-unit">
                <input v-model.number="form.price_half_board" type="number" />
                <span>RSD</span>
              </div>
            </div>
            <div class="form-group">
              <label>Цена - Пун пансион</label>
              <div class="input-with-unit">
                <input v-model.number="form.price_full_board" type="number" />
                <span>RSD</span>
              </div>
            </div>
            <div class="form-group full-width">
              <label>Инфо о оброцима (meal_info)</label>
              <textarea v-model="form.meal_info" rows="2" placeholder="npr. Doručak uključen u cenu"></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button class="save-btn" @click="saveRoom" :disabled="isSaving">
              {{ isSaving ? 'Чувам...' : 'Сачувај' }}
            </button>
            <button class="cancel-btn" @click="cancelEdit">Откажи</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-msg">Нема дефинисаних соба за овај објекат.</div>
  </AdminLayout>
</template>

<style scoped>
.facility-selector {
  background: #fdfaf7;
  border: 1px solid #e8e0d8;
  padding: 20px;
  margin-bottom: 30px;
  display: flex;
  align-items: center;
  gap: 15px;
}
.facility-selector label {
  font-weight: bold;
  color: #332317;
}
.facility-select {
  padding: 10px;
  border: 1px solid #cdac91;
  background: white;
  font-size: 1rem;
  min-width: 250px;
}

.facility-info-card {
  background: white;
  border: 1px solid #e8e0d8;
  padding: 20px;
  margin-bottom: 30px;
}
.facility-info-view {
  display: flex;
  align-items: center;
  gap: 20px;
}
.facility-cover-thumb {
  width: 120px;
  height: 80px;
  object-fit: cover;
  flex-shrink: 0;
  background: #f1ede8;
}
.facility-info-text { flex: 1; }
.facility-info-text h3 { margin: 0 0 6px; color: #332317; }
.facility-desc { margin: 0 0 6px; color: #666; font-size: 0.9rem; }
.facility-hint { color: #999; font-size: 0.78rem; }
.facility-edit-form h3 { margin-top: 0; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
.upload-row { display: flex; gap: 8px; }
.upload-row input { flex: 1; padding: 10px; border: 1px solid #ddd; }
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
}
.upload-btn:hover { opacity: 0.85; }
.facility-cover-preview {
  margin-top: 10px;
  width: 220px;
  height: 120px;
  object-fit: cover;
  background: #f1ede8;
  border: 1px solid #ddd;
}

.rooms-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.room-card {
  background: white;
  border: 1px solid #e8e0d8;
  padding: 20px;
  transition: all 0.2s;
}
.room-card.is-editing {
  border-color: #cdac91;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  grid-column: 1 / -1; /* Proširi formu preko celog reda */
}

.room-view {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.room-info h3 {
  margin: 0 0 5px;
  color: #332317;
}
.room-meta {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 15px;
}

.price-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 15px;
}
.price-item {
  display: flex;
  gap: 10px;
  font-size: 0.95rem;
}
.price-label {
  color: #888;
  width: 100px;
}
.price-value {
  font-weight: bold;
  color: #332317;
}

.meal-info-text {
  font-size: 0.85rem;
  font-style: italic;
  color: #4a4a4a;
  background: #f9f9f9;
  padding: 8px;
  border-left: 3px solid #cdac91;
}

.edit-btn {
  background: transparent;
  border: 1px solid #cdac91;
  color: #332317;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.85rem;
}
.edit-btn:hover {
  background: #cdac91;
  color: white;
}

/* Edit Form */
.room-edit-form h3 {
  margin-top: 0;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 20px;
}
.form-group.full-width {
  grid-column: 1 / -1;
}
.form-group label {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 6px;
  color: #555;
}
.form-group input, .form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
}
.input-with-unit {
  display: flex;
  align-items: center;
  gap: 8px;
}
.input-with-unit input {
  flex: 1;
}
.input-with-unit span {
  font-size: 0.85rem;
  color: #888;
}

.form-actions {
  margin-top: 25px;
  display: flex;
  gap: 10px;
}
.save-btn {
  background: #27ae60;
  color: white;
  border: none;
  padding: 10px 25px;
  cursor: pointer;
  font-weight: bold;
}
.cancel-btn {
  background: #aaa;
  color: white;
  border: none;
  padding: 10px 25px;
  cursor: pointer;
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .rooms-container {
    grid-template-columns: 1fr;
  }
}
</style>
