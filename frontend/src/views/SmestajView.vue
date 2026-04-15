<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { useLangStore } from '../stores/lang'
import ImageLightbox from '../components/ImageLightbox.vue'
import InquiryModal from '../components/InquiryModal.vue'

const slides = ref([])
const facilities = ref([])
const isLoading = ref(true)

const pageTitle = ref("Смештај")
const textContent = ref("")

const langStore = useLangStore()

// Za hero slider
const currentSlide = ref(0)
let slideInterval = null

// Za Lightbox
const lightboxOpen = ref(false)
const lbImages = ref([])
const lbIndex = ref(0)

// Za Inquiry Modal
const inquiryOpen = ref(false)
const selectedFacilityId = ref(null)
const selectedFacilityName = ref("")

const loadData = async () => {
  isLoading.value = true
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/smestaj?lang=${langStore.currentLang}`);
    const data = await response.json();
    
    if (data) {
      pageTitle.value = data.pageTitle || pageTitle.value
      textContent.value = data.textContent || textContent.value
      slides.value = data.slides || []
      facilities.value = data.facilities || []
    }
  } catch (error) {
    console.error("Error fetching data from API:", error)
  } finally {
    isLoading.value = false
    setupInterval()
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
const setupInterval = () => {
  if (slideInterval) clearInterval(slideInterval)
  if (slides.value.length > 1) {
    slideInterval = setInterval(nextSlide, 5000)
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

const openInquiry = (facility) => {
  selectedFacilityId.value = facility.id
  selectedFacilityName.value = facility.name
  inquiryOpen.value = true
}

onMounted(() => {
  loadData()
})

onUnmounted(() => {
  if (slideInterval) clearInterval(slideInterval)
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
    <div v-if="slides && slides.length > 0" class="hero-slider" style="position: relative; width: 100%; height: 500px; overflow: hidden; background: #332317; margin-bottom: 20px;">
      <div v-for="(slide, index) in slides" :key="index" :style="{ opacity: index === currentSlide ? 1 : 0, transition: 'opacity 0.8s ease', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }">
        <img :src="slide.image_url" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.7;" />
        <div class="slide-content" style="position: absolute; bottom: 40px; left: 40px; background: rgba(255,255,255,0.85); padding: 15px 30px;">
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
            <p class="capacity">
              <strong>{{ langStore.currentLang === 'sr' ? 'Капацитет' : 'Capacity' }}:</strong> {{ facility.capacity || (langStore.currentLang === 'sr' ? 'Није наведено' : 'N/A') }}
            </p>
            <div class="description" v-html="facility.description"></div>

            <!-- Dugme za upit -->
            <button @click="openInquiry(facility)" class="inquiry-btn">
              ✉ {{ langStore.currentLang === 'sr' ? 'Пошаљи упит' : 'Send Inquiry' }}
            </button>
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

  <InquiryModal 
    v-model:isOpen="inquiryOpen"
    :facilityId="selectedFacilityId"
    :facilityName="selectedFacilityName"
  />

</template>

<style scoped>
.facilities-grid {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.facility-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
  height: 100%;
  min-height: 250px;
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
  align-self: flex-start;
  border-radius: 0;
}
.inquiry-btn:hover {
  background: var(--color-btn-hover);
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
  .facility-card {
    grid-template-columns: 1fr;
  }
  .facility-image-wrapper {
    height: 250px;
  }
}
</style>
