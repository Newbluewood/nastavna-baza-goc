<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AdminLayout from '../../components/layout/AdminLayout.vue'
import api from '../../services/api'

const router = useRouter()
const restaurants = ref([])
const menuItems = ref([])
const selectedRestaurantId = ref(null)
const isLoading = ref(false)
const isSaving = ref(false)
const editingItem = ref(null)
const isAddingNew = ref(false)
const isEditingRestaurant = ref(false)

const form = ref({
  name: '',
  category: '',
  description: '',
  price: 0,
  is_available: true,
  sort_order: 0,
  lang: 'sr'
})

const restaurantForm = ref({
  name: '',
  description: '',
  distance_km: 0,
  distance_minutes: 0,
  cover_image: ''
})

const fetchRestaurants = async () => {
  try {
    restaurants.value = await api.getAdminRestaurants()
    if (restaurants.value.length > 0) {
      const first = restaurants.value[0]
      selectedRestaurantId.value = first.id
      setRestaurantForm(first)
    }
  } catch (err) {
    if (err.status === 401) router.push('/admin/login')
    console.error('Failed to load restaurants:', err)
  }
}

const setRestaurantForm = (res) => {
  restaurantForm.value = {
    name: res.name || '',
    description: res.description || '',
    distance_km: res.distance_km || 0,
    distance_minutes: res.distance_minutes || 0,
    cover_image: res.cover_image || ''
  }
}

const fetchMenu = async () => {
  if (!selectedRestaurantId.value) return
  isLoading.value = true
  try {
    menuItems.value = await api.getAdminMenuItems(selectedRestaurantId.value)
    const current = restaurants.value.find(r => r.id === selectedRestaurantId.value)
    if (current) setRestaurantForm(current)
  } catch (err) {
    console.error('Failed to load menu items:', err)
  } finally {
    isLoading.value = false
  }
}

const startEditRestaurant = () => {
  isEditingRestaurant.value = true
}

const cancelEditRestaurant = () => {
  isEditingRestaurant.value = false
  const current = restaurants.value.find(r => r.id === selectedRestaurantId.value)
  if (current) setRestaurantForm(current)
}

const saveRestaurant = async () => {
  isSaving.value = true
  try {
    await api.updateRestaurant(selectedRestaurantId.value, restaurantForm.value)
    isEditingRestaurant.value = false
    // Refresh list to get updated info
    const index = restaurants.value.findIndex(r => r.id === selectedRestaurantId.value)
    if (index !== -1) {
      restaurants.value[index] = { ...restaurants.value[index], ...restaurantForm.value }
    }
  } catch (err) {
    alert(err.data?.error || 'Greška pri čuvanju restorana')
  } finally {
    isSaving.value = false
  }
}

const startEdit = (item) => {
  isAddingNew.value = false
  editingItem.value = item
  form.value = {
    name: item.name || '',
    category: item.category || '',
    description: item.description || '',
    price: item.price || 0,
    is_available: item.is_available === 1 || item.is_available === true,
    sort_order: item.sort_order || 0,
    lang: item.lang || 'sr'
  }
}

const startAdd = () => {
  editingItem.value = null
  isAddingNew.value = true
  form.value = {
    name: '',
    category: '',
    description: '',
    price: 0,
    is_available: true,
    sort_order: menuItems.value.length + 1,
    lang: 'sr'
  }
}

const cancelEdit = () => {
  editingItem.value = null
  isAddingNew.value = false
}

const saveItem = async () => {
  isSaving.value = true
  try {
    if (isAddingNew.value) {
      await api.createMenuItem({
        ...form.value,
        attraction_id: selectedRestaurantId.value
      })
    } else if (editingItem.value) {
      await api.updateMenuItem(editingItem.value.id, form.value)
    }
    
    editingItem.value = null
    isAddingNew.value = false
    await fetchMenu()
  } catch (err) {
    alert(err.data?.error || 'Greška pri čuvanju')
  } finally {
    isSaving.value = false
  }
}

const deleteItem = async (id) => {
  if (!confirm('Da li ste sigurni da želite da obrišete ovu stavku iz menija?')) return
  
  try {
    await api.deleteMenuItem(id)
    await fetchMenu()
  } catch (err) {
    alert(err.data?.error || 'Greška pri brisanju')
  }
}

onMounted(() => {
  fetchRestaurants()
})

watch(selectedRestaurantId, () => {
  fetchMenu()
})
</script>

