<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLangStore } from '../stores/lang'
import PageTemplate from '../components/PageTemplate.vue'
import api from '../services/api.js'

const langStore = useLangStore()
const news = ref([])
const isLoading = ref(true)
const pageData = ref(null)

const fetchNews = async () => {
  isLoading.value = true
  try {
    news.value = await api.getNews()
  } catch (err) {
    console.error('Greška pri učitavanju vesti:', err)
  } finally {
    isLoading.value = false
  }
}

const loadAll = () => {
  fetchNews()
  // Mock page text
  pageData.value = {
    title: langStore.t('nav.news'),
    textContent: langStore.currentLang === 'sr' 
      ? '<p>Пратите најновија дешавања, најаве едукативних програма и вести из Наставне базе Гоч.</p>'
      : '<p>Follow the latest events, educational program announcements, and news from the Goč Teaching Base.</p>'
  }
}

onMounted(loadAll)
watch(() => langStore.currentLang, loadAll)
</script>

<template>
  <div class="vesti-page" v-if="!isLoading">
    <PageTemplate 
      :title="pageData?.title"
      :textContent="pageData?.textContent"
      :news="news"
      :gridType="4"
    />
  </div>
  <div v-else class="loading-state">
     <p>{{ langStore.currentLang === 'sr' ? 'Учитавање...' : 'Loading...' }}</p>
  </div>
</template>

<style scoped>
.loading-state {
  text-align: center;
  padding: 100px 20px;
  color: #888;
  font-size: 1.2rem;
  min-height: 60vh;
}
</style>
