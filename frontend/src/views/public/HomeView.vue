<script setup>
import { ref, onMounted, watch } from 'vue'
import PageTemplate from '../../components/layout/PageTemplate.vue'
import { useLangStore } from '../../stores/lang'
import api from '../../services/api'

const galleryItems = ref([])
const slides = ref([])
const news = ref([])
const themes = ref([])
const isLoading = ref(true)

const pageTitle = ref("БАЗА ГОЧ")
const textContent = ref("")

const langStore = useLangStore()

const loadData = async () => {
  isLoading.value = true
  try {
    const data = await api.getHome(langStore.currentLang)
    console.log('Home API response:', data)
    
    if (data) {
      pageTitle.value = data.pageTitle || pageTitle.value
      textContent.value = data.textContent || textContent.value
      news.value = data.news || []
      galleryItems.value = (data.facilities || []).map(facility => ({
        url: facility.cover_image || facility.image || '/placeholder.jpg',
        name: facility.name || facility.type || ''
      }))
      slides.value = (data.slides && data.slides.length > 0)
        ? data.slides
        : news.value.slice(0, 5).map(item => ({
            image_url: item.cover_image || '/placeholder.jpg',
            title: item.title || pageTitle.value,
            subtitle: item.excerpt || ''
          }))
    }
    
    // Fetch themes for highlights
    const allThemes = await api.getThemes()
    themes.value = allThemes.slice(0, 3) // Show top 3
  } catch (error) {
    console.error("Error fetching data from API:", error)
    textContent.value = langStore.currentLang === 'sr'
      ? "<p>Подаци се тренутно учитавају са локалног бекенда...</p>"
      : "<p>Data is currently loading from the local backend...</p>"
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadData()
})

watch(() => langStore.currentLang, () => {
  loadData()
})
</script>

<template>
  <div v-if="isLoading" style="padding: 100px 20px; text-align: center; min-height: 50vh;">
    {{ langStore.currentLang === 'sr' ? 'Учитавам податке са сервера...' : 'Loading data from server...' }}
  </div>
  <PageTemplate v-else
    :title="pageTitle"
    :slides="slides"
    :textContent="textContent"
    :news="news"
    :galleryItems="galleryItems"
    :gridType="6"
    :isCarousel="true"
  >
    <!-- Theme Highlights -->
    <div class="themes-highlight" v-if="themes.length > 0">
      <hr class="section-divider" />
      <h2 style="margin: 30px 0 20px; border-left: 4px solid var(--color-nav); padding-left: 10px;">
        {{ langStore.currentLang === 'sr' ? 'Откријте Гоч' : 'Discover Goč' }}
      </h2>
      <div class="themes-mini-grid">
        <div v-for="theme in themes" :key="theme.id" class="theme-mini-card">
          <div class="mini-icon-container">
             <img :src="theme.icon || '/themes/flora.png'" class="mini-card-icon" />
          </div>
          <h3>{{ theme.name }}</h3>
          <p>{{ langStore.currentLang === 'sr' ? theme.excerpt_sr : theme.excerpt_en }}</p>
          <router-link :to="`/istrazi/${theme.id}`" class="mini-link">
            {{ langStore.currentLang === 'sr' ? 'Опширније' : 'Read more' }} &rarr;
          </router-link>
        </div>
      </div>
      <div style="text-align: center; margin-top: 30px;">
        <router-link to="/istrazi" class="view-all-btn">
          {{ langStore.currentLang === 'sr' ? 'Погледај све теме' : 'View all themes' }}
        </router-link>
      </div>
    </div>
  </PageTemplate>
</template>

<style scoped>
.themes-mini-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}
.theme-mini-card {
  padding: 20px;
  border: 1px solid var(--color-border);
  background: #fdf8f4;
}
.mini-icon-container {
  width: 50px;
  height: 50px;
  background: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
  border: 1px solid var(--c-braon-2);
}
.mini-card-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
.theme-mini-card h3 { margin-bottom: 10px; color: var(--color-nav); }
.theme-mini-card p { font-size: 0.9rem; color: #666; margin-bottom: 15px; }
.mini-link { font-weight: bold; color: var(--color-nav); text-decoration: none; border-bottom: 1px solid var(--color-nav); }
.view-all-btn {
  display: inline-block;
  padding: 10px 30px;
  background: var(--color-nav);
  color: #fff;
  text-decoration: none;
  font-weight: bold;
}
.view-all-btn:hover {
  background: #332317;
}
.section-divider {
  border: 0;
  border-top: 1px solid var(--color-border);
  margin: 40px 0;
}
</style>