<template>
  <AdminLayout>
    <div class="page-header">
      <div>
        <h1>Управљање рестораном</h1>
        <p class="subtitle">Уреди јеловник и понуду ресторана.</p>
      </div>
      <button class="add-btn" @click="startAdd" v-if="selectedRestaurantId && !isAddingNew">
        + Додај јело
      </button>
    </div>

    <div class="restaurant-selector" v-if="restaurants.length > 1">
      <label>Одаберите ресторан:</label>
      <select v-model="selectedRestaurantId" class="restaurant-select">
        <option v-for="r in restaurants" :key="r.id" :value="r.id">
          {{ r.name }}
        </option>
      </select>
    </div>

    <div class="restaurant-info-section" v-if="selectedRestaurantId">
      <div v-if="!isEditingRestaurant" class="info-card">
        <div class="info-content">
          <h2>{{ restaurantForm.name }}</h2>
          <p class="description">{{ restaurantForm.description }}</p>
          <div class="meta">
            <span>📍 Удаљеност: {{ restaurantForm.distance_km }}km ({{ restaurantForm.distance_minutes }} min)</span>
          </div>
        </div>
        <button class="edit-res-btn" @click="startEditRestaurant">Уреди основне инфо</button>
      </div>

      <div v-else class="info-edit-form">
        <h3>Уреди основне информације о ресторану</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Назив ресторана</label>
            <input v-model="restaurantForm.name" type="text" />
          </div>
          <div class="form-group">
            <label>Удаљеност (km)</label>
            <input v-model.number="restaurantForm.distance_km" type="number" step="0.1" />
          </div>
          <div class="form-group">
            <label>Минута пешке</label>
            <input v-model.number="restaurantForm.distance_minutes" type="number" />
          </div>
          <div class="form-group full-width">
            <label>Опис</label>
            <textarea v-model="restaurantForm.description" rows="3"></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button class="save-btn" @click="saveRestaurant" :disabled="isSaving">Сачувај</button>
          <button class="cancel-btn" @click="cancelEditRestaurant">Откажи</button>
        </div>
      </div>
    </div>

    <hr class="section-divider" v-if="selectedRestaurantId" />

    <div v-if="isAddingNew" class="item-edit-form new-item-form">
      <h3>Додај ново јело</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>Назив јела</label>
          <input v-model="form.name" type="text" placeholder="npr. Teleća čorba" />
        </div>
        <div class="form-group">
          <label>Категорија</label>
          <input v-model="form.category" type="text" placeholder="npr. Supe i čorbe" />
        </div>
        <div class="form-group">
          <label>Цена (RSD)</label>
          <input v-model.number="form.price" type="number" />
        </div>
        <div class="form-group">
          <label>Редослед</label>
          <input v-model.number="form.sort_order" type="number" />
        </div>
        <div class="form-group">
          <label>Доступно</label>
          <select v-model="form.is_available">
            <option :value="true">Да</option>
            <option :value="false">Не</option>
          </select>
        </div>
        <div class="form-group full-width">
          <label>Опис / Састојци</label>
          <textarea v-model="form.description" rows="2" placeholder="Sastojci, način pripreme..."></textarea>
        </div>
      </div>
      <div class="form-actions">
        <button class="save-btn" @click="saveItem" :disabled="isSaving">
          {{ isSaving ? 'Чувам...' : 'Додај' }}
        </button>
        <button class="cancel-btn" @click="cancelEdit">Откажи</button>
      </div>
    </div>

    <div v-if="isLoading" class="loading-msg">Учитавам мени...</div>

    <div v-else-if="menuItems.length" class="menu-container">
      <div v-for="item in menuItems" :key="item.id" class="menu-card" :class="{ 'is-editing': editingItem?.id === item.id }">
        <div v-if="editingItem?.id !== item.id" class="item-view">
          <div class="item-info">
            <div class="item-top">
              <span class="category-tag">{{ item.category || 'Ostalo' }}</span>
              <span v-if="!item.is_available" class="unavailable-tag">Није доступно</span>
            </div>
            <h3>{{ item.name }}</h3>
            <p v-if="item.description" class="item-desc">{{ item.description }}</p>
            <p class="item-price">{{ item.price ? item.price + ' RSD' : 'Dogovor' }}</p>
          </div>
          <div class="item-actions">
            <button class="edit-btn" @click="startEdit(item)">Уреди</button>
            <button class="delete-btn" @click="deleteItem(item.id)">Обриши</button>
          </div>
        </div>

        <div v-else class="item-edit-form">
          <h3>Уреди: {{ item.name }}</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>Назив јела</label>
              <input v-model="form.name" type="text" />
            </div>
            <div class="form-group">
              <label>Категорија</label>
              <input v-model="form.category" type="text" />
            </div>
            <div class="form-group">
              <label>Цена (RSD)</label>
              <input v-model.number="form.price" type="number" />
            </div>
            <div class="form-group">
              <label>Редослед</label>
              <input v-model.number="form.sort_order" type="number" />
            </div>
            <div class="form-group">
              <label>Доступно</label>
              <select v-model="form.is_available">
                <option :value="true">Да</option>
                <option :value="false">Не</option>
              </select>
            </div>
            <div class="form-group full-width">
              <label>Опис / Састојци</label>
              <textarea v-model="form.description" rows="2"></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button class="save-btn" @click="saveItem" :disabled="isSaving">
              {{ isSaving ? 'Чувам...' : 'Сачувај' }}
            </button>
            <button class="cancel-btn" @click="cancelEdit">Откажи</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="selectedRestaurantId" class="empty-msg">
      Јеловник је празан. 
      <button class="add-btn-inline" @click="startAdd">Додај прву ставку</button>
    </div>
    
    <div v-else class="empty-msg">Није пронађен ниједан ресторан у бази.</div>
  </AdminLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.add-btn {
  background: #2ecc71;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.restaurant-selector {
  background: #fdfaf7;
  border: 1px solid #e8e0d8;
  padding: 20px;
  margin-bottom: 30px;
  display: flex;
  align-items: center;
  gap: 15px;
}
.restaurant-select {
  padding: 10px;
  border: 1px solid #cdac91;
  background: white;
  font-size: 1rem;
  min-width: 250px;
}

