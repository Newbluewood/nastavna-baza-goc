<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLangStore } from '../stores/lang'
import ImageLightbox from '../components/ImageLightbox.vue'
import InquiryModal from '../components/InquiryModal.vue'
import api from '../services/api.js'

const route = useRoute()
const router = useRouter()
const langStore = useLangStore()

const building = ref(null)
const isLoading = ref(true)

// Za Lightbox
const lightboxOpen = ref(false)
const lbImages = ref([])
const lbIndex = ref(0)

// Za Inquiry Modal
const inquiryOpen = ref(false)
const selectedRoomId = ref(null)
const selectedRoomName = ref("")

const amenityMapping = {
  wifi: { sr: 'Бесплатан WiFi', en: 'Free WiFi', icon: '📶' },
  tv: { sr: 'ТВ и Кабловска', en: 'TV & Cable', icon: '📺' },
  parking: { sr: 'Паркинг', en: 'Parking', icon: '🅿️' },
  kuhinja: { sr: 'Кухиња', en: 'Kitchen', icon: '🍳' },
  klima: { sr: 'Клима', en: 'AC', icon: '❄️' },
  kupatilo: { sr: 'Сопствено купатило', en: 'Private Bathroom', icon: '🚿' }
}

const getAmenities = (amenitiesArray) => {
  if (!amenitiesArray || !Array.isArray(amenitiesArray)) return [];
  return amenitiesArray.map(key => {
     const data = amenityMapping[key]
     if (!data) return { label: key, icon: '🔹' }
     return {
        label: langStore.currentLang === 'sr' ? data.sr : data.en,
        icon: data.icon
     }
  })
}

const loadData = async () => {
  isLoading.value = true
  try {
    building.value = await api.getFacility(route.params.id, langStore.currentLang)
  } catch (error) {
    console.error("Error fetching data from API:", error)
    // Moze redirect ako ne postoji
    router.push('/smestaj')
  } finally {
    isLoading.value = false
  }
}

const openGallery = (item) => {
  const imgs = []
  if (item.cover_image) imgs.push(item.cover_image)
  if (item.gallery && item.gallery.length) {
    item.gallery.forEach(g => imgs.push(g.image_url))
  }
  if (imgs.length === 0) return;

  lbImages.value = imgs
  lbIndex.value = 0
  lightboxOpen.value = true
}

const openInquiry = (room) => {
  selectedRoomId.value = room.id
  selectedRoomName.value = room.name
  inquiryOpen.value = true
}

onMounted(() => {
  loadData()
})

watch(() => langStore.currentLang, () => {
  loadData()
})
</script>

