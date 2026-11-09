<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLangStore } from '../../stores/lang'
import ImageLightbox from '../../components/ui/ImageLightbox.vue'
import PageLoading from '../../components/ui/PageLoading.vue'
import api from '../../services/api'
import { resolveMediaUrl, resolveMediaUrlOrPlaceholder } from '../../utils/mediaUrl'
import { newsLocationSafe } from '../../utils/publicPaths'

const props = defineProps({
  slug: { type: String, required: true },
})

const router = useRouter()
const langStore = useLangStore()
const newsItem = ref(null)
const isLoading = ref(true)
const debugError = ref('')
const isLiked = ref(false)
const allNews = ref([])
const prevNews = ref(null)
const nextNews = ref(null)

const lightboxOpen = ref(false)
const lbIndex = ref(0)
const lightboxImages = computed(() => {
  const gallery = newsItem.value?.gallery
  if (!Array.isArray(gallery)) return []
  return gallery
    .map((entry) => resolveMediaUrl(typeof entry === 'string' ? entry : entry?.image_url))
    .filter(Boolean)
})

const openLightbox = (index) => {
  lbIndex.value = index
  lightboxOpen.value = true
}

const loadNews = async () => {
  isLoading.value = true
  debugError.value = ''
  try {
    const key = props.slug
    const [item, newsList] = await Promise.all([
      api.getNewsItem(key, langStore.currentLang),
      api.getNews(langStore.currentLang).catch((err) => {
        console.error('Error loading news list:', err)
        return []
      }),
    ])

    newsItem.value = item
    if (item?.slug && String(key) !== item.slug) {
      router.replace({ name: 'single-news', params: { slug: item.slug } })
    }
    isLiked.value = !!localStorage.getItem(`liked_news_${item.id}`)
    allNews.value = newsList

    const currentIndex = newsList.findIndex(
      (n) => n.id === item.id || n.slug === item.slug
    )
    // Same order as /vesti and home cards (created_at DESC): prev = earlier in list, next = later.
    if (currentIndex !== -1) {
      prevNews.value = currentIndex > 0 ? newsList[currentIndex - 1] : null
      nextNews.value = currentIndex < newsList.length - 1 ? newsList[currentIndex + 1] : null
    } else {
      prevNews.value = null
      nextNews.value = null
    }
  } catch (err) {
    newsItem.value = null
    debugError.value = err.message || String(err)
    console.error('Error loading news', err)
  } finally {
    isLoading.value = false
  }
}

const unformattedContent = computed(() => {
    return newsItem.value?.content || ''
})

const handleLike = async () => {
  if (!newsItem.value) return
  const storageKey = `liked_news_${newsItem.value.id}`
  if (localStorage.getItem(storageKey)) {
    alert(langStore.t('common.error') + ': ' + langStore.t('news.alreadyLiked'))
    return
  }

  try {
    const data = await api.likeNews(newsItem.value.id)
    newsItem.value.likes = data.likes
    localStorage.setItem(storageKey, 'true')
    isLiked.value = true
  } catch (err) {
    console.error(err)
  }
}

onMounted(() => {
  loadNews()
})

watch(() => langStore.currentLang, () => {
  loadNews()
})

watch(() => props.slug, () => {
  loadNews()
})
</script>

