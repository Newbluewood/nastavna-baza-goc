<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLangStore } from '../../stores/lang'
import api, { BASE_URL } from '../../services/api'
import PageTemplate from '../../components/layout/PageTemplate.vue'

// Blocks
import BlockMap from '../../components/blocks/BlockMap.vue'
import BlockContact from '../../components/blocks/BlockContact.vue'
import BlockStaff from '../../components/blocks/BlockStaff.vue'
import BlockFacilities from '../../components/blocks/BlockFacilities.vue'
import BlockProjects from '../../components/blocks/BlockProjects.vue'
import BlockFAQ from '../../components/blocks/BlockFAQ.vue'
import BlockGallery from '../../components/blocks/BlockGallery.vue'
import BlockTicker from '../../components/blocks/BlockTicker.vue'
import BlockNews from '../../components/blocks/BlockNews.vue'
import BlockVideo from '../../components/blocks/BlockVideo.vue'
import BlockDiscover from '../../components/blocks/BlockDiscover.vue'
import BlockNewsSlider from '../../components/blocks/BlockNewsSlider.vue'
import BlockMenu from '../../components/blocks/BlockMenu.vue'

const blockComponents = {
  map: BlockMap,
  contact: BlockContact,
  staff: BlockStaff,
  projects: BlockProjects,
  facilities: BlockFacilities,
  faq: BlockFAQ,
  gallery: BlockGallery,
  ticker: BlockTicker,
  news: BlockNews,
  video: BlockVideo,
  discover: BlockDiscover,
  news_slider: BlockNewsSlider,
  menu: BlockMenu
}

const route = useRoute()
const langStore = useLangStore()
const pageData = ref(null)
const isLoading = ref(true)

const news = ref([])
const galleryItems = ref([])
const staff = ref([])
const projects = ref([])
const facilities = ref([])
const slides = ref([])

const fetchPage = async () => {
  let currentSlug = route.meta.pageSlug || route.params.slug
  if (route.path === '/') currentSlug = 'pocetna'
  if (!currentSlug) return

  isLoading.value = true
  try {
    // 1. Fetch main page data
    const data = await api.getPageBySlug(currentSlug, langStore.currentLang)
    if (!data) return

    if (data.metadata) {
      data.metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata
    } else {
      data.metadata = { blocks: [{ type: 'text', enabled: true }] }
    }
    
    pageData.value = data
    console.log('--- PageBuilder: Loading Blocks for', currentSlug, '---')

    const activeBlocks = data.metadata.blocks?.filter(b => b.enabled) || []

    // 2. Ako je POCETNA, povuci specijalne podatke kao u starom HomeView
    if (currentSlug === 'pocetna') {
       const homeData = await api.getHome(langStore.currentLang)
       if (homeData) {
         news.value = homeData.news || []
         galleryItems.value = (homeData.facilities || []).map(f => ({
           url: f.cover_image || '/placeholder.jpg',
           name: f.name || f.type || ''
         }))
         // Default slides for pocetna if metadata is empty
         if (!data.metadata?.slides?.length) {
            slides.value = news.value.slice(0, 5).map(item => ({
              image_url: item.image || item.cover_image || '/placeholder.jpg',
              title: item.title,
              subtitle: item.summary || ''
            }))
         }
       }
    }

    // 3. Metadata slides logic
    if (data.metadata?.slides?.length) {
      slides.value = data.metadata.slides.map(s => ({
        image_url: s.image_url.startsWith('http') ? s.image_url : `${BASE_URL}${s.image_url}`,
        title: s.title || data.title,
        subtitle: s.subtitle || ''
      }))
    }

    // 4. Dependents for modular blocks
    if (activeBlocks.find(b => b.type === 'staff' || b.type === 'projects')) {
       const contactData = await api.getContactPage()
       staff.value = contactData.staff || []
       projects.value = contactData.projects || []
    }

    if (activeBlocks.find(b => b.type === 'facilities')) {
       const facData = await api.getFacilities(langStore.currentLang)
       let allFacs = Array.isArray(facData) ? facData : (facData.facilities || [])
       if (currentSlug === 'smestaj') facilities.value = allFacs.filter(f => f.type === 'smestaj')
       else if (currentSlug === 'restoran') facilities.value = allFacs.filter(f => f.type === 'restoran')
       else facilities.value = allFacs
    }

    // Fallback for non-home hero
    if (currentSlug !== 'home' && !slides.value.length) {
      const heroUrl = data.hero_image ? (data.hero_image.startsWith('http') ? data.hero_image : `${BASE_URL}${data.hero_image}`) : '/placeholder.jpg'
      slides.value = [{ image_url: heroUrl, title: data.title, subtitle: '' }]
    }

  } catch (err) {
    console.error('PageBuilder Error:', err)
  } finally {
    isLoading.value = false
  }
}

const getProps = (block) => {
  const type = block.type
  if (type === 'faq') return { content: pageData.value.content }
  if (type === 'map') return { html: block.google_map_html || pageData.value.metadata?.google_map_html }
  if (type === 'staff') return { members: staff.value }
  if (type === 'projects') return { projects: projects.value }
  if (type === 'facilities') return { facilities: facilities.value }
  if (type === 'video') return { videoUrl: block.video_url, title: block.title }
  if (type === 'menu') return { restaurantId: block.restaurant_id }
  return {}
}

onMounted(fetchPage)
watch(() => langStore.currentLang, fetchPage)
watch(() => route.meta.pageSlug, fetchPage)
watch(() => route.params.slug, fetchPage)
</script>

<template>
  <PageTemplate
    v-if="pageData"
    :title="pageData.title"
    :textContent="pageData.content"
    :slides="slides"
    :news="news"
    :galleryItems="galleryItems"
    :gridType="6"
    :isCarousel="true"
  >
    <div class="old-glory-modular-stack">
      <template v-for="block in (pageData.metadata?.blocks || [])" :key="block.id">
        <!-- SKIP NEWS_SLIDER and GALLERY if it's HOME, because PageTemplate handles them already via props -->
        <div v-if="block.enabled && block.type !== 'text' && (pageData.slug !== 'home' || (block.type !== 'news_slider' && block.type !== 'gallery'))" 
             class="pure-classic-unit">
          <component 
            :is="blockComponents[block.type]" 
            v-bind="getProps(block)"
          />
        </div>
      </template>
    </div>
  </PageTemplate>

  <div v-else-if="isLoading" class="loader-academic">
     <p>{{ langStore.currentLang === 'sr' ? 'Учитавам...' : 'Loading...' }}</p>
  </div>
</template>

<style scoped>
.old-glory-modular-stack { width: 100%; }
.pure-classic-unit { width: 100%; margin: 0; padding: 0; }
.loader-academic { padding: 100px; text-align: center; font-family: var(--font-base); color: var(--color-nav); }
</style>
