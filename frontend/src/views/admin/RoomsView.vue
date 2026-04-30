<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'

const router = useRouter()
const facilities = ref([])
const rooms = ref([])
const selectedFacilityId = ref(null)
const isLoading = ref(false)
const isSaving = ref(false)
const editingRoom = ref(null)

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
    if (facilities.value.length > 0) {
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
          {{ f.name }} ({{ f.type }})
        </option>
      </select>
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
