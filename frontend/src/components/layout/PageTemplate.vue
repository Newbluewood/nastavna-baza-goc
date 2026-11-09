<script setup>
import { ref, onMounted, onUnmounted, computed, watch, useSlots, Comment } from 'vue'
import ImageLightbox from '../ui/ImageLightbox.vue'
import { useLangStore } from '../../stores/lang'
import { resolveMediaUrl, resolveMediaUrlOrPlaceholder } from '../../utils/mediaUrl'
import { newsLocationSafe, locationFromPath } from '../../utils/publicPaths'

const resolveLink = (link) => {
  if (!link) return null
  return typeof link === 'string' ? locationFromPath(link) : link
}

const props = defineProps({
  title: { type: String, default: '' },
  textContent: { type: String, default: '' },
  galleryItems: { type: Array, default: () => [] },
  slides: { type: Array, default: () => [] },
  news: { type: Array, default: () => [] },
  gridType: { type: Number, default: 6 },
  isCarousel: { type: Boolean, default: false }
})

const slots = useSlots()
const langStore = useLangStore()
const currentSlide = ref(0)
let slideTimer = null
const SLIDE_DELAY_MS = 5000

const lightboxOpen = ref(false)
const lbIndex = ref(0)
const lightboxImages = computed(() => {
  return props.galleryItems
    .map((item) => resolveMediaUrl(item?.url))
    .filter((url) => url)
})

/**
 * Page chrome rule (single source of truth):
 *   hero → always divider → content bands
 * Bands in order: lead → text → main(slot) → news → gallery
 * A divider is inserted automatically *between* consecutive visible bands.
 * Views must NOT hand-roll page-level <hr class="section-divider">.
 * Rare in-slot splits use <SectionDivider /> only.
 */
const slotHasContent = (name) => {
  const nodes = (name === 'default' ? slots.default?.() : slots[name]?.()) || []
  return nodes.some((node) => {
    if (node.type === Comment) return false
    if (typeof node.type === 'symbol') return false
    return true
  })
}

const hasLead = computed(() => slotHasContent('lead'))
const hasTextContent = computed(() => !!String(props.textContent || '').trim())
const hasMain = computed(() => slotHasContent('default'))
const hasNews = computed(() => Array.isArray(props.news) && props.news.length > 0)
const hasGallery = computed(() => Array.isArray(props.galleryItems) && props.galleryItems.length > 0)

const visibleBands = computed(() => {
  const bands = []
  if (hasLead.value) bands.push('lead')
  if (hasTextContent.value) bands.push('text')
  if (hasMain.value) bands.push('main')
  if (hasNews.value) bands.push('news')
  if (hasGallery.value) bands.push('gallery')
  return bands
})

const dividerBefore = (band) => {
  const index = visibleBands.value.indexOf(band)
  return index > 0
}

const mediaSrc = (path) => resolveMediaUrlOrPlaceholder(path)

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
    <div v-if="slides && slides.length > 0" class="hero-slider">
      <div
        v-for="(slide, index) in slides"
        :key="index"
        class="hero-slide"
        :class="{ 'is-active': index === currentSlide }"
      >
        <img :src="mediaSrc(slide.image_url)" class="hero-slide-img" />
        <div class="slide-content">
           <h1 class="slide-title">{{ slide.title }}</h1>
           <p v-if="slide.subtitle" class="slide-subtitle">{{ slide.subtitle }}</p>
           <router-link v-if="slide.target_link" :to="resolveLink(slide.target_link)" class="slide-cta">
             {{ langStore.currentLang === 'sr' ? 'Сазнај више' : 'Learn more' }}
           </router-link>
        </div>
      </div>
      
      <!-- Kontrole za slajder -->
      <button v-if="slides.length > 1" @click="prevSlide" class="hero-nav-btn hero-nav-btn--prev">&#10094;</button>
      <button v-if="slides.length > 1" @click="nextSlide" class="hero-nav-btn hero-nav-btn--next">&#10095;</button>
    </div>
    
    <!-- Placeholder ako nema slajdera -->
    <div v-else-if="title" class="hero-slider hero-placeholder-bg">
      <img src="/placeholder.jpg" class="hero-slide-img hero-slide-img--strong" />
      <div class="slide-content">
        <h1 class="slide-title">{{ title }}</h1>
      </div>
    </div>
    
    <!-- Always: post-hero rule -->
    <hr class="section-divider" />

    <!-- Band: lead (back link, short meta…) -->
    <slot v-if="hasLead" name="lead" />

    <!-- Band: CMS / entity intro HTML -->
    <hr v-if="dividerBefore('text')" class="section-divider" />
    <div v-if="hasTextContent" class="text-content" v-html="textContent"></div>

    <!-- Band: main page body -->
    <hr v-if="dividerBefore('main')" class="section-divider" />
    <slot />

    <!-- Band: news -->
    <hr v-if="dividerBefore('news')" class="section-divider" />
    <div v-if="hasNews" class="news-section">
      <h2 class="section-heading">{{ langStore.currentLang === 'sr' ? 'Актуелности' : 'News & Updates' }}</h2>
      
      <div v-if="!isCarousel" class="news-grid">
        <div v-for="item in news" :key="item.id" class="news-card">
          <router-link
            v-if="item.cover_image"
            :to="resolveLink(item.link) || newsLocationSafe(item)"
            class="news-card-img-link"
          >
            <img :src="mediaSrc(item.cover_image)" class="news-card-img" alt="" />
          </router-link>
          <div class="news-card-body">
             <h3 class="news-card-title">{{ item.title }}</h3>
             <p class="news-card-excerpt">{{ item.excerpt }}</p>
             <router-link :to="resolveLink(item.link) || newsLocationSafe(item)" class="news-card-link">{{ langStore.currentLang === 'sr' ? 'Прочитај више' : 'Read more' }} &rarr;</router-link>
          </div>
        </div>
      </div>

      <div v-else class="news-carousel">
        <div v-for="item in news" :key="item.id" class="news-card carousel-item">
          <router-link
            v-if="item.cover_image"
            :to="resolveLink(item.link) || newsLocationSafe(item)"
            class="news-card-img-link"
          >
            <img :src="mediaSrc(item.cover_image)" class="news-card-img" alt="" />
          </router-link>
          <div class="news-card-body">
             <h3 class="news-card-title">{{ item.title }}</h3>
             <p class="news-card-excerpt">{{ item.excerpt }}</p>
             <router-link :to="resolveLink(item.link) || newsLocationSafe(item)" class="news-card-link">{{ langStore.currentLang === 'sr' ? 'Прочитај више' : 'Read more' }} &rarr;</router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Band: gallery -->
    <hr v-if="dividerBefore('gallery')" class="section-divider" />
    <div v-if="hasGallery">
      <h2 class="section-heading">{{ langStore.currentLang === 'sr' ? 'Галерија' : 'Gallery' }}</h2>
      <div :class="(gridType === 5) ? 'photo-grid-5' : 'photo-grid-6'">
        <a v-for="(item, index) in galleryItems" :key="index" href="#" @click.prevent="openLightbox(index)" class="gallery-item-link">
          <div v-if="item.url" class="gallery-thumb">
            <img :src="mediaSrc(item.url)" class="gallery-thumb-img" />
            <div v-if="item.name" class="gallery-thumb-caption">
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
.hero-slider {
  position: relative;
  width: 100%;
  height: var(--hero-height);
  overflow: hidden;
  background: var(--c-green-6);
  border-radius: 0;
  margin-bottom: 0;
}

