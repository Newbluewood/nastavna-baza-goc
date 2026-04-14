<script setup>
import { ref, onMounted } from 'vue'
import PageTemplate from '../components/PageTemplate.vue'

const galleryItems = ref([])
const slides = ref([])
const news = ref([])
const isLoading = ref(true)

const pageTitle = ref("БАЗА ГОЧ")
const textContent = ref("")

onMounted(async () => {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/home`);
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
})
</script>

<template>
  <div v-if="isLoading" style="padding: 100px 20px; text-align: center; min-height: 50vh;">
    Учитавам податке са сервера...
  </div>
  <PageTemplate v-else
    :title="pageTitle"
    :slides="slides"
    :textContent="textContent"
    :news="news"
    :galleryItems="galleryItems"
    :gridType="6"
  />
</template>
