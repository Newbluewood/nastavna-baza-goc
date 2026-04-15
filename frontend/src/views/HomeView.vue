<script setup>
import { ref, onMounted, watch } from 'vue'
import PageTemplate from '../components/PageTemplate.vue'
import { useLangStore } from '../stores/lang'

const galleryItems = ref([])
const slides = ref([])
const news = ref([])
const isLoading = ref(true)

const pageTitle = ref("БАЗА ГОЧ")
const textContent = ref("")

const langStore = useLangStore()

const loadData = async () => {
  isLoading.value = true
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/home?lang=${langStore.currentLang}`);
    const data = await response.json();
    
    if (data) {
      pageTitle.value = data.pageTitle || pageTitle.value
      textContent.value = data.textContent || textContent.value
      slides.value = data.slides || []
      news.value = data.news || []
      galleryItems.value = data.galleryItems || []
    }
  } catch (error) {
    console.error("Error fetching data from API:", error)
    textContent.value = "<p>Подаци се тренутно учитавају са локалног бекенда...</p>"
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
  />
</template>
