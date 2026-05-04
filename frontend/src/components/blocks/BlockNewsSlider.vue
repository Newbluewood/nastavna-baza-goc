<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api, { BASE_URL } from '../../services/api'
import { useLangStore } from '../../stores/lang'

const router = useRouter()
const langStore = useLangStore()
const news = ref([])
const currentIndex = ref(0)
const isLoading = ref(true)

const fetchNews = async () => {
  try {
    const data = await api.getNews(langStore.currentLang)
    news.value = data.slice(0, 8) 
  } catch (err) {
    console.error('Error fetching news slider:', err)
  } finally {
    isLoading.value = false
  }
}

const nextNews = () => {
  if (news.value.length === 0) return
  currentIndex.value = (currentIndex.value + 1) % news.value.length
}
const prevNews = () => {
  if (news.value.length === 0) return
  currentIndex.value = (currentIndex.value - 1 + news.value.length) % news.value.length
}

let autoTimer = null
onMounted(() => {
  fetchNews()
  autoTimer = setInterval(nextNews, 6000)
})
onUnmounted(() => clearInterval(autoTimer))

const getImageUrl = (path) => {
  if (!path) return '/placeholder.jpg'
  if (path.startsWith('http')) return path
  return `${BASE_URL}${path}`
}
</script>

<template>
  <div class="news-slider-block">
    <div class="slider-inner">
      <div class="slider-head">
        <h2 class="title">{{ langStore.currentLang === 'sr' ? 'Актуелности' : 'News & Updates' }}</h2>
        <div class="slider-controls">
           <button @click="prevNews" class="ctrl-btn">←</button>
           <button @click="nextNews" class="ctrl-btn">→</button>
        </div>
      </div>

      <div v-if="isLoading" class="loading-state">...</div>

      <div v-else-if="news.length > 0" class="slider-viewport">
        <div class="slider-track" :style="{ transform: `translateX(-${currentIndex * 100}%)` }">
          <div v-for="item in news" :key="item.id" class="news-slide" @click="router.push(`/vesti/${item.id}`)">
             <div class="slide-card">
                <div class="slide-img">
                   <img :src="getImageUrl(item.image)" alt="News" />
                </div>
                <div class="slide-info">
                   <span class="date">{{ item.date }}</span>
                   <h3>{{ item.title }}</h3>
                   <p class="summary" v-html="item.summary"></p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.news-slider-block { background: #fdfaf7; padding: 60px 0; }
.slider-inner { max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px; }

.slider-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
.title { font-size: 2rem; color: #332317; border-left: 5px solid #cdac91; padding-left: 20px; margin: 0; }

.slider-controls { display: flex; gap: 10px; }
.ctrl-btn {
  background: #332317; color: #fff; border: none; width: 40px; height: 40px;
  cursor: pointer; font-size: 1.2rem; transition: 0.3s;
}
.ctrl-btn:hover { background: #cdac91; }

.slider-viewport { overflow: hidden; }
.slider-track { display: flex; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1); }

.news-slide { min-width: 100%; padding: 0 10px; cursor: pointer; }
.slide-card { display: flex; background: #fff; border: 1px solid #e8ddd2; height: 400px; }

.slide-img { flex: 1; overflow: hidden; }
.slide-img img { width: 100%; height: 100%; object-fit: cover; transition: 0.8s; }
.news-slide:hover .slide-img img { transform: scale(1.05); }

.slide-info { flex: 1; padding: 40px; display: flex; flex-direction: column; justify-content: center; }
.date { font-size: 0.85rem; color: #cdac91; font-weight: bold; text-transform: uppercase; margin-bottom: 15px; }
.slide-info h3 { font-size: 1.8rem; color: #332317; margin: 0 0 20px; line-height: 1.2; font-family: "FOF24", sans-serif; }
.summary { color: #67462e; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }

@media (max-width: 768px) {
  .slide-card { flex-direction: column; height: auto; }
  .slide-img { height: 250px; }
  .slide-info { padding: 25px; }
  .slide-info h3 { font-size: 1.4rem; }
}
</style>
