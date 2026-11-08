<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLangStore } from '../../stores/lang'
import ImageLightbox from '../../components/ui/ImageLightbox.vue'
import InquiryModal from '../../components/forms/InquiryModal.vue'
import api from '../../services/api'
import { collectGalleryImages } from '../../utils/galleryImages'
import { resolveMediaUrlOrPlaceholder } from '../../utils/mediaUrl'

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
const queryInquiryHandled = ref(false)

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
    openInquiryFromQuery()
  } catch (error) {
    console.error("Error fetching data from API:", error)
    // Moze redirect ako ne postoji
    router.push('/smestaj')
  } finally {
    isLoading.value = false
  }
}

const openGallery = (item) => {
  const imgs = collectGalleryImages(item)
  if (imgs.length === 0) return

  lbImages.value = imgs
  lbIndex.value = 0
  lightboxOpen.value = true
}

const openInquiry = (room) => {
  selectedRoomId.value = room.id
  selectedRoomName.value = room.name
  inquiryOpen.value = true
}

const openInquiryFromQuery = () => {
  if (queryInquiryHandled.value) return
  if (String(route.query.openInquiry || '') !== '1') return

  const roomId = Number(route.query.roomId)
  if (!roomId) return

  const rooms = building.value?.rooms || []
  const targetRoom = rooms.find((room) => Number(room.id) === roomId)

  if (targetRoom) {
    openInquiry(targetRoom)
  } else if (building.value) {
    selectedRoomId.value = roomId
    selectedRoomName.value = typeof route.query.roomName === 'string'
      ? route.query.roomName
      : ''
    inquiryOpen.value = true
  }

  queryInquiryHandled.value = true
}

onMounted(() => {
  loadData()
})

watch(() => langStore.currentLang, () => {
  loadData()
})

watch(
  () => [route.query.openInquiry, route.query.roomId, route.params.id],
  () => {
    queryInquiryHandled.value = false
    openInquiryFromQuery()
  }
)
</script>

<template>
  <div v-if="isLoading" style="padding: 100px 20px; text-align: center; min-height: 50vh;">
    {{ langStore.t('smestaj.loadingData') }}
  </div>

  <div v-else-if="building" class="page-content">
    
    <!-- Hero / Objekat Cover -->
    <div class="hero-image" style="position: relative; width: 100%; height: 400px; overflow: hidden; background: #332317; margin-bottom: 20px;">
        <img :src="resolveMediaUrlOrPlaceholder(building.cover_image)" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.7;" />
        <div class="hero-content">
           <h1 style="margin: 0; color: var(--color-nav);">{{ building.name }}</h1>
        </div>
    </div>

    <!-- Nazad na Smestaj dugme -->
    <div style="max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px 20px;">
      <button @click="router.push('/smestaj')" style="background: transparent; border: none; cursor: pointer; color: var(--color-nav); font-weight: bold; font-size: 1rem; margin-bottom: 20px;">
        &#8592; {{ langStore.t('smestaj.backToAll') }}
      </button>

      <div class="text-content" v-if="building.description" v-html="building.description"></div>
      
      <p style="margin-top:20px; font-weight: bold;">
        {{ langStore.t('smestaj.totalCapacity') }} {{ building.capacity || '-' }}
      </p>
    </div>

    <hr class="section-divider" style="max-width: var(--content-max-width); margin: 40px auto; border-top: 2px solid var(--color-border); opacity: 0.5;"/>

    <div style="max-width: var(--content-max-width); margin: 0 auto; padding: 0 20px 40px;">
      <h2 style="margin-bottom: 30px; border-left: 4px solid var(--color-nav); padding-left: 10px;">
        {{ langStore.t('smestaj.roomsInFacility') }}
      </h2>

      <div v-if="building.rooms && building.rooms.length > 0" class="facilities-grid facilities-grid--rooms">
        <div v-for="room in building.rooms" :key="room.id" class="facility-card facility-card--landscape">
          <!-- Slika Sobe -->
          <div class="facility-image-wrapper" @click="openGallery(room)">
            <img :src="resolveMediaUrlOrPlaceholder(room.cover_image)" class="facility-img" />
            <div class="img-overlay">
              <span>{{ langStore.t('smestaj.viewGallery') }}</span>
            </div>
          </div>

          <!-- Sadržaj Sobe -->
          <div class="facility-info">
            <h3>{{ room.name }}</h3>
            
            <p class="capacity" style="margin-bottom: 5px;">
              <strong>{{ langStore.t('smestaj.capacity') }}:</strong> {{ room.capacity || langStore.t('smestaj.notSpecified') }}
            </p>
            
            <!-- Amenities Badges -->
            <div v-if="room.amenities" class="amenities-container">
               <span v-for="amenity in getAmenities(room.amenities)" :key="amenity.label" class="amenity-badge">
                 {{ amenity.icon }} {{ amenity.label }}
               </span>
            </div>

            <div class="description" v-html="room.description"></div>

            <!-- Price Info -->
            <div class="price-info-block" v-if="room.price_base">
              <div class="price-main">
                <span class="price-label">{{ langStore.t('smestaj.pricesFrom') }}:</span>
                <span class="price-amount">{{ room.price_base }} RSD</span>
                <span class="price-unit">{{ langStore.t('smestaj.perNightPerson') }}</span>
              </div>
              <div class="price-details" v-if="room.price_half_board || room.price_full_board">
                <span v-if="room.price_half_board">☕ {{ langStore.t('inquiry.boardHalf') }}: <strong>{{ room.price_half_board }} RSD</strong></span>
                <span v-if="room.price_full_board">🍽️ {{ langStore.t('inquiry.boardFull') }}: <strong>{{ room.price_full_board }} RSD</strong></span>
              </div>
              <p v-if="room.meal_info" class="meal-disclaimer">{{ room.meal_info }}</p>
            </div>

            <!-- Dugme za upit za SOBU -->
            <button @click="openInquiry(room)" class="inquiry-btn">
              ✉ {{ langStore.t('inquiry.sendInquiry') }}
            </button>
          </div>

          <!-- Skica sobe -->
          <div v-if="room.floor_plan_image" class="facility-plan">
             <h4>{{ langStore.t('smestaj.floorPlan') }}</h4>
             <img :src="resolveMediaUrlOrPlaceholder(room.floor_plan_image)" alt="Plan" @click="openGallery({cover_image: room.floor_plan_image})" />
          </div>
        </div>
      </div>
      
      <p v-else style="color: #666; font-style: italic;">
        {{ langStore.t('smestaj.noRooms') }}
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
    :initialCheckIn="typeof route.query.checkIn === 'string' ? route.query.checkIn : ''"
    :initialCheckOut="typeof route.query.checkOut === 'string' ? route.query.checkOut : ''"
    :initialGuestName="typeof route.query.guestName === 'string' ? route.query.guestName : ''"
    :initialGuestEmail="typeof route.query.guestEmail === 'string' ? route.query.guestEmail : ''"
    :initialGuestPhone="typeof route.query.guestPhone === 'string' ? route.query.guestPhone : ''"
    :initialBoardType="typeof route.query.boardType === 'string' ? route.query.boardType : 'base'"
  />

</template>

<style src="../../assets/facility-cards.css"></style>
<style scoped>
.hero-content {
  position: absolute;
  bottom: 40px;
  left: 40px;
  background: rgba(255, 255, 255, 0.66);
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
</style>
