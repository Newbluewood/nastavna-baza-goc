<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLangStore } from '../../stores/lang'
import api from '../../services/api'

const langStore = useLangStore()
const themes = ref([])
const isLoading = ref(true)

const fetchThemes = async () => {
  isLoading.value = true
  try {
    themes.value = await api.getThemes()
  } catch (err) {
    console.error('Error fetching themes:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchThemes)
</script>

<template>
  <div class="explore-page">
    <div class="explore-hero" style="background-image: url('/explore-hero.png'); background-size: cover; background-position: center; position: relative;">
      <div class="hero-overlay"></div>
      <div class="container hero-content">
        <h1>{{ langStore.currentLang === 'sr' ? 'Истражи Гоч' : 'Explore Goč' }}</h1>
        <p>{{ langStore.currentLang === 'sr' ? 'Откријте све тајне најшумовитије планине Србије кроз наше тематске водиче.' : 'Discover all the secrets of Serbia\'s most forested mountain through our thematic guides.' }}</p>
      </div>
    </div>

    <div class="container">
      <div v-if="isLoading" class="loading">
        <p>{{ langStore.currentLang === 'sr' ? 'Учитавам теме...' : 'Loading themes...' }}</p>
      </div>
      
      <div v-else class="themes-grid">
        <div v-for="theme in themes" :key="theme.id" class="theme-card">
          <div class="theme-content">
            <div class="theme-icon-container">
              <img :src="theme.icon || '/themes/flora.png'" class="theme-card-icon" />
            </div>
            <h3>{{ theme.name }}</h3>
            <p>{{ langStore.currentLang === 'sr' ? theme.excerpt_sr : theme.excerpt_en }}</p>
            <div class="keywords">
              <span v-for="kw in theme.keywords" :key="kw" class="kw-tag">#{{ kw }}</span>
            </div>
            <router-link :to="`/istrazi/${theme.id}`" class="read-more">
              {{ langStore.currentLang === 'sr' ? 'Сазнај више' : 'Learn more' }} &rarr;
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.explore-page {
  padding-bottom: 60px;
}

.explore-hero {
  color: #fff;
  height: var(--hero-height);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  margin-bottom: 50px;
}

.hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(51, 35, 23, 0.6);
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
}

.explore-hero h1 {
  font-size: 3.5rem;
  margin-bottom: 20px;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.explore-hero p {
  font-size: 1.2rem;
  max-width: 700px;
  margin: 0 auto;
  opacity: 0.9;
  text-align: center;
  line-height: 1.5;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.loading {
  text-align: center;
  padding: 50px;
  font-size: 1.2rem;
  color: #888;
}

.themes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 30px;
}

.theme-card {
  background: #fff;
  border: 1px solid #eee;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  display: flex;
  flex-direction: column;
}

.theme-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.05);
}

.theme-content {
  padding: 30px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.theme-icon-container {
  width: 70px;
  height: 70px;
  background: #fdf8f4;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.theme-card-icon {
  width: 45px;
  height: 45px;
  object-fit: contain;
}

.theme-content h3 {
  font-size: 1.4rem;
  color: #332317;
  margin-bottom: 15px;
}

.theme-content p {
  color: #666;
  line-height: 1.6;
  margin-bottom: 20px;
  flex-grow: 1;
}

.keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.kw-tag {
  font-size: 0.8rem;
  color: #9a714e;
  background: #fdf8f4;
  padding: 4px 10px;
  border-radius: 4px;
}

.read-more {
  display: inline-block;
  font-weight: bold;
  color: #332317;
  text-decoration: none;
  border-bottom: 2px solid #cdac91;
  align-self: flex-start;
  transition: border-color 0.3s;
}

.read-more:hover {
  border-color: #332317;
}

@media (max-width: 1023px) {
  .explore-hero {
    height: var(--hero-height-mobile);
  }
  .explore-hero h1 { font-size: 2rem; }
  .themes-grid { grid-template-columns: 1fr; }
}
</style>
