<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLangStore } from '../../stores/lang'
import api, { BASE_URL } from '../../services/api'
import PageTemplate from '../../components/layout/PageTemplate.vue'

const getImageUrl = (path) => {
  if (!path) return '/placeholder.jpg'
  if (path.startsWith('http')) return path
  return `${BASE_URL}${path}`
}

const langStore = useLangStore()
const restaurants = ref([])
const isLoading = ref(true)
const selectedRestaurant = ref(null)
const menu = ref(null)
const isMenuLoading = ref(false)

const loadRestaurants = async () => {
  isLoading.value = true
  try {
    const data = await api.getRestaurantsPublic(langStore.currentLang)
    restaurants.value = data
  } catch (err) {
    console.error('Error loading restaurants:', err)
  } finally {
    isLoading.value = false
  }
}

const openMenu = async (restaurant) => {
  selectedRestaurant.value = restaurant
  isMenuLoading.value = true
  // Spusti skrol na vrh modala ili onemogući skrol tela
  document.body.style.overflow = 'hidden'
  try {
    const data = await api.getRestaurantMenu(restaurant.id, langStore.currentLang)
    menu.value = data
  } catch (err) {
    console.error('Error loading menu:', err)
  } finally {
    isMenuLoading.value = false
  }
}

const closeMenu = () => {
  selectedRestaurant.value = null
  menu.value = null
  document.body.style.overflow = 'auto'
}

onMounted(loadRestaurants)
watch(() => langStore.currentLang, loadRestaurants)
</script>

<template>
  <PageTemplate
    :title="langStore.t('nav.restaurant')"
    :slides="[{ image_url: '/explore-hero.png', title: langStore.t('nav.restaurant') }]"
  >
    <div class="restaurants-container">
      <div v-if="isLoading" class="loader-container">
        <div class="spinner"></div>
        <p>{{ langStore.t('common.loading') }}</p>
      </div>
      
      <div v-else class="restaurants-grid">
        <div v-for="res in restaurants" :key="res.id" class="restaurant-card" @click="openMenu(res)">
          <div class="card-image">
            <img :src="getImageUrl(res.cover_image)" alt="Restaurant">
            <div class="card-overlay">
               <span class="view-menu-badge">{{ langStore.currentLang === 'sr' ? 'ПОГЛЕДАЈ МЕНИ' : 'VIEW MENU' }}</span>
            </div>
          </div>
          <div class="card-content">
            <h3>{{ res.name }}</h3>
            <p class="desc">{{ res.description }}</p>
            <div class="meta">
               <span v-if="res.distance_km" class="meta-item">📍 {{ res.distance_km }}km</span>
               <span v-if="res.distance_minutes" class="meta-item">⏱️ {{ res.distance_minutes }} min</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Menu Modal -->
      <transition name="fade">
        <div v-if="selectedRestaurant" class="menu-modal" @click.self="closeMenu">
          <div class="modal-content">
            <button class="close-btn" @click="closeMenu">&times;</button>
            
            <div class="modal-header">
              <h2>{{ selectedRestaurant.name }}</h2>
              <div class="header-divider"></div>
              <p class="subtitle">{{ langStore.currentLang === 'sr' ? 'ДОМАЋИ СПЕЦИЈАЛИТЕТИ' : 'TRADITIONAL SPECIALTIES' }}</p>
            </div>

            <div v-if="isMenuLoading" class="loader-container">
              <div class="spinner"></div>
            </div>

            <div v-else-if="menu" class="menu-sections">
              <div v-for="(items, cat) in menu" :key="cat" class="menu-section">
                <h4 class="category-title">{{ cat.toUpperCase() }}</h4>
                <div class="menu-items">
                  <div v-for="item in items" :key="item.id" class="menu-item">
                    <div class="item-main">
                      <span class="item-name">{{ item.name }}</span>
                      <span class="item-dots"></span>
                      <span class="item-price">{{ item.price }} <small>RSD</small></span>
                    </div>
                    <p class="item-desc" v-if="item.description">{{ item.description }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-footer">
               <p>{{ langStore.currentLang === 'sr' ? '* Све цене су изражене у РСД' : '* All prices are in RSD' }}</p>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </PageTemplate>
</template>

<style scoped>
.restaurants-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.loader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(51, 35, 23, 0.1);
  border-top: 4px solid var(--color-nav);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.restaurants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 30px;
}

.restaurant-card {
  background: white;
  border-radius: 0;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
  cursor: pointer;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border: 1px solid #eee;
}

.restaurant-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(0,0,0,0.1);
}

.card-image {
  position: relative;
  height: 250px;
  overflow: hidden;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.restaurant-card:hover .card-image img {
  transform: scale(1.1);
}

.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(51, 35, 23, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.restaurant-card:hover .card-overlay {
  opacity: 1;
}

.view-menu-badge {
  color: white;
  padding: 12px 24px;
  border: 2px solid white;
  font-weight: bold;
  letter-spacing: 2px;
  background: rgba(0,0,0,0.2);
}

.card-content {
  padding: 25px;
}

.card-content h3 {
  margin: 0 0 10px 0;
  font-size: 1.6rem;
  color: var(--color-nav);
}

.desc {
  color: #666;
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 20px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  display: flex;
  gap: 15px;
  border-top: 1px solid #f0f0f0;
  padding-top: 15px;
}

.meta-item {
  font-size: 0.85rem;
  font-weight: bold;
  color: #888;
}

/* Modal Styles */
.menu-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(51, 35, 23, 0.85);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal-content {
  background: #fff;
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  padding: 50px;
  box-shadow: 0 25px 50px rgba(0,0,0,0.3);
  background-image: url("https://www.transparenttextures.com/patterns/natural-paper.png");
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 25px;
  background: none;
  border: none;
  font-size: 2.5rem;
  color: #332317;
  cursor: pointer;
  line-height: 1;
  transition: transform 0.2s ease;
}

.close-btn:hover {
  transform: rotate(90deg);
}

.modal-header {
  text-align: center;
  margin-bottom: 50px;
}

.modal-header h2 {
  font-size: 2.2rem;
  color: #332317;
  margin: 0 0 10px 0;
  font-family: 'Playfair Display', serif;
}

.header-divider {
  width: 60px;
  height: 3px;
  background: var(--color-nav);
  margin: 0 auto 15px;
}

.subtitle {
  font-size: 0.9rem;
  letter-spacing: 3px;
  color: #888;
  font-weight: bold;
}

.menu-section {
  margin-bottom: 40px;
}

.category-title {
  font-size: 1.1rem;
  color: var(--color-nav);
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 10px;
  margin-bottom: 20px;
  letter-spacing: 1px;
}

.menu-item {
  margin-bottom: 15px;
}

.item-main {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.item-name {
  font-weight: bold;
  color: #332317;
  font-size: 1.05rem;
}

.item-dots {
  flex: 1;
  border-bottom: 1px dotted #ccc;
  height: 0;
  margin: 0 5px;
}

.item-price {
  font-weight: bold;
  color: var(--color-nav);
}

.item-desc {
  font-size: 0.85rem;
  color: #777;
  font-style: italic;
  margin: 2px 0 0 0;
}

.modal-footer {
  text-align: center;
  margin-top: 40px;
  color: #999;
  font-size: 0.8rem;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

@media (max-width: 640px) {
  .modal-content {
    padding: 30px 20px;
  }
  .modal-header h2 {
    font-size: 1.8rem;
  }
  .item-name {
    font-size: 0.95rem;
  }
}
</style>
