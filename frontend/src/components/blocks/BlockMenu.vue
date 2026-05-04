<script setup>
import { ref, onMounted, watch } from 'vue'
import api from '../../services/api'
import { useLangStore } from '../../stores/lang'

const props = defineProps({
  restaurantId: [Number, String]
})

const langStore = useLangStore()
const menu = ref([])
const categories = ref([])
const isLoading = ref(true)

const fetchMenu = async () => {
  isLoading.value = true
  try {
    // Ako nemamo restaurantId, uzimamo prvi dostupni restoran
    let id = props.restaurantId
    if (!id) {
       const res = await api.getRestaurantsPublic(langStore.currentLang)
       if (res && res.length > 0) id = res[0].id
    }

    if (id) {
      const data = await api.getRestaurantMenu(id, langStore.currentLang)
      menu.value = data || []
      // Grupisanje po kategorijama
      const cats = [...new Set(menu.value.map(item => item.category))]
      categories.value = cats.map(c => ({
        name: c,
        items: menu.value.filter(i => i.category === c)
      }))
    }
  } catch (err) {
    console.error('Error fetching menu:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchMenu)
watch(() => langStore.currentLang, fetchMenu)
</script>

<template>
  <div class="restaurant-menu-block" v-if="categories.length > 0">
    <div class="menu-container">
      <h2 class="menu-title">
        {{ langStore.currentLang === 'sr' ? 'Јеловник и Карта пића' : 'Menu & Drinks' }}
      </h2>
      
      <div class="categories-grid">
        <div v-for="cat in categories" :key="cat.name" class="menu-category">
          <h3 class="category-name">{{ cat.name }}</h3>
          <div class="items-list">
            <div v-for="item in cat.items" :key="item.id" class="menu-item">
              <div class="item-header">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-dots"></span>
                <span class="item-price">{{ item.price }} RSD</span>
              </div>
              <p v-if="item.description" class="item-desc">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div v-else-if="isLoading" class="menu-loader">
     {{ langStore.currentLang === 'sr' ? 'Učitavam meni...' : 'Loading menu...' }}
  </div>
</template>

<style scoped>
.restaurant-menu-block { padding: 60px 0; background: #fff; }
.menu-container { max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px; }
.menu-title { 
  text-align: center; font-size: 2.2rem; color: #332317; margin-bottom: 50px;
  font-family: "FOF24", sans-serif;
}

.categories-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 40px; }

.menu-category { margin-bottom: 30px; }
.category-name { 
  font-size: 1.4rem; color: #2d5a27; border-bottom: 2px solid #e8ddd2;
  padding-bottom: 10px; margin-bottom: 20px; text-transform: uppercase;
}

.items-list { display: flex; flex-direction: column; gap: 15px; }
.menu-item { display: flex; flex-direction: column; }

.item-header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.item-name { font-weight: bold; color: #332317; font-size: 1rem; }
.item-dots { flex: 1; border-bottom: 1px dotted #ccc; height: 1px; }
.item-price { font-weight: 800; color: #332317; }

.item-desc { font-size: 0.85rem; color: #777; font-style: italic; margin-top: 4px; }

.menu-loader { text-align: center; padding: 40px; color: #888; }

@media (max-width: 768px) {
  .categories-grid { grid-template-columns: 1fr; }
}
</style>