<template>
  <PageLoading
    v-if="isLoading"
    :message="langStore.t('news.loading')"
  />

  <div v-else-if="debugError" class="news-state news-state--error">
    {{ langStore.t('news.loadError') }}
  </div>

  <div v-else-if="!newsItem" class="news-state news-state--missing">
    {{ langStore.t('news.notFound') }}
  </div>

  <div v-else class="single-news-page">
    
    <!-- HERO SLIKA -->
    <div class="news-hero">
      <img :src="resolveMediaUrlOrPlaceholder(newsItem.cover_image || '/news-hero.png')" class="hero-bg" />
      <div class="hero-overlay"></div>
      <div class="hero-content glass-box">
        <h1>{{ newsItem.title }}</h1>
        <p class="news-date">{{ new Date(newsItem.created_at).toLocaleDateString() }}</p>
      </div>
    </div>
    
    <!-- SADRZAJ -->
    <div class="news-body">
      <div class="news-text" v-html="unformattedContent"></div>
      
      <div class="like-section">
        <button class="like-btn" @click="handleLike" :class="{ 'liked': isLiked }">
          👍 {{ langStore.t('news.like') }}
          <span class="like-count">({{ newsItem.likes || 0 }})</span>
        </button>
      </div>
      
      <hr class="divider" v-if="newsItem.gallery && newsItem.gallery.length > 0" />
      
      <!-- GALERIJA -->
      <div v-if="newsItem.gallery && newsItem.gallery.length > 0" class="news-gallery">
        <h2>{{ langStore.t('news.gallery') }}</h2>
        <div class="photo-grid">
          <div 
            v-for="(img, idx) in newsItem.gallery" 
            :key="idx" 
            class="gallery-item"
            @click="openLightbox(idx)"
          >
            <img :src="resolveMediaUrlOrPlaceholder(img.image_url)" :alt="img.caption || 'Foto'" />
            <div v-if="img.caption" class="gallery-caption">{{ img.caption }}</div>
          </div>
        </div>
      </div>
      
      <!-- NAVIGACIJA -->
      <div class="news-navigation">
        <router-link :to="newsLocationSafe(prevNews)" v-if="prevNews" class="nav-btn prev">
          &larr; {{ langStore.t('news.previous') }}
        </router-link>
        <router-link :to="{ name: 'vesti' }" class="nav-btn all">
          {{ langStore.t('news.allNews') }}
        </router-link>
        <router-link :to="newsLocationSafe(nextNews)" v-if="nextNews" class="nav-btn next">
          {{ langStore.t('news.next') }} &rarr;
        </router-link>
      </div>
    </div>

    <!-- LIGHTBOX -->
    <ImageLightbox 
      v-model:isOpen="lightboxOpen"
      :images="lightboxImages"
      :initialIndex="lbIndex"
    />

  </div>
</template>

<style scoped>
.news-state {
  padding: 100px 20px;
  text-align: center;
  min-height: 50vh;
}
.news-state--error {
  color: #fff;
  background: red;
  margin: 20px;
  min-height: auto;
}
.news-state--missing {
  color: red;
}
.news-hero {
  position: relative;
  width: 100%;
  height: 60vh;
  min-height: 400px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  object-fit: cover;
  z-index: 1;
}
.hero-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(to bottom, rgba(0,0,0,0) 20%, rgba(0,0,0,0.8) 100%);
  z-index: 2;
}
.hero-content {
  position: relative;
  z-index: 3;
  padding: 0 20px;
  max-width: var(--content-max-width);
  width: 100%;
  margin: 0 auto;
  margin-bottom: 40px;
}
.glass-box {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 30px;
  border-left: 5px solid var(--c-green-6);
}
.hero-content h1 {
  font-size: 2.5rem;
  margin: 0 0 10px 0;
  color: var(--c-green-6);
  line-height: 1.2;
}
.news-date {
  font-size: 1rem;
  color: var(--c-braon-4);
  font-weight: 600;
  margin: 0;
}

.news-body {
  max-width: var(--content-max-width);
  margin: 40px auto;
  padding: 0 20px;
}
.news-text {
  font-size: 1.1rem;
  line-height: 1.6;
  color: var(--color-text);
  margin-bottom: 40px;
}

.like-section {
  display: flex;
  justify-content: center;
  margin: 40px 0;
}
.like-btn {
  background: white;
  border: 2px solid var(--color-nav, #333);
  color: var(--color-nav, #333);
  padding: 12px 30px;
  font-size: 1.2rem;
  font-weight: bold;
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 10px;
}
.like-btn:hover {
  background: var(--color-nav, #333);
  color: white;
}
.like-btn.liked {
  background: var(--color-nav, #333);
  color: white;
  cursor: default;
}
.like-count {
  opacity: 0.8;
}

.divider {
  border: 0;
  height: 1px;
  background: var(--color-border);
  margin: 40px 0;
}

.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 20px;
}
.gallery-item {
  position: relative;
  height: 150px;
  cursor: pointer;
  overflow: hidden;
  border-radius: 4px;
}
.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;

}
.gallery-item:hover img {
  transform: scale(1.05);
}

.gallery-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.42);
  color: #fff;
  font-size: 0.78rem;
  line-height: 1.3;
  padding: 6px 9px;
}

@media (max-width: 768px) {
  .hero-content h1 { font-size: 2rem; }
  .news-hero { height: 40vh; min-height: 300px; }
  .photo-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
}

.news-navigation {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 60px;
  padding-top: 30px;
  border-top: 1px solid var(--color-border);
}

.nav-btn {
  text-decoration: none;
  font-weight: bold;
  color: var(--color-nav);
  padding: 8px 15px;
  border: 1px solid var(--color-nav);
  transition: all 0.3s;
}

.nav-btn:hover {
  background: var(--color-nav);
  color: #fff;
}

.nav-btn.all {
  border: none;
  background: #f5f0eb;
  padding: 10px 25px;
}

.nav-btn.all:hover {
  background: #e0d5c8;
  color: var(--color-nav);
}
</style>
