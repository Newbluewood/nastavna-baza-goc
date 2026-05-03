<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLangStore } from '../../stores/lang'
import PageTemplate from '../../components/layout/PageTemplate.vue'
import api, { BASE_URL } from '../../services/api'

const getImageUrl = (path) => {
  if (!path) return '/placeholder.jpg'
  if (path.startsWith('http')) return path
  return `${BASE_URL}${path}`
}

const route = useRoute()
const langStore = useLangStore()
const pageData = ref(null)
const isLoading = ref(true)
const notFound = ref(false)

const fetchPage = async () => {
  const currentSlug = route.meta.pageSlug
  if (!currentSlug) return

  isLoading.value = true
  notFound.value = false
  try {
    const data = await api.getPageBySlug(currentSlug, langStore.currentLang)
    pageData.value = data
  } catch (err) {
    console.error('Error loading page:', err)
    notFound.value = true
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchPage)
watch(() => langStore.currentLang, fetchPage)
watch(() => route.meta.pageSlug, fetchPage)
</script>

<template>
  <div v-if="isLoading" class="page-loading">
    <p>Учитавам...</p>
  </div>
  <div v-else-if="notFound" class="page-not-found">
    <div class="content-box">
      <div class="big-icon">🚧</div>
      <h1>{{ langStore.currentLang === 'sr' ? 'Страница је у припреми' : 'Page coming soon' }}</h1>
      <p>{{ langStore.currentLang === 'sr' ? 'Ова секција је тренутно у припреми. Ускоро ће бити доступна.' : 'This section is currently being prepared. It will be available soon.' }}</p>
    </div>
  </div>
  <PageTemplate
    v-else-if="pageData"
    :title="pageData.title"
    :textContent="pageData.content || ''"
    :slides="pageData.hero_image ? [{ image_url: getImageUrl(pageData.hero_image), title: pageData.title }] : []"
  />
</template>

<style scoped>
.page-loading {
  display: flex; justify-content: center; align-items: center;
  min-height: 60vh; color: #888; font-size: 1.1rem;
}
.page-not-found {
  display: flex; justify-content: center; align-items: center;
  min-height: 60vh; text-align: center; padding: 40px 20px;
}
.content-box { max-width: 500px; }
.big-icon { font-size: 4rem; margin-bottom: 20px; }
.page-not-found h1 { color: #332317; margin-bottom: 10px; }
.page-not-found p { color: #888; line-height: 1.6; }
</style>
