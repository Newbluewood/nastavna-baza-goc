<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLangStore } from '../../stores/lang'
import ImageLightbox from '../../components/ui/ImageLightbox.vue'
import PageLoading from '../../components/ui/PageLoading.vue'
import InquiryModal from '../../components/forms/InquiryModal.vue'
import api from '../../services/api'
import { collectGalleryImages } from '../../utils/galleryImages'
import { resolveMediaUrlOrPlaceholder } from '../../utils/mediaUrl'

const route = useRoute()
const router = useRouter()
const langStore = useLangStore()

const building = ref(null)
const isLoading = ref(true)

const lightboxOpen = ref(false)
const lbImages = ref([])
const lbIndex = ref(0)

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
  if (!amenitiesArray || !Array.isArray(amenitiesArray)) return []
  return amenitiesArray.map((key) => {
    const data = amenityMapping[key]
    if (!data) return { label: key, icon: '🔹' }
    return {
      label: langStore.currentLang === 'sr' ? data.sr : data.en,
      icon: data.icon,
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
  <PageLoading v-if="isLoading" :message="langStore.t('smestaj.loadingData')" />

  <div v-else-if="building" class="page-content">
    <div class="hero-cover">
      <img :src="resolveMediaUrlOrPlaceholder(building.cover_image)" class="hero-cover-img" />
      <div class="hero-content">
        <h1 class="slide-title">{{ building.name }}</h1>
      </div>
    </div>

    <hr class="section-divider" />

    <div class="content-wrap content-wrap--intro">
      <button class="back-link-btn" @click="router.push('/smestaj')">
        &#8592; {{ langStore.t('smestaj.backToAll') }}
      </button>

      <div class="text-content text-content--flush" v-if="building.description" v-html="building.description"></div>

      <p class="facility-total-capacity">
        {{ langStore.t('smestaj.totalCapacity') }} {{ building.capacity || '-' }}
      </p>
    </div>

    <hr class="section-divider" />

    <div class="content-wrap content-wrap--bottom">
      <h2 class="section-heading">
        {{ langStore.t('smestaj.roomsInFacility') }}
      </h2>

      <div v-if="building.rooms && building.rooms.length > 0" class="facilities-grid facilities-grid--rooms">
        <div v-for="room in building.rooms" :key="room.id" class="facility-card facility-card--landscape">
          <div class="facility-image-wrapper" @click="openGallery(room)">
            <img :src="resolveMediaUrlOrPlaceholder(room.cover_image)" class="facility-img" />
            <div class="img-overlay">
              <span>{{ langStore.t('smestaj.viewGallery') }}</span>
            </div>
          </div>

          <div class="facility-info">
            <h3>{{ room.name }}</h3>

            <p class="capacity capacity--tight">
              <strong>{{ langStore.t('smestaj.capacity') }}:</strong> {{ room.capacity || langStore.t('smestaj.notSpecified') }}
            </p>

            <div v-if="room.amenities" class="amenities-container">
              <span v-for="amenity in getAmenities(room.amenities)" :key="amenity.label" class="amenity-badge">
                {{ amenity.icon }} {{ amenity.label }}
              </span>
            </div>

            <div class="description" v-html="room.description"></div>

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

            <button @click="openInquiry(room)" class="inquiry-btn">
              ✉ {{ langStore.t('inquiry.sendInquiry') }}
            </button>
          </div>

          <div v-if="room.floor_plan_image" class="facility-plan">
            <h4>{{ langStore.t('smestaj.floorPlan') }}</h4>
            <img
              :src="resolveMediaUrlOrPlaceholder(room.floor_plan_image)"
              alt="Plan"
              @click="openGallery({ cover_image: room.floor_plan_image })"
            />
          </div>
        </div>
      </div>

      <p v-else class="empty-rooms-note">
        {{ langStore.t('smestaj.noRooms') }}
      </p>
    </div>
  </div>

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
<style src="../../assets/smestaj-page.css"></style>
