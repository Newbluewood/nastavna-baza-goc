<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import ImageLightbox from '../ui/ImageLightbox.vue'
import { useLangStore } from '../../stores/lang'

const props = defineProps({
  title: { type: String, default: '' },
  textContent: { type: String, default: '' },
  galleryItems: { type: Array, default: () => [] },
  slides: { type: Array, default: () => [] },
  news: { type: Array, default: () => [] },
  gridType: { type: Number, default: 6 },
  isCarousel: { type: Boolean, default: false }
})

const langStore = useLangStore()
const currentSlide = ref(0)
let slideTimer = null
const SLIDE_DELAY_MS = 5000

const lightboxOpen = ref(false)
const lbIndex = ref(0)
const lightboxImages = computed(() => {
  return props.galleryItems.map(item => item.url).filter(url => url)
})

const openLightbox = (index) => {
  lbIndex.value = index
  lightboxOpen.value = true
}

const nextSlide = () => {
  if (props.slides && props.slides.length > 0) {
    currentSlide.value = (currentSlide.value + 1) % props.slides.length
  }
}

const prevSlide = () => {
  if (props.slides && props.slides.length > 0) {
    currentSlide.value = (currentSlide.value - 1 + props.slides.length) % props.slides.length
  }
}

const stopAutoSlide = () => {
  if (slideTimer) {
    clearTimeout(slideTimer)
    slideTimer = null
  }
}

const scheduleNextSlide = () => {
  stopAutoSlide()
  if (!props.slides || props.slides.length <= 1) return

  slideTimer = setTimeout(() => {
    nextSlide()
    scheduleNextSlide()
  }, SLIDE_DELAY_MS)
}

const handleVisibilityChange = () => {
  if (document.hidden) {
    stopAutoSlide()
  } else {
    scheduleNextSlide()
  }
}