.hero-placeholder-bg {
  background: #332317;
}

.hero-slide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  z-index: 0;
  pointer-events: none;
  transition: opacity 0.8s ease;
}

.hero-slide.is-active {
  opacity: 1;
  z-index: 1;
  pointer-events: auto;
}

.hero-slide-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.65;
}

.hero-slide-img--strong {
  opacity: 0.7;
}

.hero-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background: rgba(205, 172, 145, 0.6);
  color: #fff;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  width: 30px;
  height: 40px;
}

.hero-nav-btn--prev { left: 10px; }
.hero-nav-btn--next { right: 10px; }

.slide-content {
  position: absolute;
  bottom: 40px;
  left: 40px;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(10px);
  padding: 20px 35px;
  border-radius: 0;
  max-width: calc(100% - 80px);
  border-left: 4px solid var(--color-nav);
}

.slide-title {
  margin: 0;
  color: var(--color-nav);
}

.slide-subtitle {
  margin: 5px 0 0;
  color: var(--color-text);
}

.slide-cta {
  display: inline-block;
  margin-top: 10px;
  font-weight: bold;
  border-bottom: 2px solid var(--color-nav);
}

.section-heading {
  margin-bottom: 20px;
  border-left: 4px solid var(--color-nav);
  padding-left: 10px;
}

.news-section {
  margin: 30px 0;
  max-width: 100%;
  overflow: hidden;
}

.news-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.news-card {
  position: relative;
  height: 320px;
  border: 1px solid var(--color-border);
  border-radius: 0;
  overflow: hidden;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.news-carousel .news-card {
  flex: 0 0 calc(33.333% - 1rem);
  min-width: 250px;
  scroll-snap-align: start;
}

.news-card-img-link {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
}

.news-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.news-card-body {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: rgba(255, 255, 255, 0.88);
  padding: 15px;
  z-index: 1;
}

.news-card-title {
  margin-bottom: 5px;
  font-size: 1.1rem;
  color: var(--color-nav);
}

.news-card-excerpt {
  font-size: 0.85rem;
  margin-bottom: 10px;
  color: var(--color-text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.news-card-link {
  font-weight: bold;
  font-size: 0.85rem;
  display: inline-block;
  color: var(--color-nav);
  border-bottom: 1px solid var(--color-nav);
}

.gallery-item-link {
  text-decoration: none;
  color: inherit;
  display: block;
  overflow: hidden;
}

.gallery-thumb {
  width: 100%;
  height: 150px;
  position: relative;
  cursor: pointer;
}

.gallery-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-thumb-caption {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background: rgba(0, 0, 0, 0.42);
  color: #fff;
  padding: 5px 10px;
  font-size: 0.8rem;
}

.news-carousel {
  display: flex;
  gap: 1.5rem;
  overflow-x: scroll;
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

@media (max-width: 1023px) {
  .hero-slider {
    height: var(--hero-height-mobile);
  }
  .slide-content {
    left: 50%;
    transform: translateX(-50%);
    bottom: 20px;
    width: 85%;
    max-width: 85%;
    text-align: center;
    padding: 12px 20px;
  }
  .slide-content h1,
  .slide-title {
    font-size: 1.2rem;
  }
}

@media (max-width: 640px) {
  .news-carousel .carousel-item {
    flex: 0 0 80vw;
    min-width: 0;
  }
}
</style>
