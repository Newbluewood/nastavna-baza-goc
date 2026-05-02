<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { useLangStore } from '../../stores/lang'
import ImageLightbox from '../../components/ui/ImageLightbox.vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'

const router = useRouter()
const slides = ref([])
const facilities = ref([])
const isLoading = ref(true)

const pageTitle = ref("Смештај")
const textContent = ref("")

const langStore = useLangStore()

// Za hero slider
const currentSlide = ref(0)
let slideTimer = null
const SLIDE_DELAY_MS = 5000

// Za Lightbox
const lightboxOpen = ref(false)
const lbImages = ref([])
const lbIndex = ref(0)

const loadData = async () => {
  isLoading.value = true
  try {
    const data = await api.getFacilities(langStore.currentLang);
    console.log('Facilities API response:', data)
    
    if (data) {
      pageTitle.value = data.pageTitle || pageTitle.value
      textContent.value = data.textContent || textContent.value
      facilities.value = Array.isArray(data) ? data : (data.facilities || [])
      
      // Filtriraj samo smeštajne objekte (ne proizvodne)
      facilities.value = facilities.value.filter(facility => facility.type === 'smestaj')
      
      slides.value = (data.slides && data.slides.length > 0)
        ? data.slides
        : facilities.value.slice(0, 5).map(facility => ({
            image_url: facility.cover_image || facility.gallery?.[0]?.image_url || '/placeholder.jpg',
            title: facility.name || pageTitle.value,
            subtitle: facility.capacity || facility.type || ''
          }))
    }
  } catch (error) {
    console.error("Error fetching data from API:", error)
  } finally {
    isLoading.value = false
    if (currentSlide.value >= slides.value.length) {
      currentSlide.value = 0
    }
    scheduleNextSlide()
  }
}

