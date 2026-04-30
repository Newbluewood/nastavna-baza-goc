<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLangStore } from '../../stores/lang'
import ImageLightbox from '../../components/ui/ImageLightbox.vue'
import api from '../../services/api'

const route = useRoute()
const langStore = useLangStore()
const newsItem = ref(null)
const isLoading = ref(true)
const debugError = ref('')
const isLiked = ref(false)

const lightboxOpen = ref(false)
const lbIndex = ref(0)
const lightboxImages = computed(() => {
  if (!newsItem.value || !newsItem.value.gallery) return []
  return newsItem.value.gallery.map(g => g.image_url)
})

const openLightbox = (index) => {
  lbIndex.value = index
  lightboxOpen.value = true
}

const loadNews = async () => {
  isLoading.value = true
  try {
    newsItem.value = await api.getNewsItem(route.params.id, langStore.currentLang)
    isLiked.value = !!localStorage.getItem(`liked_news_${newsItem.value.id}`)
  } catch (err) {
    debugError.value = err.message || JSON.stringify(err);
    console.error("Error loading news", err)
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
    alert(langStore.t('common.error') + ': ' + (langStore.currentLang === 'sr' ? "Већ сте лајковали ову вест!" : "You already liked this news!"))
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
</script>

<template>
  <div v-if="debugError" style="padding: 100px 20px; text-align: center; color: white; background: red; margin: 20px;">
    ГРЕШКА: {{ debugError }}
  </div>

  <div v-if="isLoading && !debugError" style="padding: 100px 20px; text-align: center; min-height: 50vh;">
    {{ langStore.currentLang === 'sr' ? 'Учитавам вест...' : 'Loading news...' }}
    <br><small style="color:red">Ако ово траје предуго, проверите конзолу (F12) или сервер.</small>
  </div>

  <div v-else-if="!newsItem && !debugError" style="padding: 100px 20px; text-align: center; min-height: 50vh; color: red;">
    {{ langStore.currentLang === 'sr' ? 'Вест није пронађена.' : 'News not found.' }}
  </div>

  <div v-else class="single-news-page">
    
    <!-- HERO SLIKA -->
    <div class="news-hero">
      <img :src="newsItem.cover_image" class="hero-bg" />
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <h1>{{ newsItem.title }}</h1>
        <p class="news-date">{{ new Date(newsItem.created_at).toLocaleDateString() }}</p>
      </div>
    </div>
    
    <!-- SADRZAJ -->
    <div class="news-body">
      <div class="news-text" v-html="unformattedContent"></div>
      
      <div class="like-section">
        <button class="like-btn" @click="handleLike" :class="{ 'liked': isLiked }">
          👍 {{ langStore.currentLang === 'sr' ? 'Свиђа ми се' : 'Like' }} 
          <span class="like-count">({{ newsItem.likes || 0 }})</span>
        </button>
      </div>
      
      <hr class="divider" v-if="newsItem.gallery && newsItem.gallery.length > 0" />
      
      <!-- GALERIJA -->
      <div v-if="newsItem.gallery && newsItem.gallery.length > 0" class="news-gallery">
        <h2>{{ langStore.currentLang === 'sr' ? 'Галерија' : 'Gallery' }}</h2>
        <div class="photo-grid">
          <div 
            v-for="(img, idx) in newsItem.gallery" 
            :key="idx" 
            class="gallery-item"
            @click="openLightbox(idx)"
          >
            <img :src="img.image_url" :alt="img.caption || 'Foto'" />
            <div v-if="img.caption" class="gallery-caption">{{ img.caption }}</div>
          </div>
        </div>
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
  padding: 40px;
  color: white;
  max-width: var(--content-max-width);
  width: 100%;
  margin: 0 auto;
}
.hero-content h1 {
  font-size: 3rem;
  margin: 0 0 10px 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}
.news-date {
  font-size: 1.1rem;
  opacity: 0.9;
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
</style>
