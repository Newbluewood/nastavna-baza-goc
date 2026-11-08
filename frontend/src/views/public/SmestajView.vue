<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLangStore } from '../../stores/lang'
import PageTemplate from '../../components/layout/PageTemplate.vue'
import PageLoading from '../../components/ui/PageLoading.vue'
import SectionDivider from '../../components/ui/SectionDivider.vue'
import ImageLightbox from '../../components/ui/ImageLightbox.vue'
import { useRouter } from 'vue-router'
import api from '../../services/api'
import { collectGalleryImages } from '../../utils/galleryImages'
import { resolveMediaUrlOrPlaceholder } from '../../utils/mediaUrl'

const router = useRouter()
const slides = ref([])
const facilities = ref([])
const isLoading = ref(true)

const pageTitle = ref('Смештај')
const textContent = ref('')

const langStore = useLangStore()

const lightboxOpen = ref(false)
const lbImages = ref([])
const lbIndex = ref(0)

const loadData = async () => {
  isLoading.value = true
  try {
    const data = await api.getFacilities(langStore.currentLang)

    if (data) {
      pageTitle.value = data.pageTitle || pageTitle.value
      textContent.value = data.textContent || textContent.value
      facilities.value = Array.isArray(data) ? data : (data.facilities || [])
      facilities.value = facilities.value.filter((facility) => facility.type === 'smestaj')

      slides.value = (data.slides && data.slides.length > 0)
        ? data.slides
        : facilities.value.slice(0, 5).map((facility) => ({
            image_url: resolveMediaUrlOrPlaceholder(facility.cover_image || facility.gallery?.[0]?.image_url),
            title: facility.name || pageTitle.value,
            subtitle: facility.capacity || facility.type || '',
          }))
    }
  } catch (error) {
    console.error('Error fetching data from API:', error)
  } finally {
    isLoading.value = false
  }
}

const openGallery = (facility) => {
  const imgs = collectGalleryImages(facility)
  if (imgs.length === 0) return

  lbImages.value = imgs
  lbIndex.value = 0
  lightboxOpen.value = true
}

const viewRooms = (facility) => {
  router.push(`/smestaj/${facility.id}`)
}

onMounted(loadData)

watch(() => langStore.currentLang, () => {
  loadData()
})
</script>

<template>
  <PageLoading v-if="isLoading" :message="langStore.t('smestaj.loadingFacilities')" />

  <PageTemplate
    v-else
    :title="pageTitle"
    :slides="slides"
    :text-content="textContent"
  >
    <div class="content-wrap">
      <h2 class="section-heading">
        {{ langStore.t('smestaj.capacities') }}
      </h2>

      <div class="facilities-grid facilities-grid--cards">
        <div v-for="facility in facilities" :key="facility.id" class="facility-card facility-card--portrait">
          <div class="facility-image-wrapper" @click="openGallery(facility)">
            <img :src="resolveMediaUrlOrPlaceholder(facility.cover_image)" class="facility-img" />
            <div class="img-overlay">
              <span>📷 {{ langStore.t('smestaj.viewGallery') }}</span>
            </div>
          </div>

          <div class="facility-info">
            <h3>{{ facility.name }}</h3>

            <div class="location-badges-row" v-if="facility.location_badges && facility.location_badges.length > 0">
              <span class="loc-badge" v-for="badge in facility.location_badges" :key="badge">🌲 {{ badge }}</span>
            </div>

            <p class="capacity">
              <strong>{{ langStore.t('smestaj.capacity') }}:</strong> {{ facility.capacity || langStore.t('smestaj.notSpecified') }}
            </p>

            <div v-if="facility.min_price" class="min-price-tag">
              <span class="from-text">{{ langStore.t('smestaj.pricesFrom') }}</span>
              <span class="price-val">{{ facility.min_price }} RSD</span>
            </div>

            <div class="description" v-html="facility.description"></div>

            <div class="actions-row">
              <button @click="viewRooms(facility)" class="inquiry-btn">
                {{ langStore.t('smestaj.viewRooms') }}
              </button>

              <a
                v-if="facility.latitude && facility.longitude"
                :href="'https://www.google.com/maps/search/?api=1&query=' + facility.latitude + ',' + facility.longitude"
                target="_blank"
                class="map-btn"
              >
                {{ langStore.t('smestaj.openMap') }}
              </a>
            </div>
          </div>

          <div v-if="facility.floor_plan_image" class="facility-plan">
            <h4>{{ langStore.t('smestaj.floorPlan') }}</h4>
            <img
              :src="resolveMediaUrlOrPlaceholder(facility.floor_plan_image)"
              alt="Plan"
              @click="openGallery({ cover_image: facility.floor_plan_image })"
            />
          </div>
        </div>
      </div>
    </div>

    <SectionDivider />

    <div class="content-wrap content-wrap--bottom">
      <h2 class="section-heading section-heading--tight">
        {{ langStore.t('smestaj.location') }}
      </h2>
      <div class="map-container">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d11585.397637825313!2d20.806667!3d43.557500!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47565780ebbe518d%3A0xe2f1f46adbf58ae0!2sGo%C4%8D!5e0!3m2!1sen!2srs!4v1700000000000!5m2!1sen!2srs"
          width="100%"
          height="450"
          allowfullscreen=""
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
    </div>
  </PageTemplate>

  <ImageLightbox
    v-model:isOpen="lightboxOpen"
    :images="lbImages"
    :initialIndex="lbIndex"
  />
</template>

<style src="../../assets/facility-cards.css"></style>
<style src="../../assets/smestaj-page.css"></style>