const nextSlide = () => {
  if (slides.value.length > 0) {
    currentSlide.value = (currentSlide.value + 1) % slides.value.length
  }
}
const prevSlide = () => {
  if (slides.value.length > 0) {
    currentSlide.value = (currentSlide.value - 1 + slides.value.length) % slides.value.length
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
  if (slides.value.length <= 1) return

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

const openGallery = (facility) => {
  // Spoji cover_image + media gallery slike
  const imgs = []
  if (facility.cover_image) imgs.push(facility.cover_image)
  if (facility.gallery && facility.gallery.length) {
    facility.gallery.forEach(g => imgs.push(g.image_url))
  }
  if (imgs.length === 0) return;

  lbImages.value = imgs
  lbIndex.value = 0
  lightboxOpen.value = true
}

const viewRooms = (facility) => {
  router.push(`/smestaj/${facility.id}`)
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
  loadData()
})

onUnmounted(() => {
  stopAutoSlide()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})

watch(() => langStore.currentLang, () => {
  loadData()
})
</script>

<template>
  <div v-if="isLoading" style="padding: 100px 20px; text-align: center; min-height: 50vh;">
    {{ langStore.currentLang === 'sr' ? 'Учитавам објекте...' : 'Loading facilities...' }}
  </div>

  <div v-else class="page-content">
    <!-- Hero Slider -->
    <div v-if="slides && slides.length > 0" class="hero-slider">
      <div v-for="(slide, index) in slides" :key="index" :style="{ opacity: index === currentSlide ? 1 : 0, transition: 'opacity 0.8s ease', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }">
        <img :src="slide.image_url" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.65;" />
        <div class="slide-content">
           <h1 style="margin: 0; color: var(--color-nav);">{{ slide.title || pageTitle }}</h1>
           <p v-if="slide.subtitle" style="margin: 5px 0 0 0; color: var(--color-text);">{{ slide.subtitle }}</p>
        </div>
      </div>
      <button v-if="slides.length > 1" @click="prevSlide" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: rgba(205, 172, 145, 0.6); color: #fff; border: none; font-size: 1.5rem; cursor: pointer; width: 30px; height: 40px;">&#10094;</button>
      <button v-if="slides.length > 1" @click="nextSlide" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: rgba(205, 172, 145, 0.6); color: #fff; border: none; font-size: 1.5rem; cursor: pointer; width: 30px; height: 40px;">&#10095;</button>
    </div>

    <!-- Main Text Content -->
    <div class="text-content" v-if="textContent" style="max-width: var(--content-max-width); margin: 0 auto; padding: 20px;">
      <div v-html="textContent"></div>
    </div>

    <hr class="section-divider" style="max-width: var(--content-max-width); margin: 40px auto; border-top: 2px solid var(--color-border); opacity: 0.5;"/>

    <!-- Facilities List -->
    <div style="max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px;">
      <h2 style="margin-bottom: 30px; border-left: 4px solid var(--color-nav); padding-left: 10px;">
        {{ langStore.currentLang === 'sr' ? 'Смештајни капацитети' : 'Accommodation Capacities' }}
      </h2>

      <div class="facilities-grid">
        <div v-for="facility in facilities" :key="facility.id" class="facility-card">
          <!-- Slika objekta -->
          <div class="facility-image-wrapper" @click="openGallery(facility)">
            <img :src="facility.cover_image || '/placeholder.jpg'" class="facility-img" />
            <div class="img-overlay">
              <span>📷 {{ langStore.currentLang === 'sr' ? 'Погледај галерију' : 'View Gallery' }}</span>
            </div>
          </div>

          <!-- Sadržaj objekta -->
          <div class="facility-info">
            <h3>{{ facility.name }}</h3>
            
            <!-- Location Badges -->
            <div class="location-badges-row" v-if="facility.location_badges && facility.location_badges.length > 0">
              <span class="loc-badge" v-for="badge in facility.location_badges" :key="badge">🌲 {{ badge }}</span>
            </div>

            <p class="capacity">
              <strong>{{ langStore.currentLang === 'sr' ? 'Капацитет' : 'Capacity' }}:</strong> {{ facility.capacity || (langStore.currentLang === 'sr' ? 'Није наведено' : 'N/A') }}
            </p>

            <!-- Starting Price Badge -->
            <div v-if="facility.min_price" class="min-price-tag">
               <span class="from-text">{{ langStore.currentLang === 'sr' ? 'Цене од' : 'Prices from' }}</span>
               <span class="price-val">{{ facility.min_price }} RSD</span>
            </div>

            <div class="description" v-html="facility.description"></div>

            <!-- Actions Row -->
            <div class="actions-row">
              <!-- Dugme za pregled soba -->
              <button @click="viewRooms(facility)" class="inquiry-btn">
                {{ langStore.currentLang === 'sr' ? 'Погледај Собе' : 'View Rooms' }}
              </button>

              <!-- Link ka mapi -->
              <a v-if="facility.latitude && facility.longitude" 
                 :href="'https://www.google.com/maps/search/?api=1&query=' + facility.latitude + ',' + facility.longitude" 
                 target="_blank" 
                 class="map-btn">
                {{ langStore.currentLang === 'sr' ? 'Отвори Мапу' : 'Open Map' }}
              </a>
            </div>
          </div>

          <!-- Skica / Osnova (sutra prebacena) -->
          <div v-if="facility.floor_plan_image" class="facility-plan">
             <h4>{{ langStore.currentLang === 'sr' ? 'План собе' : 'Floor Plan' }}</h4>
             <img :src="facility.floor_plan_image" alt="Plan" @click="openGallery({cover_image: facility.floor_plan_image})" />
          </div>
        </div>
      </div>
    </div>

    <hr class="section-divider" style="max-width: var(--content-max-width); margin: 40px auto; border-top: 2px solid var(--color-border); opacity: 0.5;"/>

    <!-- Google Map Embed -->
    <div style="max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px 40px;">
      <h2 style="margin-bottom: 20px; border-left: 4px solid var(--color-nav); padding-left: 10px;">
        {{ langStore.currentLang === 'sr' ? 'Локација' : 'Location' }}
      </h2>
      <div class="map-container">
        <!-- Zamenjeno sa ispravnim iframe kodom za mapu umesto linka -->
        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d11585.397637825313!2d20.806667!3d43.557500!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47565780ebbe518d%3A0xe2f1f46adbf58ae0!2sGo%C4%8D!5e0!3m2!1sen!2srs!4v1700000000000!5m2!1sen!2srs" width="100%" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
      </div>
    </div>

  </div>

  <!-- Components -->
  <ImageLightbox 
    v-model:isOpen="lightboxOpen"
    :images="lbImages"
    :initialIndex="lbIndex"
  />

</template>

<style scoped>
.hero-slider {
  position: relative; 
  width: 100%; 
  height: var(--hero-height); 
  overflow: hidden; 
  background: var(--c-green-6); 
  margin-bottom: 20px;
}

@media (max-width: 1023px) {
  .hero-slider {
    height: var(--hero-height-mobile);
  }
}

.facilities-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 30px;
}