<template>
  <div v-if="isLoading" style="padding: 100px 20px; text-align: center; min-height: 50vh;">
    {{ langStore.currentLang === 'sr' ? 'Учитавам податке...' : 'Loading data...' }}
  </div>

  <div v-else-if="building" class="page-content">
    
    <!-- Hero / Objekat Cover -->
    <div class="hero-image" style="position: relative; width: 100%; height: 400px; overflow: hidden; background: #332317; margin-bottom: 20px;">
        <img :src="building.cover_image || '/placeholder.jpg'" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.7;" />
        <div class="hero-content">
           <h1 style="margin: 0; color: var(--color-nav);">{{ building.name }}</h1>
        </div>
    </div>

    <!-- Nazad na Smestaj dugme -->
    <div style="max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px 20px;">
      <button @click="router.push('/smestaj')" style="background: transparent; border: none; cursor: pointer; color: var(--color-nav); font-weight: bold; font-size: 1rem; margin-bottom: 20px;">
        &#8592; {{ langStore.currentLang === 'sr' ? 'Назад на све објекте' : 'Back to all facilities' }}
      </button>

      <div class="text-content" v-if="building.description" v-html="building.description"></div>
      
      <p style="margin-top:20px; font-weight: bold;">
        {{ langStore.currentLang === 'sr' ? 'Укупан капацитет:' : 'Total capacity:' }} {{ building.capacity || '-' }}
      </p>
    </div>

    <hr class="section-divider" style="max-width: var(--content-max-width); margin: 40px auto; border-top: 2px solid var(--color-border); opacity: 0.5;"/>

    <div style="max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px 40px;">
      <h2 style="margin-bottom: 30px; border-left: 4px solid var(--color-nav); padding-left: 10px;">
        {{ langStore.currentLang === 'sr' ? 'Собе у овом објекту' : 'Rooms in this facility' }}
      </h2>

      <div v-if="building.rooms && building.rooms.length > 0" class="facilities-grid">
        <div v-for="room in building.rooms" :key="room.id" class="facility-card">
          <!-- Slika Sobe -->
          <div class="facility-image-wrapper" @click="openGallery(room)">
            <img :src="room.cover_image || '/placeholder.jpg'" class="facility-img" />
            <div class="img-overlay">
              <span>📷 {{ langStore.currentLang === 'sr' ? 'Погледај галерију' : 'View Gallery' }}</span>
            </div>
          </div>

          <!-- Sadržaj Sobe -->
          <div class="facility-info">
            <h3>{{ room.name }}</h3>
            
            <p class="capacity" style="margin-bottom: 5px;">
              <strong>{{ langStore.currentLang === 'sr' ? 'Капацитет' : 'Capacity' }}:</strong> {{ room.capacity || (langStore.currentLang === 'sr' ? 'Није наведено' : 'N/A') }}
            </p>
            
            <!-- Amenities Badges -->
            <div v-if="room.amenities" class="amenities-container">
               <span v-for="amenity in getAmenities(room.amenities)" :key="amenity.label" class="amenity-badge">
                 {{ amenity.icon }} {{ amenity.label }}
               </span>
            </div>

            <div class="description" v-html="room.description"></div>

            <!-- Dugme za upit za SOBU -->
            <button @click="openInquiry(room)" class="inquiry-btn">
              ✉ {{ langStore.currentLang === 'sr' ? 'Пошаљи упит' : 'Send Inquiry' }}
            </button>
          </div>

          <!-- Skica sobe -->
          <div v-if="room.floor_plan_image" class="facility-plan">
             <h4>{{ langStore.currentLang === 'sr' ? 'План собе' : 'Floor Plan' }}</h4>
             <img :src="room.floor_plan_image" alt="Plan" @click="openGallery({cover_image: room.floor_plan_image})" />
          </div>
        </div>
      </div>
      
      <p v-else style="color: #666; font-style: italic;">
        {{ langStore.currentLang === 'sr' ? 'Тренутно нема унетих соба за овај објекат.' : 'There are no rooms listed for this facility at the moment.' }}
      </p>

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
    :roomId="selectedRoomId"
    :roomName="selectedRoomName"
    :buildingName="building?.name"
  />

</template>

<style scoped>
.hero-content {
  position: absolute;
  bottom: 40px;
  left: 40px;
  background: rgba(255,255,255,0.88);
  padding: 15px 30px;
  border-radius: 0;
  max-width: calc(100% - 80px);
}
@media (max-width: 640px) {
  .hero-content {
    left: 50%;
    transform: translateX(-50%);
    bottom: 20px;
    width: 85%;
    max-width: 85%;
    text-align: center;
    padding: 12px 20px;
  }
}

.facilities-grid {
  display: flex;
  flex-direction: column;
  gap: 20px; /* Malo manji razmak izmedju soba */
}

.facility-card {
  display: flex;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 0;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.facility-image-wrapper {
  position: relative;
  cursor: pointer;
  overflow: hidden;
  width: 350px; /* Fiksna sirina za sliku levo */
  flex-shrink: 0;
  min-height: 220px;
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
  flex: 1; /* Stretch container so buttons align perfectly on the right */
  min-width: 0; /* Prebacuje brigu o prelamanju teksta na CSS Grid/Flexbox */
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

.amenities-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 15px;
}

.amenity-badge {
  display: inline-flex;
  align-items: center;
  background-color: #f1f1f1;
  color: #333;
  padding: 4px 8px;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 0;
  border: 1px solid #ddd;
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
  align-self: flex-start; /* Klasicno ravnanje sa levom ivicom teksta je najpredvidljivije */
  margin-top: auto; 
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

@media (max-width: 768px) {
  .facility-card {
    flex-direction: column;
  }
  .facility-image-wrapper {
    width: 100%;
    height: 200px;
  }
  .inquiry-btn {
    align-self: flex-start; /* Dugme nazad na pocetak na telefonu */
  }
}
</style>
