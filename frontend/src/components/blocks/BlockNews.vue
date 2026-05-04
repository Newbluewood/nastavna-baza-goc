<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api, { BASE_URL } from '../../services/api'
import { useLangStore } from '../../stores/lang'

const router = useRouter()
const langStore = useLangStore()
const latestNews = ref([])
const isLoading = ref(true)

const fetchNews = async () => {
  try {
    const data = await api.getNews(langStore.currentLang)
    latestNews.value = data.slice(0, 3) 
  } catch (err) {
    console.error('Error fetching news block:', err)
  } finally {
    isLoading.value = false
  }
}

const getImageUrl = (path) => {
  if (!path) return '/placeholder.jpg'
  if (path.startsWith('http')) return path
  return `${BASE_URL}${path}`
}

onMounted(fetchNews)
</script>

<template>
  <div class="news-block-container">
    <div class="news-header">
       <h2 class="block-title">{{ langStore.currentLang === 'sr' ? 'Најновије вести' : 'Latest News' }}</h2>
       <router-link to="/vesti" class="all-news-link">{{ langStore.currentLang === 'sr' ? 'Све вести' : 'All news' }} →</router-link>
    </div>

    <div v-if="isLoading" class="news-loading">...</div>

    <div v-else class="news-grid-mini">
       <div v-for="news in latestNews" :key="news.id" class="news-card-mini" @click="router.push(`/vesti/${news.id}`)">
          <div class="news-img-wrap">
             <img :src="getImageUrl(news.image)" alt="News" />
          </div>
          <div class="news-info-mini">
             <span class="news-date-mini">{{ news.date }}</span>
             <h4 class="news-title-mini">{{ news.title }}</h4>
          </div>
       </div>
    </div>
  </div>
</template>

<style scoped>
.news-block-container { max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px; }
.news-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
.block-title { border-left: 4px solid #332317; padding-left: 12px; margin: 0; color: #332317; }
.all-news-link { font-weight: bold; color: #cdac91; font-size: 0.9rem; }

.news-grid-mini { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; }
.news-card-mini { cursor: pointer; background: #fff; border: 1px solid #e8ddd2; transition: 0.3s; }
.news-card-mini:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.05); }

.news-img-wrap { height: 180px; overflow: hidden; }
.news-img-wrap img { width: 100%; height: 100%; object-fit: cover; }

.news-info-mini { padding: 15px; }
.news-date-mini { font-size: 0.75rem; color: #888; text-transform: uppercase; }
.news-title-mini { margin: 8px 0 0; font-size: 1.1rem; color: #332317; line-height: 1.3; }
</style>