.facility-card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 0; /* oštro */
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}

.facility-image-wrapper {
  position: relative;
  cursor: pointer;
  overflow: hidden;
  height: 250px; /* Fiksna visina slike za grid */
  flex-shrink: 0;
}

.facility-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s;
}
.facility-image-wrapper:hover .facility-img {
  transform: scale(1.05);
}

.img-overlay {
  position: absolute;
  bottom: 0; left: 0; width: 100%;
  background: rgba(0,0,0,0.6);
  color: #fff;
  padding: 10px;
  text-align: center;
  font-weight: bold;
  opacity: 0;
  transition: opacity 0.3s;
}
.facility-image-wrapper:hover .img-overlay {
  opacity: 1;
}

.facility-info {
  padding: 25px;
  display: flex;
  flex-direction: column;
  flex: 1; /* Zauzima sav preostali prostor izmedju slike i dna kartice */
}

.facility-info h3 {
  margin-top: 0;
  font-size: 1.5rem;
  color: var(--color-nav);
  margin-bottom: 10px;
}

.capacity {
  margin-top: 0;
  font-size: 0.95rem;
  color: #555;
  margin-bottom: 15px;
}

.location-badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.loc-badge {
  background-color: #f1f1f1;
  color: #495057;
  padding: 4px 8px;
  font-size: 0.8rem;
  font-weight: 500;
  border-radius: 0;
}
 
/* PRICE TAG STYLES */
.min-price-tag {
  display: flex;
  flex-direction: column;
  background: #fdfaf7;
  border-left: 4px solid var(--color-nav);
  padding: 10px 15px;
  margin-bottom: 20px;
  width: fit-content;
}
.from-text {
  font-size: 0.75rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.price-val {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-nav);
}

.actions-row {
  display: flex;
  gap: 15px;
  margin-top: auto; 
  align-items: center;
}
.map-btn {
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: bold;
  color: var(--color-nav);
  transition: opacity 0.3s;
}
.map-btn:hover {
  opacity: 0.7;
}

.description {
  flex: 1;
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 20px;
  color: var(--color-text);
}

.inquiry-btn {
  background: var(--color-nav);
  color: #fff;
  border: none;
  padding: 12px 20px;
  font-size: 1rem;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.3s;
  border-radius: 0;
}
.inquiry-btn:hover {
  background: var(--c-green-5);
  color: #fff;
}

.facility-plan {
  grid-column: 1 / -1;
  border-top: 1px solid var(--color-border);
  padding: 20px;
  background: #f9f9f9;
}
.facility-plan h4 {
  margin-top: 0;
  color: #555;
}
.facility-plan img {
  max-width: 100%;
  max-height: 250px;
  object-fit: contain;
  cursor: pointer;
  border: 1px solid var(--color-border);
}

.map-container {
  width: 100%;
  height: 450px;
  background: #eaeaea;
}

/* Responsivnost */
@media (max-width: 768px) {
  .facilities-grid {
    grid-template-columns: 1fr;
  }
}

/* Hero Slide Content */
.slide-content {
  position: absolute;
  bottom: 40px;
  left: 40px;
  background: rgba(255, 255, 255, 0.66);
  padding: 15px 30px;
  max-width: calc(100% - 80px);
}

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
}
</style>