// Pokreni slider čim slides stignu (sa API-ja ili odmah)
watch(() => props.slides, (newSlides) => {
  if (currentSlide.value >= (newSlides?.length || 0)) {
    currentSlide.value = 0
  }
  scheduleNextSlide()
}, { immediate: true })

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  stopAutoSlide()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div class="page-content">
    
    <!-- Hero Slider -->
    <div v-if="slides && slides.length > 0" class="hero-slider" style="position: relative; width: 100%; height: 500px; overflow: hidden; background: var(--c-green-6); border-radius: 0; margin-bottom: 20px;">
      <div v-for="(slide, index) in slides" :key="index" :style="{ 
        opacity: index === currentSlide ? 1 : 0, 
        zIndex: index === currentSlide ? 1 : 0,
        pointerEvents: index === currentSlide ? 'auto' : 'none',
        transition: 'opacity 0.8s ease', 
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' 
      }">
        <img :src="slide.image_url" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.65;" />
        <div class="slide-content">
           <h1 style="margin: 0; color: var(--color-nav);">{{ slide.title }}</h1>
           <p v-if="slide.subtitle" style="margin: 5px 0 0 0; color: var(--color-text);">{{ slide.subtitle }}</p>
           <router-link v-if="slide.target_link" :to="slide.target_link" style="display: inline-block; margin-top: 10px; font-weight: bold; border-bottom: 2px solid var(--color-nav);">
             {{ langStore.currentLang === 'sr' ? 'Сазнај више' : 'Learn more' }}
           </router-link>
        </div>
      </div>
      
      <!-- Kontrole za slajder -->
      <button v-if="slides.length > 1" @click="prevSlide" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); z-index: 10; background: rgba(205, 172, 145, 0.6); color: #fff; border: none; font-size: 1.5rem; cursor: pointer; border-radius: 0%; width: 30px; height: 40px;">&#10094;</button>
      <button v-if="slides.length > 1" @click="nextSlide" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); z-index: 10; background: rgba(205, 172, 145, 0.6); color: #fff; border: none; font-size: 1.5rem; cursor: pointer; border-radius: 0%; width: 30px; height: 40px;">&#10095;</button>
    </div>
    
    <!-- Placeholder ako nema slajdera -->
    <div v-else-if="title" class="hero-slider" style="position: relative; width: 100%; height: 500px; overflow: hidden; background: #332317; border-radius: 0; margin-bottom: 20px;">
      <img src="/placeholder.jpg" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.7;" />
      <div class="slide-content">
        <h1 style="margin: 0; color: var(--color-nav);">{{ title }}</h1>
      </div>
    </div>
    
    <hr class="section-divider" />
    
    <!-- Glavni Tekst -->
    <div class="text-content" v-if="textContent">
      <p v-html="textContent"></p>
    </div>
    
    <!-- Custom Page Content Slot -->
    <slot></slot>
    
    <hr class="section-divider" v-if="news && news.length > 0" />

    <!-- Najnovije Vesti (News sekcija) -->
    <div v-if="news && news.length > 0" class="news-section" style="margin: 30px 0;">
      <h2 style="margin-bottom: 20px; border-left: 4px solid var(--color-nav); padding-left: 10px;">{{ langStore.currentLang === 'sr' ? 'Актуелности' : 'News & Updates' }}</h2>
      
      <!-- GRID -->
      <div v-if="!isCarousel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
        <div v-for="item in news" :key="item.id" class="news-card" style="position: relative; height: 320px; border: 1px solid var(--color-border); border-radius: 0; overflow: hidden; background: #fff; display: flex; flex-direction: column;">
          <img v-if="item.cover_image" :src="item.cover_image" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; cursor: pointer; z-index: 0;" @click="openLightbox(0)" />
          <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(255,255,255,0.88); padding: 15px; z-index: 1;">
             <h3 style="margin-bottom: 5px; font-size: 1.1rem; color: var(--color-nav);">{{ item.title }}</h3>
             <p style="font-size: 0.85rem; margin-bottom: 10px; color: var(--color-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">{{ item.excerpt }}</p>
             <router-link :to="item.link || `/vesti/${item.slug || item.id}`" style="font-weight: bold; font-size: 0.85rem; display: inline-block; color: var(--color-nav); border-bottom: 1px solid var(--color-nav);">{{ langStore.currentLang === 'sr' ? 'Прочитај више' : 'Read more' }} &rarr;</router-link>
          </div>
        </div>
      </div>

      <!-- CAROUSEL -->
      <div v-else class="news-carousel">
        <div v-for="item in news" :key="item.id" class="news-card carousel-item" style="position: relative; flex: 0 0 calc(33.333% - 1rem); min-width: 250px; height: 320px; scroll-snap-align: start; border: 1px solid var(--color-border); border-radius: 0; overflow: hidden; background: #fff;">
          <img v-if="item.cover_image" :src="item.cover_image" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" />
          <div style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(255,255,255,0.88); padding: 15px; z-index: 1;">
             <h3 style="margin-bottom: 5px; font-size: 1.1rem; color: var(--color-nav);">{{ item.title }}</h3>
             <p style="font-size: 0.85rem; margin-bottom: 10px; color: var(--color-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">{{ item.excerpt }}</p>
             <router-link :to="item.link || `/vesti/${item.slug || item.id}`" style="font-weight: bold; font-size: 0.85rem; display: inline-block; color: var(--color-nav); border-bottom: 1px solid var(--color-nav);">{{ langStore.currentLang === 'sr' ? 'Прочитај више' : 'Read more' }} &rarr;</router-link>
          </div>
        </div>
      </div>

    </div>
    
    <hr class="section-divider" v-if="galleryItems && galleryItems.length > 0" />
    
    <!-- Opšta Galerija -->
    <div v-if="galleryItems && galleryItems.length > 0">
      <h2 style="margin-bottom: 20px; border-left: 4px solid var(--color-nav); padding-left: 10px;">{{ langStore.currentLang === 'sr' ? 'Галерија' : 'Gallery' }}</h2>
      <div :class="(gridType === 5) ? 'photo-grid-5' : 'photo-grid-6'">
        <a v-for="(item, index) in galleryItems" :key="index" href="#" @click.prevent="openLightbox(index)" class="gallery-item-link" style="text-decoration:none; color:inherit; display: block; overflow: hidden; border-radius: 0;">
          <div v-if="item.url" style="width: 100%; height: 150px; position: relative; cursor: pointer;">
            <img :src="item.url" style="width: 100%; height: 100%; object-fit: cover;" />
            <div v-if="item.name" style="position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.42); color: #fff; padding: 5px 10px; font-size: 0.8rem;">
              {{ item.name }}
            </div>
          </div>
        </a>
      </div>
    </div>

    <!-- Lightbox Component -->
    <ImageLightbox 
      v-model:isOpen="lightboxOpen"
      :images="lightboxImages"
      :initialIndex="lbIndex"
    />

  </div>
</template>

<style scoped>
/* Hero Slide Content - Desktop */
.slide-content {
  position: absolute;
  bottom: 40px;
  left: 40px;
  background: rgba(255, 255, 255, 0.66);
  padding: 15px 30px;
  border-radius: 0;
  max-width: calc(100% - 80px);
}

/* Hero Slide Content - Mobilni */
@media (max-width: 640px) {
  .slide-content {
    left: 50%;
    transform: translateX(-50%);
    bottom: 20px;
    width: 85%;
    max-width: 85%;
    text-align: center;
    padding: 12px 20px;
  }
  .slide-content h1 {
    font-size: 1.2rem;
  }
  .slide-content a {
    display: inline-block;
    margin-top: 8px;
  }
}

/* News Section — constrain so carousel can overflow-x */
.news-section {
  max-width: 100%;
  overflow: hidden;          /* keeps section from growing wider than viewport */
}

/* News Carousel */
.news-carousel {
  display: flex;
  gap: 1.5rem;
  overflow-x: scroll;        /* always show scrollbar track */
  overflow-y: hidden;
  padding-bottom: 16px;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: #cdac91 #f5f0eb;
  -webkit-overflow-scrolling: touch;
}
.news-carousel::-webkit-scrollbar { height: 6px; }
.news-carousel::-webkit-scrollbar-track { background: transparent; }
.news-carousel::-webkit-scrollbar-thumb { background: #cdac91; border-radius: 3px; }
.news-carousel::-webkit-scrollbar-thumb:hover { background: #9a714e; }

@media (max-width: 640px) {
  .news-carousel .carousel-item { flex: 0 0 80vw !important; min-width: 0 !important; }
}
</style>
