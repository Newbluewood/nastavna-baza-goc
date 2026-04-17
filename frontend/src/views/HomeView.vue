<script setup>
import { ref, onMounted, watch } from 'vue'
import PageTemplate from '../components/PageTemplate.vue'
import { useLangStore } from '../stores/lang'
import api from '../services/api.js'

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
    const data = await api.getHome();
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