.restaurant-info-section {
  margin-bottom: 30px;
}

.info-card {
  background: #fdfaf7;
  border: 1px solid #e8e0d8;
  padding: 25px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.info-content h2 {
  margin: 0 0 10px;
  color: #332317;
}

.info-content .description {
  color: #666;
  line-height: 1.6;
  margin-bottom: 15px;
}

.info-content .meta {
  font-size: 0.9rem;
  font-weight: bold;
  color: #7b5e4a;
}

.edit-res-btn {
  background: white;
  border: 1px solid #cdac91;
  color: #332317;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  white-space: nowrap;
}

.info-edit-form {
  background: #fdfaf7;
  border: 1px solid #cdac91;
  padding: 25px;
  border-radius: 8px;
}

.section-divider {
  border: 0;
  border-top: 1px solid #eee;
  margin: 40px 0;
}

.menu-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.menu-card {
  background: white;
  border: 1px solid #e8e0d8;
  padding: 20px;
  border-radius: 8px;
  transition: all 0.2s;
}
.menu-card.is-editing {
  border-color: #cdac91;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  grid-column: 1 / -1;
}

.item-view {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.item-info {
  flex: 1;
}

.item-top {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
}

.category-tag {
  background: #f0edea;
  color: #7b5e4a;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
}

.unavailable-tag {
  background: #fdeaea;
  color: #c0392b;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: bold;
}

.item-info h3 {
  margin: 0 0 10px;
  color: #332317;
}

.item-desc {
  font-size: 0.9rem;
  color: #666;
  line-height: 1.4;
  margin-bottom: 15px;
}

.item-price {
  font-weight: bold;
  font-size: 1.1rem;
  color: #2c3e50;
}

.item-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edit-btn, .delete-btn {
  padding: 8px 12px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 0.85rem;
  cursor: pointer;
  border: 1px solid #ddd;
}

.edit-btn {
  background: white;
  color: #332317;
}

.delete-btn {
  background: white;
  color: #e74c3c;
  border-color: #fdeaea;
}

.delete-btn:hover {
  background: #e74c3c;
  color: white;
}

/* Form Styles */
.item-edit-form {
  padding: 10px 0;
}

.new-item-form {
  background: white;
  border: 2px solid #2ecc71;
  padding: 25px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  margin-bottom: 6px;
  color: #555;
  font-weight: bold;
}

.form-group input, 
.form-group select, 
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-actions {
  display: flex;
  gap: 10px;
}

.save-btn {
  background: #2ecc71;
  color: white;
  border: none;
  padding: 10px 25px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.cancel-btn {
  background: #95a5a6;
  color: white;
  border: none;
  padding: 10px 25px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

.empty-msg {
  text-align: center;
  padding: 50px;
  background: #f9f9f9;
  border: 2px dashed #ddd;
  border-radius: 8px;
  color: #888;
}

.add-btn-inline {
  display: block;
  margin: 15px auto 0;
  background: #2ecc71;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
  cursor: pointer;
}

@media (max-width: 600px) {
  .menu-container {
    grid-template-columns: 1fr;
  }
}
</style>
