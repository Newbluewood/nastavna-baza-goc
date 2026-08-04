<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLangStore } from '../../stores/lang'
import PageTemplate from '../../components/layout/PageTemplate.vue'
import api, { BASE_URL } from '../../services/api'

const getImageUrl = (path) => {
  if (!path) return '/placeholder.jpg'
  if (path.startsWith('http')) return path
  return `${BASE_URL}${path}`
}

const langStore = useLangStore()
const news = ref([])
const isLoading = ref(true)
const pageData = ref(null)

const heroImage = ref(null)

const fetchNews = async () => {
  isLoading.value = true
  try {
    news.value = await api.getNews(langStore.currentLang)
  } catch (err) {
    console.error('Greška pri učitavanju vesti:', err)
  } finally {
    isLoading.value = false
  }
}

const fetchPageData = async () => {
  try {
    const data = await api.getPageBySlug('vesti', langStore.currentLang)
    pageData.value = { title: data.title, textContent: data.content || '' }
    heroImage.value = data.hero_image
  } catch (err) {
    console.error('Greška pri učitavanju sadržaja strane:', err)
    pageData.value = { title: langStore.t('nav.news'), textContent: '' }
  }
}

const loadAll = () => {
  fetchNews()
  fetchPageData()
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
      :slides="[{ image_url: getImageUrl(heroImage), title: pageData?.title }]"
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
