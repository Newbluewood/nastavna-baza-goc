<script setup>
import { ref, onMounted } from 'vue'
import PageTemplate from '../components/PageTemplate.vue'
import ReservationForm from '../components/ReservationForm.vue'

const slides = ref([])
const facilities = ref([])
const isLoading = ref(true)

const pageTitle = ref("Смештај")
const textContent = ref("")

onMounted(async () => {
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/smestaj`);
    const data = await response.json();
    
    if (data) {
      pageTitle.value = data.pageTitle || pageTitle.value
      textContent.value = data.textContent || textContent.value
      slides.value = data.slides || []
      
      // Map facilities into news format to use the existing UI
      if (data.facilities) {
        facilities.value = data.facilities.map(f => ({
          id: f.id,
          title: f.name,
          excerpt: f.description + (f.capacity ? ' (' + f.capacity + ')' : ''),
          cover_image: f.cover_image,
          link: '/smestaj/' + f.id
        }))
      }
    }
  } catch (error) {
    console.error("Error fetching data from API:", error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div v-if="isLoading" style="padding: 100px 20px; text-align: center; min-height: 50vh;">
    Учитавам објекте...
  </div>
  <PageTemplate v-else
    :title="pageTitle"
    :slides="slides"
    :textContent="textContent"
    :news="facilities"
  />

  <div v-if="!isLoading" style="max-width: var(--content-max-width); margin: 40px auto;">
    <ReservationForm />
  </div>
</template>
